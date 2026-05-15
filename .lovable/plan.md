## 目标

让"合计费用"自动计入 **关税** 与 **子订单运费补差**：

1. AI 识别每个子订单的商品类目，归入三档行邮税率（13% / 20% / 50%）。
2. 根据"商品费用 CNY"× 税率算出每个子订单的关税，汇总成包裹关税。
3. 合计费用 = 商品总额 + 国际物流小计 + **Σ运费补差** + 关税。
4. 子订单卡片与编辑面板显示类目与税率，并允许人工修正。

## 一、数据库

新增两列（`japan_parcel_items`）：

```sql
alter table public.japan_parcel_items
  add column tariff_category text,        -- 'snack' / 'clothing' / 'cosmetics_high' 等枚举字符串
  add column tariff_rate numeric;         -- 0.13 / 0.20 / 0.50（冗余存储，便于历史回溯）
```

`japan_parcels.tariff_jpy` / `tariff_cny` 已存在，沿用作为汇总结果。

## 二、税率字典（前后端共用）

新建 `src/lib/tariff.ts`：

- `TARIFF_TIERS`：三档定义（rate + label + 颜色）。
- `TARIFF_CATEGORIES`：约 20 个常见类目，每个含 `key / label / tier`，例如：
  - 13%：零食 / 保健品 / 药品 / 书籍 / CD-DVD / 玩具手办 / 普通小家电 / 游戏机 / 电脑配件
  - 20%：服装 / 鞋 / 包 / 普通手表 / 美容仪 / 数码相机 / 耳机 / 运动用品 / 文具
  - 50%：化妆品护肤品（高档）/ 香水 / 烟酒 / 高档手表
- `getTariffRate(category)` 工具函数。

## 三、AI 识别 serverFn

新建 `src/lib/tariff.functions.ts` 中 `classifyItemsTariff`：

- 输入：`{ items: { id, item_title, item_title_cn }[] }`。
- 走 Lovable AI Gateway `google/gemini-2.5-flash`，结构化输出 `[{id, category, rate, reason}]`，prompt 内嵌完整类目字典与三档税率说明，要求只能从枚举中选。
- handler 内批量 `update japan_parcel_items set tariff_category, tariff_rate`。
- 返回写入结果。

## 四、关税与合计计算

在 `src/lib/japan-parcel.helpers.ts` 加入纯函数：

```ts
computeItemTariffJpy(item)      // item_total_jpy * tariff_rate
computeParcelTariff(items, rate) // 汇总 JPY + CNY
computeParcelGrandTotal({
  itemsTotalJpy, intlTotalJpy, freightDiffTotalJpy, tariffJpy, rate
}) // 返回 {jpy, cny}
```

`ParcelEditSections` 的"建议值"改为：

```
suggestedJpy = 商品总额 + 国际物流小计 + Σ运费补差 + 关税
```

并新增展示行"运费补差合计 / 关税合计"。

## 五、UI 改动

1. **子订单卡片（编辑面板 + 概览）**
   每行多一行：`类目: 玩具/手办  税率: 13%  关税 ≈ ¥xxx`。
   类目可在编辑弹窗"① 商品"段下拉选择（来自 `TARIFF_CATEGORIES`），手动改后 `tariff_rate` 自动同步。

2. **包裹工具条**
   "保存"旁加按钮 **"AI 识别关税类目"**：调用 `classifyItemsTariff` → 成功后 invalidate 查询。空结果时按钮 disable 并提示"无子订单"。

3. **④ 合计费用** 段
   - 增加只读行：`运费补差合计 ¥…`、`关税 ¥…（按子订单税率汇总）`。
   - "使用建议值"按钮包含新公式结果，并把 `tariff_jpy` / `tariff_cny` 也写回 form。

## 六、技术细节

- 关税 CNY = 关税 JPY / `intl_exchange_rate`（与现有合计同源）。
- 若某子订单没有 `tariff_rate`，关税按 0 计，UI 标灰显示"未识别"。
- AI 识别只读取 `item_title` / `item_title_cn`，不发送图片，控制成本。
- 运费补差合计取自 `Σ items[i].freight_diff_jpy`，与已有 `intl_total_jpy` 不重复（`intl_total_jpy` 为国际物流商汇总，补差是子订单层）。
- `ItemUpdateSchema` 增加 `tariff_category` / `tariff_rate` 可选字段，编辑面板保存时一并提交。
- 不动现有"新建包裹"识别管线；新包裹保存后用户点一次"AI 识别关税类目"即可。

## 影响文件

- 新建：`src/lib/tariff.ts`、`src/lib/tariff.functions.ts`
- 迁移：`japan_parcel_items` 加两列
- 修改：`japan-parcel.functions.ts`（Schema + listJapanParcels select 增加 tariff_*）、`japan-parcel.helpers.ts`、`parcel-edit-sections.tsx`、`parcel-edit-panel.tsx`、`parcel-card-dialog.tsx`、`ItemEditForm`
