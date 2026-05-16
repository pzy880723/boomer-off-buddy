## 目标

商品维度列表中，每个商品显示**完整到手价（CNY）**，悬停弹出明细。

## 计算口径（每个子商品）

- **商品金额 JPY** = `item_total_jpy`（缺失时回退 `unit_price_jpy * quantity`）
- **均摊国际运费 JPY**：按子商品**重量**占比分摊
  - 权重 = `weight_g`
  - 若该子单 `weight_g` 缺失，按"包裹总重 / 子单数 × 子单 quantity"做兜底
  - 若整包所有子单 `weight_g` 都缺失，则等分（按子单数量）
  - `share_i = intl_total_jpy × weight_i / Σ weight`
- **小计 JPY** = 商品金额 + 均摊运费
- **小计 CNY** = 小计 JPY × `intl_exchange_rate`
- **关税 CNY** = `item_total_jpy × tariff_rate × intl_exchange_rate`（按商品价格计税，不含运费；无 rate 或汇率时为 0）
- **到手价 CNY** = 小计 CNY + 关税 CNY

实现：在 `src/lib/japan-parcel.helpers.ts` 新加纯函数 `computeItemLandedCny(item, parcel, allItems)`，返回：
```
{ itemJpy, freightShareJpy, itemCny, freightShareCny, tariffCny, landedCny, rate }
```
均摊一次性算好整包的权重数组，避免循环里重复求和（在调用处把每个商品的结果缓存到 `Map<itemId, ...>`）。

## 列表 UI（`src/routes/purchase.japan-parcel.index.tsx`，仅 `viewMode === "item"` 分支）

1. 合计单元格只显示一个值：`￥{Math.round(landedCny).toLocaleString()}`，去掉双币显示，忽略 `currency` 偏好。
2. 用 `HoverCard` 包裹金额（参考 `ItemsHoverPreview`，openDelay≈150），悬停弹出明细：
   ```
   商品金额        ￥xxx
   均摊运费        ￥xxx   （按重量分摊）
   关税(rate%)     ￥xxx
   ────────────
   到手价          ￥xxx
   ```
   - 关税行：`tariff_rate` 为空时灰字"未设置"，金额 0
   - 汇率缺失：hover 卡显示"缺少汇率，无法换算 CNY"，列表单元格显示 `—`
3. 排序/表头不动。

## 不动的部分

- 包裹维度保持现状
- 数据库、serverFn、其他页面不动

## 影响范围

- `src/lib/japan-parcel.helpers.ts` 新增 `computeItemLandedCny`
- `src/routes/purchase.japan-parcel.index.tsx` 改 `viewMode === "item"` 分支金额单元格
