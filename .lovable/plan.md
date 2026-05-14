
## 问题
新建包裹页（`/purchase/japan-parcel/new`）的"子订单"区共维护 **16 个字段**，但包裹卡片里展示和编辑都缺了一大半：

| 字段 | 数据库 | 新建页 | 卡片·概览 | 卡片·编辑 |
|---|---|---|---|---|
| sub_order_no（订单编号） | ✅ | ✅ | ✅ | ❌ |
| merchant_order_no（商户订单号） | ✅ | ✅ | ❌ | ❌ |
| item_title / item_title_cn | ✅ | ✅ | ✅ | ✅ |
| item_image_url | ✅ | ✅ | ✅ | ✅ |
| item_total_jpy / item_total_cny | ✅ | ✅ | ✅ | ✅ |
| unit_price_jpy（商品价格） | ✅ | ✅ | ✅ | ✅ |
| quantity（数量） | ✅ | ✅ | ✅ | ✅ |
| weight_g（入库重量） | ✅ | ✅ | ✅ | ✅ |
| exchange_rate（结算汇率） | ✅ | ✅ | ❌ | ❌ |
| service_fee_jpy（手续费） | ✅ | ✅ | ❌ | ❌ |
| domestic_freight_jpy（日本国内运费） | ✅ | ✅ | ❌ | ❌ |
| freight_diff_jpy（运费补差） | ✅ | ✅ | ❌ | ❌ |
| pay_method（支付方式） | ✅ | ✅ | ❌ | ❌ |
| pay_at（支付时间） | ✅ | ✅ | ❌ | ❌ |
| condition（成色） | ✅ | — | ❌ | ❌ |
| source_platform / addon_service / notes | ✅ | — | ❌ | ❌ |

## 改动范围

### 1. `src/lib/japan-parcel.functions.ts` — 扩展 `ItemUpdateSchema`
当前只允许更新 11 个字段，缺 `sub_order_no`、`merchant_order_no`、`exchange_rate`、`pay_method`、`pay_at`、`source_platform`、`condition`、`addon_service`、`item_price_jpy`。补齐为可选 nullable，让卡片编辑能保存所有字段。

### 2. `src/components/japan-parcel/parcel-edit-panel.tsx`
- `ItemRow` 类型补齐全字段（sub_order_no / merchant_order_no / exchange_rate / service_fee_jpy / domestic_freight_jpy / freight_diff_jpy / pay_method / pay_at / source_platform / condition / addon_service / notes / item_price_jpy）。
- `itemSaveMut.mutationFn` 提交时把全部字段一并传给 `updateParcelItem`。
- 列表行 `itemsSlot` 新增一行密排显示：手续费 / 国内运费 / 运费补差 / 支付方式 / 支付时间 / 商户单号，让看一眼就知道有没有数据。
- 重写"编辑子订单"弹窗：按 4 段分组（① 商品 / ② 价格与汇率 / ③ 物流与重量 / ④ 支付与单号），保持与新建页一致的字段集与顺序。弹窗加大到 `max-w-2xl`，2 列网格。

### 3. `src/components/japan-parcel/parcel-card-dialog.tsx` — `OverviewItems`
重排子订单卡片为分组展示，把缺的字段全部显示出来（"—"占位）：
```text
[图]  #1 · sub_order_no                     小计 ¥xxx ≈ ￥xxx
      商品标题（中） / 日文标题
      ─────────────────────────────────────────────
      单价 ¥…  × 数量 …  · 重量 …g  · 汇率 …
      手续费 ¥…  · 国内运费 ¥…  · 运费补差 ¥…
      支付 …  / 支付时间 …  · 商户单号 …
```
保留双列 `md:grid-cols-2`；移动端单列。

### 4. （可选）`ParcelCardItem` 接口同步
`src/components/japan-parcel/parcel-card-dialog.tsx` 里 `ParcelCardItem` 增补这些可选字段，让 TS 通过；运行时数据本来就在 `q.data.items` 里返回。

## 不动的部分
- 数据库 schema、RLS、迁移：所有字段已存在，无需 migration。
- `getJapanParcel` 已 `select("*")`，无需改。
- 新建页 `/purchase/japan-parcel/new` 不动。
- 概览的 ① 包裹信息 / ② 国际物流费用明细 / ④ 合计 区块布局不动。

## 验证
- 打开任意包裹卡片 → 概览：每张子订单卡片都出现新的两行（费用 / 支付）。
- 点击"编辑" → 子订单弹窗：4 段分组、所有字段可改、保存后数据回填。
- 与 `/purchase/japan-parcel/new` 字段对照：完全对齐。
