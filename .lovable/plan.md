## 目标

在跑完整 AI 识别管线**之前**先轻量提取 `source_order_no`，去 `japan_parcels` 表查一下：
- 命中 → 弹提示"该订单已在 N 月 N 日新建为包裹 #XXXX"，给三个动作：**打开已有包裹** / **仍要重新识别（覆盖）** / **取消**。
- 未命中或用户坚持 → 继续走原识别流程。

覆盖 `/import`（截图批量）和 `/new`（单条 + SmartRecognizePanel）两个入口。

## 改动

### 1. 新增 serverFn `lookupExistingParcelByOrderNo`
文件：`src/lib/japan-parcel.functions.ts`

```ts
input: { order_nos: string[] (1..20) }   // 支持一次查多个
return: { matches: Array<{ source_order_no, id, created_at, status, item_title }> }
```
只 `select id, source_order_no, created_at, status, item_title` from `japan_parcels` where `deleted_at is null and source_order_no in (...)`，1000 行内绰绰有余。

### 2. 预扫订单号 serverFn `peekOrderNo`
文件：`src/lib/recognize.functions.ts`

- **文字模式**：直接复用现有 `segmentParcelText` 里的 `hints.source_order_no` 正则逻辑，抽离成一个纯函数即可，0 token。
- **截图模式**：用最便宜的模型（`gemini-2.5-flash-lite`）只问一句"返回页面上的订单编号 / 注文番号 / 受付番号，没有就 null"，输出 `{ order_no: string|null }`。比完整识别便宜一个数量级。

入参：`{ text?: string, image_base64?: string, mime_type?: string }`，出参 `{ order_no: string | null, source: "regex" | "ai-lite" }`。

### 3. `/purchase/japan-parcel/import` 串预扫
文件：`src/routes/purchase.japan-parcel.import.tsx`

`runParse` 流程改成：
```
peekOrderNo(第一张截图)  ──► lookupExistingParcelByOrderNo
  └─ 命中 → 不调 parseMerukiParcelScreenshots，直接展示
              "已存在包裹 #XXXX（YYYY-MM-DD 建）" 的卡片，三个按钮：
              [打开包裹] [仍要重新识别] [取消]
  └─ 未命中 → 正常调用 parseMerukiParcelScreenshots
```
"仍要重新识别"走原路径，最后还能在审阅页用"覆盖更新"。

### 4. `/purchase/japan-parcel/new` 串预扫
文件：`src/components/japan-parcel/smart-recognize-panel.tsx`

`runPipeline` 开头：先做 `peekOrderNo`（文字模式走 regex；截图模式走 ai-lite）→ `lookupExistingParcelByOrderNo`。命中就在面板里渲染一条 amber 提示带跳转链接 + "仍要识别"按钮，不直接跑 segmentation。

为避免侵入 `SmartRecognizePanel` 现有时间线 UI，把"已存在拦截"渲染成时间线的第 0 步 `已存在订单 #XXXX`（warn 状态，可点击展开看创建时间 / 状态 / 标题），下面跟一个 inline 链接 `打开 →` 和 `继续识别（覆盖）` 按钮。

### 5. 详情/列表的辅助
不动列表。命中后的"打开包裹"链接直接 `/purchase/japan-parcel/$id`。

## 不改动
- 状态字典、RLS、识别管线本身的步骤拆分都不动。
- `importParsedParcel` 已有的 `overwrite` 行为保持现状，预扫只是提前告知，不改写入逻辑。
- 没有 `source_order_no` 的特殊订单（旧数据/没单号）一律走原路径，预扫直接放行。

## 技术细节

- `peekOrderNo` 截图版用 `lovable/gemini-2.5-flash-lite` 调一次即可；temperature 0；强约束 JSON schema 返回。
- 预扫超时设 5s，失败 fallback 到"放行 + 跑完整识别"，绝不阻塞用户主流程。
- 预扫 + 查库一起最多增加 ~1s，远比一次完整识别便宜。
- 不持久化预扫结果。
