# 日本小包裹模块重构方案（v2）

将"日本小包裹"从静态卡片墙升级为完整的小包裹管理工作台：系统用 meruki 账号密码登录抓取该账号下的订单、AI 截图识别、手动录入、列表筛选与详情查看。数据持久化到 Lovable Cloud。

---

## 一、数据模型（Lovable Cloud）

### `japan_parcels`
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK → `meruki_accounts.id` | 归属账号，可空（手动/AI 导入时） |
| `source` | text | `meruki`/`yahoo`/`mercari`/`rakuten`/`manual`/`ai_ocr` |
| `source_order_no` | text | 来源订单号 |
| `tracking_no` | text | 国际物流单号 |
| `item_title` / `item_title_cn` | text | 商品标题（日/中） |
| `item_image_url` | text | 商品图 |
| `seller` | text | 卖家 / 店铺 |
| `category` | text | 品类 |
| `price_jpy` / `service_fee_jpy` / `domestic_freight_jpy` / `intl_freight_jpy` | numeric | 各项费用（日元） |
| `total_jpy` / `total_cny` | numeric | 总价 |
| `exchange_rate` | numeric | 汇率快照 |
| `status` | text | `bidding`/`paid`/`warehouse_jp`/`shipping_intl`/`customs`/`shipping_cn`/`delivered` |
| `purchased_at` / `eta` / `received_at` | timestamptz | 阶段时间 |
| `warehouse_location` | text | meruki 仓库位置 |
| `weight_g` | numeric | 重量 |
| `notes` | text | 备注 |
| `raw_payload` | jsonb | 抓取/识别原始 JSON |
| `completeness` | int | 字段完整度 0-100 |
| `created_at` / `updated_at` | timestamptz | |

唯一索引：`(account_id, source_order_no)`，重复抓取走 upsert。

### `meruki_accounts`
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `username` | text | meruki 登录账号 |
| `password_encrypted` | text | 加密后的密码（pgcrypto + 服务端密钥） |
| `display_name` | text | 备注名（如"主账号"） |
| `last_login_at` | timestamptz | 上次登录成功时间 |
| `last_login_status` | text | `ok` / `failed` / `captcha` |
| `last_error` | text | 失败原因 |
| `session_cookie` | text | 登录后获取的 Cookie，自动刷新 |
| `cookie_expires_at` | timestamptz | Cookie 过期时间 |

### `meruki_sync_runs`
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | |
| `account_id` | uuid FK | |
| `started_at` / `finished_at` | timestamptz | |
| `status` | text | `running` / `success` / `failed` |
| `fetched_count` / `inserted_count` / `updated_count` | int | |
| `message` | text | 错误或摘要 |

RLS：当前无登录体系，开放策略 `USING (true) WITH CHECK (true)`，账号表的密码字段仅服务端 server fn 读写，前端 API 永远不返回明文密码。

密码处理：服务端使用环境变量 `MERUKI_ENC_KEY`（已通过 `add_secret` 申请）+ pgcrypto `pgp_sym_encrypt/decrypt`，数据库里只保存密文。

---

## 二、模块路由结构

```text
/purchase/japan-parcel               列表页
/purchase/japan-parcel/accounts      meruki 账号管理（增删 / 测试登录 / 手动同步）
/purchase/japan-parcel/new           新建：手动 / AI 识图 双 Tab
/purchase/japan-parcel/$id           详情页
```

---

## 三、列表页 `/purchase/japan-parcel`

工具栏：
- 关键字搜索（订单号 / 标题 / 卖家 / 物流单号）
- 状态多选 Badge
- 来源筛选（meruki 账号下拉 / 拍卖平台 / 手动 / AI）
- 日期区间（采购时间）
- "仅看待补全"开关（completeness < 80）
- 右上：`从 meruki 同步`（弹出账号选择 + 触发抓取）、`AI 识图导入`、`手动新建`、`账号管理`

表格列：缩略图 / 订单号 / 商品标题 / 卖家 / 状态 Badge / 总价 ¥ / 采购日期 / 完整度环 / 操作。底部分页。

数据：server fn `listJapanParcels(filters)` 从 Supabase 拉取。

---

## 四、账号管理 `/purchase/japan-parcel/accounts`

- 列表展示已配置 meruki 账号：用户名（脱敏）/ 备注名 / 上次登录状态 / 上次同步时间。
- "新增账号"对话框：填写 username + password + 备注名 → 调用 `createMerukiAccount`，服务端立即尝试登录验证，成功后存入。
- 行操作：`测试登录` / `立即同步` / `查看同步日志（meruki_sync_runs）` / `编辑密码` / `删除`。
- 同步日志抽屉：展示历史 sync runs，便于排错。

---

## 五、详情页 `/purchase/japan-parcel/$id`

三栏：
- 左：商品大图 + 基础信息 + 完整度环
- 中：分组可编辑表单（商品 / 价格 / 物流 / 备注），每字段标注来源（爬取/识别/手动），保存调用 `updateJapanParcel`
- 右：状态时间线 + `raw_payload` JSON 折叠查看器

