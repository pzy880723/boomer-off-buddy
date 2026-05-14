
# 极简方案：截图导入 + 人工维护状态

放弃自动抓取/插件机器人/Cookie 同步那一整套。让一个员工每天花几分钟，把 meruki 后台截图丢进来，AI 解析出订单，状态后续手动点一下就行。

## 一、推荐的截图工具（无需我们开发）

全屏长截图（整页滚动截图），任选其一，都是免费现成的：

- **GoFullPage**（Chrome/Edge 插件，最推荐）— 一键把整个滚动页面拼成一张 PNG，meruki 订单列表再长也能一次抓完。
- **FireShot**（Chrome/Edge/Firefox）— 同类产品，可截整页 / 可见区 / 选区，导出 PNG 或 PDF。
- **Awesome Screenshot**（Chrome/Edge）— 同类，多了标注功能。
- **系统自带**：Mac 用 `Shift+Cmd+5`，Windows 用 Snipping Tool（仅可见区域，订单多时不够用）。

员工日常只需要：打开 meruki 订单列表 → GoFullPage 一键截图 → 拖进我们后台。**不用安装我们自己的插件，不用配 cookie，不用守着电脑。**

## 二、后台改造（只动前端 + 一个 AI 解析接口）

现在的"AI 识图"入口只能识别**单个订单**。改成支持**整页订单列表截图批量解析**：

1. **新页面 `/purchase/japan-parcel/import`**
   - 一个大拖拽区，可一次丢 1~N 张截图（合并订单的详情页也支持）
   - 每张图旁边显示一个状态：解析中 / 已识别 X 条 / 失败
   - 解析完成后出一个**预览表格**：
     - 每行一条订单（订单号、标题、卖家、金额、日期）
     - 左侧 checkbox（默认全选）
     - 右侧"是否已存在"标记（按 `source_order_no` 去重，已存在的默认不勾）
   - 底部按钮：「导入选中的 N 条」

2. **AI 解析接口** `parseMerukiListScreenshot`（server function）
   - 复用现有 `recognizeParcelScreenshot` 的 Lovable AI Gateway 通道
   - 模型用 `google/gemini-2.5-pro`（多订单+长截图需要强视觉）
   - Prompt 让模型**返回订单数组**而不是单条，schema：`{ orders: [{ source_order_no, item_title, seller, price_jpy, purchased_at, status_text, ... }] }`
   - 同时支持"合并订单详情截图" → 返回父订单 + 子订单数组

3. **去重 & 落库**
   - 按 `(account_id 可空, source_order_no)` 唯一判重
   - 已存在的订单：可选"覆盖字段"或"跳过"
   - 新订单：直接 insert 到 `japan_parcels`，初始 `status='purchased'`（已采购）

## 三、状态人工维护

订单列表页和详情页加一个**状态快捷切换**，不用进编辑表单：

- 列表页每行的状态徽章变成可点的下拉：已采购 → 日本仓已入库 → 国际运输中 → 已签收 → 已完成
- 详情页顶部加一排大按钮："标记为已入库" / "标记为运输中" / "标记为已签收"
- 每次改状态写一条 `notes`（时间戳 + 旧状态 → 新状态），方便回溯

状态字典精简成员工看得懂的 5 档（不再纠结 meruki 内部那十几种状态）：
1. 已采购 `purchased`
2. 日本仓已入库 `at_jp_warehouse`
3. 国际运输中 `shipping_intl`
4. 已签收 `delivered`
5. 已完成/已上架 `completed`

## 四、要砍掉/搁置的东西

- ❌ Chrome 插件（`extension/` 目录）— 不再推给员工装，代码可以保留但从 UI 上撤掉入口
- ❌ "从 meruki 同步"按钮（列表页右上角那个下拉）
- ❌ `meruki_accounts` / `meruki_raw_captures` / `meruki_sync_runs` 三张表 — 不删，留作将来万一回到自动方案；但 UI 上隐藏"账号管理"入口
- ❌ 自动翻页 / 自动去重抓取 / 子订单识别引擎 — 全部不做了

## 五、改动范围

```
新增：
  src/routes/purchase.japan-parcel.import.tsx    截图批量导入页
  src/lib/meruki-parse.functions.ts              AI 解析 server fn（列表 / 详情两种 prompt）

改：
  src/routes/purchase.japan-parcel.index.tsx     去掉"从 meruki 同步""账号管理"按钮，
                                                  把"AI 识图"改成跳到新的批量导入页；
                                                  状态列改成可点下拉
  src/routes/purchase.japan-parcel.$id.tsx       顶部加状态快捷按钮
  src/lib/japan-parcel.helpers.ts                状态字典精简到 5 档
```

数据库：**无 schema 变更**，沿用现有 `japan_parcels` 表。

## 六、员工日常 SOP（最终用户视角）

1. 早上打开 meruki 后台 → 滚到订单列表底部 → 点 GoFullPage 截图
2. 打开我们后台 → 「日本小包裹 → 截图导入」→ 拖入截图
3. 等 10 秒，看预览表格，确认没问题 → 点「导入」
4. 包裹到了 → 在订单列表点状态下拉 → 改成"已签收"

全程不用懂任何技术，不用守电脑，不用装我们的插件。

---

确认后我就按这个方案改。也想问一句：**meruki 后台同一页能显示多少条订单？**（决定一张长截图大概装多少条，影响 AI prompt 的 token 预算和我们要不要做"分页截图合并"）
