## 现状盘点

合计费用应包含 4 项：**商品总额 + 国际物流小计 + Σ运费补差 + Σ关税**。
排查后发现三处口径不一致：

| 位置 | 商品额 | 国际物流 | 运费补差 | 关税 | 备注 |
|---|---|---|---|---|---|
| `parcel-edit-sections.tsx`（编辑/概览） | ✅ | ✅ | ✅ | ✅ 按子订单 `tariff_rate` | **正确** |
| `purchase.japan-parcel.new.tsx`（新建页） | ✅ | ✅ | ❌ 漏算 | ❌ 用全局 `TARIFF_RATE = 0`，忽略 AI 识别的子订单类目税率 | CNY 还写错成 `*rate`（应为 `/rate`） |
| `purchase.japan-parcel.index.tsx`（列表行兜底） | ✅ | ✅ | ❌ 漏算 | ✅ 用已存的 `r.tariff_jpy` | 仅当包裹未保存 `grand_total_jpy` 时走兜底；当前列表 select 也没拉 `freight_diff_jpy` |

## 修复方案

### 1. 新建页 `purchase.japan-parcel.new.tsx` 重写 totals
- 删除 `TARIFF_RATE` 常量
- 复用 `sumTariffJpy` / `sumFreightDiffJpy` / `computeGrandTotal`（来自 `japan-parcel.helpers.ts`）
- 公式：`grandJpy = itemsTotalJpy + intlTotalJpy + freightDiffJpy + tariffJpy`
- 修正 CNY：`grandJpy / rate`（汇率是 JPY/CNY，不是 CNY/JPY）
- 底部"+ 关税（0%，可后续配置）"一行改为按子订单分类税率合计 + 单独显示运费补差合计

### 2. 新建页保存时也写入 `freight_diff` 已经在 items 里，无需改库
保存逻辑保持把 `tariff_jpy / grand_total_*` 一起写入即可（已带 `freight_diff_jpy` 在每条 item 里）。

### 3. 列表行 `purchase.japan-parcel.index.tsx` 兜底公式补 `freight_diff`
- `listJapanParcels` select 增加 `freight_diff_jpy` 到 items（影响一点点 payload 体积，可接受）
- 兜底公式改为：`subSumJpy + intl_total_jpy + Σfreight_diff + tariff_jpy`
- 已保存 `grand_total_jpy` 的行依然优先用存量值

### 4. （可选）保存触发器
新建页默认调用 `classifyItemsTariff` 后端分类一次，确保 `tariff_rate` 已写入再算合计；如果用户跳过 AI，关税就为 0（与编辑页行为一致）。

## 受影响文件

- `src/routes/purchase.japan-parcel.new.tsx`
- `src/routes/purchase.japan-parcel.index.tsx`
- `src/lib/japan-parcel.functions.ts`（list select 加字段）

不动后端 schema、不动编辑/概览页（已经正确）。
