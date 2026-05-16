## 目标

把包裹维度（`viewMode === "parcel"`）的金额单元格改成与商品维度一致的体验：只显示一个 CNY 合计，悬停弹出明细；同时把标题下面那行的「源订单号」换成「物流单号」。

## 改动 1：合计列改为 CNY + 悬停明细

文件：`src/routes/purchase.japan-parcel.index.tsx`（行 ~561 起的 parcel 分支金额单元格）

明细口径（基于已有数据）：
- 商品合计 CNY = Σ item_total_jpy × intl_exchange_rate
- 国际运费 CNY = intl_total_jpy × intl_exchange_rate
- 关税 CNY = tariff_cny（或 tariff_jpy × rate 兜底，已有逻辑）
- 到手价 CNY = 商品 + 运费 + 关税（= 现有 totalCny）

UI：
- 单元格只展示 `￥{Math.round(totalCny).toLocaleString()}`，去掉双币显示，忽略 currency 偏好
- 用 `HoverCard`（与商品维度同样的样式）包裹，hover 弹出 4 行明细：商品合计 / 国际运费 / 关税 / 到手价
- 汇率缺失（rate <= 0）：单元格显示「缺少汇率」灰字，无 hover
- 包裹合计逻辑复用现有 `totalJpy`/`totalCny`/`tariffCny` 变量，无需再算

## 改动 2：列表用「物流单号」替换「源订单号」

同一文件，parcel 分支标题区（行 ~589）：
```
<div className="mt-0.5 text-xs text-muted-foreground">
  {r.source_order_no || "—"}
</div>
```
→ 改为渲染 `r.tracking_no`，并加复制按钮（点击复制单号、toast 提示），无 tracking_no 时显示 `—`。

`ParcelRow` 类型新增 `tracking_no?: string | null`（数据库已存在该字段，`listJapanParcels` 的 select 是 `*`，应该已经返回；确认后类型加上即可）。

商品维度行内"包裹 {source_order_no}"的小标也同步改成 "包裹 {tracking_no || source_order_no || id.slice(0,8)}"，让两个维度一致。

## 不动的部分

- 数据库、serverFn、其他页面不动
- 商品维度的金额单元格已完成，不再改
- 排序/筛选/搜索逻辑保持现状（搜索仍可命中 source_order_no，因为它在 listJapanParcels 的 ilike 里）

## 影响范围

- `src/routes/purchase.japan-parcel.index.tsx` 一个文件