---

## 六、新建 `/purchase/japan-parcel/new`

**Tab 1 · AI 识图**
- 拖拽 / 点击上传 / `Ctrl+V` 粘贴截图（监听 `paste` 事件）
- "识别"按钮 → `recognizeParcelScreenshot(imageBase64)` → 通过 Lovable AI Gateway 调 `google/gemini-3-flash-preview`，使用 Vercel AI SDK `Output.object` + Zod schema 强制结构化输出
- 识别结果回填到下方共用表单，用户复核后保存

**Tab 2 · 手动录入**
分组表单（商品 / 价格 / 物流 / 备注），保存 `createJapanParcel`，`source = 'manual'`

---

## 七、Server Functions

`src/lib/japan-parcel.functions.ts`
- `listJapanParcels(filters)` / `getJapanParcel(id)` / `createJapanParcel` / `updateJapanParcel` / `deleteJapanParcel` / `bulkUpsertJapanParcels`

`src/lib/meruki.functions.ts`
- `listMerukiAccounts()` —— 返回脱敏列表（不含密码、Cookie）
- `createMerukiAccount({ username, password, displayName })` —— 加密存储 + 立即试登录
- `updateMerukiAccount(id, patch)` / `deleteMerukiAccount(id)`
- `testMerukiLogin(accountId)` —— 仅登录验证
- `syncMerukiOrders(accountId)` —— 登录（必要时复用未过期 Cookie）→ 抓 inProgress 页 → 解析 → upsert 到 `japan_parcels`，写一条 `meruki_sync_runs`
- `listSyncRuns(accountId)`

`src/lib/ai.functions.ts`
- `recognizeParcelScreenshot(imageBase64)`

所有 fn 用 Zod `inputValidator`；密码、Cookie 仅在服务端处理，绝不下发。

---

## 八、meruki 登录与抓取实现

服务端纯 `fetch` 流程（在 Cloudflare Worker SSR 内运行，不引入 Node-only 依赖；DOM 解析用 `linkedom`）：

1. **登录**：POST meruki 登录接口，携带 username/password，捕获响应 `Set-Cookie`。如返回验证码/异常，写入 `last_login_status='captcha'/'failed'` 并返回友好错误（前端提示用户改用手动 / 联系站点）。
2. **缓存 Cookie**：成功后写回 `session_cookie` + `cookie_expires_at`。下次同步先检查未过期则直接复用，过期再重登。
3. **抓取**：GET `https://www.meruki.cn/personal/order/inProgress`（必要时翻页），用 `linkedom` 解析订单卡片 → 字段映射函数 `parseMerukiInProgress(html)`（纯函数，便于后期适配 DOM 变化）。
4. **写库**：`(account_id, source_order_no)` upsert 到 `japan_parcels`，未识别字段保留在 `raw_payload`，计算 `completeness`。
5. **日志**：每次同步写一条 `meruki_sync_runs`。

注意事项已在方案中提示用户：
- meruki 实际登录接口/参数（是否需要 captcha、token、加密签名）需要在实现阶段抓包确认；如站点强制人机验证，将退化为"用户在浏览器登录后导出 Cookie 粘贴"的兜底方式（保留 `meruki_accounts.session_cookie` 字段即可，无需新增字段）。
- 抓取频率默认手动触发；不做定时任务，避免触发风控。

---

## 九、组件复用 / 新增

- 复用：`PageHeader` `StatusBadge` `Timeline` `EmptyState` `DataTable`
- 新增：
  - `ParcelStatusBadge`（7 种状态预设）
  - `CompletenessRing`（recharts RadialBar）
  - `ParcelForm`（新建 / 详情共用）
  - `ScreenshotDropzone`（拖拽 + 粘贴）
  - `MerukiAccountDialog`（账号增改）

---

## 十、范围

**本期交付**
- 3 张数据库表 + pgcrypto 加密 + RLS 开放策略
- 4 个新路由 + 账号管理 + 列表 / 详情 / 新建（手动 + AI）/ 同步导入完整 UI
- meruki 账号密码登录 + 抓取 server fn（真实请求；遇到验证码降级为 Cookie 兜底）
- AI 截图识别 server fn（Lovable AI Gateway，真实可用）

**暂不做**
- 定时自动同步 / Webhook
- 多用户权限隔离
- 与"采购批次"、"物流追踪"模块的数据联动

---

## 十一、需要确认的事项

1. 我会通过 `add_secret` 申请一个 `MERUKI_ENC_KEY`（用于密码列加密）。是否同意？
2. 如果 meruki 登录接口需要图形/滑动验证码，本期降级为"在 meruki 网页登录后粘贴 Cookie"模式可以吗？（账号密码方式作为首选，Cookie 作为兜底）

确认后即开始按顺序实现：迁移 → 加密 helper → meruki 登录抓取 fn → 账号管理页 → 列表页 → 新建（手动+AI） → 详情页。
