## 背景

你确认：`intl_total_jpy`（国际物流小计）里**已经包含**了国际运费、包装/加固/手续费、以及日本国内运费补差（freight_diff）。所以之前我把 `Σfreight_diff_jpy` 再叠加到合计里，是**重复计算**了。

关税仍然需要单独算（按子订单的 `tariff_rate`），并按汇率换算成 CNY，再合到最终合计。

## 新口径（统一三个视图）

```
合计 JPY = Σ商品小计(item_total_jpy)
        + 国际物流小计(intl_total_jpy)
        + 关税(Σ item_total_jpy × tariff_rate)

合计 CNY = 合计 JPY / 汇率(intl_exchange_rate)
关税 CNY = 关税 JPY / 汇率
```

不再出现 `freight_diff` 相关的合计行。

## 需要改的地方

### 1. `src/lib/japan-parcel.helpers.ts`
- `computeGrandTotal({...})`：移除 `freightDiffJpy` 入参与累加。
- 保留 `sumFreightDiffJpy`（明细行还会用，但不再进合计），或顺手删掉——倾向**保留**，避免多文件改动。

### 2. `src/components/japan-parcel/parcel-edit-sections.tsx`
两个组件都改：
- `ParcelEditSections`（编辑视图 ④ 合计费用）：
  - 移除 `freightDiffJpy` prop。
  - "建议值" 公式改为 `items + intlTotal + tariff`。
  - 底部 4 列指标网格删掉「运费补差合计」，改成 3 列：商品总额 / 国际物流小计 / 关税（含 CNY）。
- `ParcelOverviewSections`（详情只读视图 ④）：同上，删除「运费补差合计」列与公式中的 `freightDiffJpy`。
- 关税那一栏同时显示 `¥xxx ≈ ￥xxx`（按 `intl_exchange_rate` 换算）。

### 3. `src/components/japan-parcel/parcel-edit-panel.tsx`（调用方）
不再向 `ParcelEditSections / ParcelOverviewSections` 传 `freightDiffJpy`。

### 4. `src/routes/purchase.japan-parcel.new.tsx`（新建页 ④ 合计）
- 移除 `sumFreightDiffJpy` 调用与 `freightDiffJpy` 变量。
- `computeGrandTotal` 不传 `freightDiffJpy`。
- "费用明细" 卡片删除「运费补差」一行，保留：商品总额 / 国际物流 / 关税（JPY + CNY）/ 合计（JPY + CNY）。

### 5. `src/routes/purchase.japan-parcel.index.tsx`（列表行 fallback 合计）
当行未保存 `grand_total_jpy` 时的 fallback 公式：
```
totalJpy = Σitem_total_jpy + intl_total_jpy + Σ(item_total_jpy × tariff_rate || 已存的 tariff_jpy)
```
即从 `items.reduce` 中**去掉** `freight_diff_jpy` 一项。
（顺带：列表 select 之前为支持补差合计加上了 `freight_diff_jpy`，可保留，不影响。）

## 不动的部分

- 数据库字段不动（`freight_diff_jpy` 仍按需录入，只是不进最终合计）。
- 子订单编辑表单仍保留「日本国内运费补差」字段，方便人工核对/审计，但不再展示"补差合计"，也不进合计公式。
- 关税分类（`classifyItemsTariff` serverFn）逻辑不动。

## 验收

- 编辑视图 ④：建议值 = 商品 + 国际物流 + 关税；点「使用建议值」写入 `grand_total_jpy/cny` 与 `tariff_jpy/cny`。
- 详情只读 ④：4 列变 3 列，无「运费补差合计」。
- 新建页右侧 ④：无「运费补差」，关税同时给 CNY，合计 CNY = 合计 JPY / 汇率。
- 列表行未保存合计的 fallback 数值与上述一致。
