# 修复包裹卡片缺失字段 + 全面升级

## 根因

列表接口 `listJapanParcels` 为了首屏性能只 select 了一部分列，**没有** `receiver_name / receiver_phone / receiver_address / notes / warehouse_location / intl_photo_fee_jpy / intl_keep_packaging_jpy / intl_points_used / intl_ship_method / intl_charge_method / intl_pay_method / intl_pay_at / intl_merchant_order_no` 等字段。`ParcelCardDialog` 的"概览"直接拿列表行渲染，所以这些字段一律显示 "—"。"编辑"页用的是 `ParcelEditPanel` 单独 fetch 的完整行，所以看起来"编辑里有，概览里没有"。

## 方案

不动列表 select（保持首屏快），改成**打开弹窗时按 id 拉一次完整行**，概览和编辑共用同一份完整数据。

### 1. `parcel-card-dialog.tsx`

- 用 `useQuery(['japan-parcel', id], () => getJapanParcel({ data: { id } }))` 在 dialog 打开时拉完整 parcel + items
- 概览 tab 渲染 `data.row`（完整字段）+ `data.items`（完整 item 字段，含 weight_g、unit_price_jpy、quantity）
- 加载时显示 skeleton；fallback 用列表传入的 `parcel` 先垫一下，避免闪烁
- 删除 `parcel` / `items` props 的强依赖（保留作为 initial placeholder）

### 2. `parcel-edit-panel.tsx`

- 编辑成功后 `invalidateQueries(['japan-parcel', id])`，让概览同步刷新
- 删除子订单/编辑子订单后同样 invalidate

### 3. 概览展示完善（`parcel-edit-sections.tsx` `ParcelOverviewSections`）

当前 `ReadGrid` 已经覆盖 PARCEL_INFO / INTL_FEE 全部字段，只要数据传进来就会显示。无需结构改动，只需确认：
- `receiver_address` 在 PARCEL_INFO 里 colSpan=3 ✅
- `notes` 在 PARCEL_INFO 里 colSpan=3 ✅
- 子订单卡片增加：重量（g）、子订单号（已有）

### 4. 子订单展示小升级（`OverviewItems`）

- 加一行展示 `重量 / 数量 / 单价` 三列对齐
- 没有图片时放占位图标，不要纯灰块

## 涉及文件

- `src/components/japan-parcel/parcel-card-dialog.tsx` — 加 useQuery 拉完整数据，概览改用完整 row
- `src/components/japan-parcel/parcel-edit-panel.tsx` — 保存/删除后 invalidate `['japan-parcel', id]`

不改：列表 select、数据库、ParcelForm、ParcelEditSections 结构。
