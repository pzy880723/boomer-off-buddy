## 思路

做一个浏览器插件，**当你打开 meruki 任意页面时，它在后台静默抓取所有订单相关的 JSON 响应，自动 POST 到我们系统**。你不用找接口、不用粘 Cookie、不用手动同步——打开页面就完事。

```text
[meruki 页面]
     │  浏览器自然加载订单 JSON
     ▼
[Chrome 插件 content script]  ← 拦截 fetch/XHR
     │  挑出 url 含 order/list/parcel 的 JSON 响应
     ▼
POST  https://<你的项目>.lovable.app/api/public/meruki-ingest
      Header: X-Ingest-Secret: <共享密钥>
      Body:   { account_id, source_url, payload }
     │
     ▼
[后端] 入库 japan_parcels（raw_payload 全存，字段尽力映射）
```

## 我会做的事

### 1. 数据库（migration）
- `meruki_accounts` 表：新增 `ingest_token`（uuid），用于插件按账号绑定上报。每个账号一个唯一 token。
- `japan_parcels` 表：已有 `raw_payload jsonb`，复用即可。

### 2. 后端公开接口 `src/routes/api/public/meruki-ingest.ts`
- `POST` 接收 `{ ingest_token, source_url, payload }`
- 用 `ingest_token` 反查 `account_id`，token 不存在直接 401
- 把 `payload` 整体存进 `japan_parcels.raw_payload`，并尽力解析常见字段（`orderNo/orderId/itemTitle/price/img/seller/status` 等），按 `(account_id, source_order_no)` upsert
- 写一条 `meruki_sync_runs` 记录，状态 success / fetched_count
- **新格式不认识也不报错** —— 全量原始数据已存，后续再加映射

### 3. Chrome 插件（放在 `extension/` 目录）
文件结构：
```text
extension/
├── manifest.json          # MV3，permissions: storage, scripting, host: https://*.meruki.cn/*
├── content.js             # 注入到 meruki 页面
├── inject.js              # 真正在页面上下文里 patch fetch+XHR（content script 拿不到响应体，必须 inject）
├── popup.html / popup.js  # 设置：API 基地址 + ingest_token
├── background.js          # 转发 inject → fetch 上报（绕过 CORS）
└── icon.png
```

工作流程：
1. `inject.js` 在 meruki 页面里 monkey-patch `window.fetch` 和 `XMLHttpRequest`
2. 响应是 JSON 且 URL 路径匹配 `/order|parcel|package|inProgress|buy/i` → 把 `{url, body}` 通过 `window.postMessage` 发给 content script
3. content script 转发给 background service worker
4. background 用配置好的 token POST 到我们的 `/api/public/meruki-ingest`
5. popup 显示"今天已上报 N 条 / 上次成功时间"

### 4. 打包 + 下载
- 用 `nix run nixpkgs#zip` 打包到 `public/meruki-ingest-extension.zip`
- 在 `accounts.tsx` 顶部加一张卡片：
  - "下载浏览器插件"按钮（fetch+blob 触发下载）
  - 4 步安装说明（解压 → chrome://extensions → 开发者模式 → 加载已解压扩展程序）
  - 每个账号行多一列「上报令牌」，点一下复制，让用户粘到插件 popup 里

### 5. UI 调整
- "测试 Cookie"和"立即同步"按钮隐藏（不再需要 Cookie 路径，但保留代码以防回退）
- 同步状态新增一行说明："请保持插件已安装，并定期打开 meruki 进行中订单页"
- "新增账号"对话框去掉 Cookie 必填，改回只要用户名 + 备注名即可

## 不在本次范围

- Cookie 抓取路径（保留代码，但 UI 不主推）
- 订单详情页深度抓取（v2 再加，先把列表跑稳）
- 自动定时拉取（meruki 必须用户主动打开页面才会触发；插件本身不能后台访问 meruki）

## 验收标准

1. 用户在系统里：新增账号 → 复制上报令牌 → 装插件 → 把令牌粘到 popup
2. 用户打开 meruki "进行中订单"页面 → 几秒后系统订单列表自动出现新数据
3. 失败时插件 popup 显示原因（401 token 错、网络错等），系统日志页能看到失败的 sync run

---

要我按这个开干吗？需要你确认一件事：**插件抓到数据的"上报终点"该用哪个 URL？** 我建议用 `https://project--2158bffa-7f82-4bc6-9df9-c59319d262f7.lovable.app`（稳定的预览地址），等你正式发布后我再让插件支持自定义 baseUrl。
