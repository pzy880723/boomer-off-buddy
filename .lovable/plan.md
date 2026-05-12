## 目标

把 meruki 抓取从"伪装登录 + HTML 解析"改成"用户粘贴 Cookie + 直接调 meruki 真实 JSON 接口"，让同步真正能跑通。

## 你需要先做的事（关键，没有这步我做不下去）

请在已登录的 meruki 浏览器窗口里：

1. F12 打开开发者工具 → 切到 **Network** 面板 → 勾选 **Fetch/XHR** 过滤
2. 在 meruki 站点点开"**进行中的订单**"页面（或刷新一下）
3. 找到返回订单列表 JSON 的那条请求（通常 URL 里带 `order`、`list`、`inProgress` 之类关键字，Response 里能看到订单数据）
4. 在那条请求上 **右键 → Copy → Copy as cURL (bash)**，粘贴给我

我需要从中拿到：
- 真实接口 URL 和请求方法（GET/POST）
- 请求参数（query 或 body，例如分页、状态码）
- 响应 JSON 的字段结构（订单号、标题、图片、卖家、价格、状态、仓库等）

如果有多个相关接口（比如列表 + 详情），都给我。

## 我会做的代码改动

### 1. `src/lib/meruki.server.ts`
- 新增 `fetchInProgressOrdersApi(cookie)`：直接 `fetch` 你给的 JSON 接口，带上必要的 Header（`Cookie`、`Referer`、`User-Agent`、可能的 `X-Requested-With` / `Content-Type`）
- 用 `response.json()` 取数，按真实字段映射到我们的 `ScrapedParcel`
- 保留旧的 `fetchInProgressOrders`（HTML 版）作为 fallback，但默认不走
- HTTP 非 2xx 或返回 `code != 0` / `登录失效` 时，抛出明确错误："Cookie 已失效，请到账号管理重新粘贴"

### 2. `src/lib/meruki.functions.ts`
- `syncMerukiOrders` 改为调用新的 JSON 版本
- **移除 `loginMeruki` 自动登录回退**：Cookie 不存在/失效时不再尝试用密码登录（反正成功不了），直接报错让用户重新粘贴 Cookie
- 同步失败且原因含"登录失效/未登录"时，把账号 `last_login_status` 标成 `cookie_expired`，前端就能明显提示

### 3. `src/routes/purchase.japan-parcel.accounts.tsx`
- "新增账号"对话框：把"密码"字段降级为可选/隐藏，主推"用户名 + Cookie"
- 移除/隐藏"测试登录"按钮（`testMerukiLogin`），改成"测试 Cookie"按钮 —— 直接用当前 Cookie 调一次列表接口，能拿到数据就算 OK
- 账号列表里 `last_login_status === 'cookie_expired'` 时显示醒目的"Cookie 已失效，点编辑更新"提示

### 4. 字段对齐
拿到真实 JSON 后，我会把 meruki 的字段（例如 `orderNo`、`goodsName`、`goodsImg`、`sellerName`、`price`、`statusText`、`warehouseName`）映射到我们 `japan_parcels` 表已有的列，并更新 `mapMerukiStatus` 的状态匹配（用真实状态码而不是关键字猜）。

## 不在本次范围内的事

- 自动登录（瑞数风控 + 滑块 + Workers 不能跑 Playwright，做不了，不再尝试）
- Cookie 自动续期（meruki 没给我们刷新接口，只能用户手动更新）
- 订单详情抓取（先把列表跑通，详情等列表稳定后再加）

## 验收标准

- 在账号管理粘贴一次有效 Cookie 后，点"立即同步"能在 `japan_parcels` 表里看到真实订单数据
- Cookie 过期后，同步失败信息明确指向"重新粘贴 Cookie"，不再是 `fetch failed` 这种模糊错误

---

**等你把那条 XHR 的 cURL 贴过来，我就开工。**
