# 修正关税/合计的汇率换算方向

## 问题根因

数据库里 `intl_exchange_rate` 存的是 **乘法汇率**（1 JPY = X CNY，例如 `0.0481`），但代码里所有 JPY → CNY 的换算用的都是 **除法** `jpy / rate`，导致结果被放大约 400 倍。

实际样本：关税 JPY = 2,204，正确 CNY ≈ **106 元**，当前显示 ≈ **45,800 元**。

## 修改方案（只改前端计算逻辑，不动数据库、不动字段含义）

统一约定：**`intl_exchange_rate` = 1 JPY 对应的 CNY 金额**，所有 CNY 换算都用乘法 `jpy * rate`。

### 1. `src/lib/japan-parcel.helpers.ts` — `computeGrandTotal`
把：
```
tariffCny = tariffJpy / r
cny = jpy / r + tariffCny
```
改为：
```
tariffCny = tariffJpy * r
cny = jpy * r + tariffCny     // = (jpy + tariffJpy) * r
```
保留 `r > 0` 才返回 CNY 的判断。

### 2. `src/components/japan-parcel/parcel-edit-sections.tsx`
`ParcelEditSections` 和 `ParcelOverviewSections` 里两处局部计算：
- `tariffCny = tariffJpy / rate` → `tariffJpy * rate`
- `suggestedCny / computedCny = jpy / rate + tariffCny` → `jpy * rate + tariffCny`

### 3. `src/routes/purchase.japan-parcel.index.tsx`（列表行兜底计算）
第 ~407 行：
```
(rate > 0 ? (Number(r.tariff_jpy) || 0) / rate : 0)
```
→ `* rate`。同行的 JPY→CNY 兜底如果也是除法，一并改成乘法。

### 4. 占位符 / 提示文案
`parcel-edit-sections.tsx` 中"汇率"字段 Label 可加一行说明文字（hint）："1 JPY = X CNY，例如 0.0481"，避免以后再录反。

## 不改的内容

- 数据库表结构、已存的 `tariff_cny` / `grand_total_cny` 历史数据不回填（用户后续重新保存即可覆盖）。
- 服务端 `japan-parcel.functions.ts` 不变（它不做换算，只透传）。
- 业务口径不变：日本侧 JPY = 商品 + 国际物流；总计 CNY = 日本侧×汇率 + 关税×汇率。

## 验收

录入示例（汇率 0.0481，子单 7725@13% + 6000@20%）后应显示：
- 关税 JPY ≈ ¥2,204
- 关税 CNY ≈ ￥106
- 日本侧 JPY = 商品 + 国际物流
- 合计 CNY = (日本侧 JPY + 关税 JPY) × 0.0481
