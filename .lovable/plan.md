## 目标
1. 拆包单价弹窗里去掉日元显示，只看人民币到手成本
2. 日本小包裹相关页面所有金额前面加币种代码：`JPY 1,800` / `RMB 225.00`
3. 拆包弹窗"单件单位"默认值改为中文"个"

## 改动范围（5 个文件）
- `src/components/japan-parcel/pack-price-calculator-dialog.tsx`
- `src/routes/purchase.japan-parcel.index.tsx`
- `src/components/japan-parcel/parcel-card-dialog.tsx`
- `src/components/japan-parcel/parcel-edit-panel.tsx`
- `src/components/japan-parcel/parcel-edit-sections.tsx`
- 新建/或并入：`src/lib/japan-parcel.helpers.ts` 加两个小 formatter

## 1. 新增统一 formatter（helpers.ts）
```ts
export const fmtJpy = (n: number | null | undefined) =>
  n == null ? "—" : `JPY ${Math.round(Number(n)).toLocaleString()}`;
export const fmtCny = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : `RMB ${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  })}`;
```
规则：JPY 整数，RMB 2 位小数；null 显示 `—`。

## 2. 全局替换
所有 `¥{xxx}` → `fmtJpy(xxx)`；所有 `￥{xxx}` → `fmtCny(xxx)`。
单字段标签（如"到手"、"整件"、"国内运费"）保留中文，只换数字部分。

举例：
- 原 `到手 ￥225` → `到手 RMB 225.00`
- 原 `整件 ¥1,800` → `整件 JPY 1,800`
- 列表里 `￥6.00/张` → `RMB 6.00/张`

## 3. 拆包弹窗专项调整 (`pack-price-calculator-dialog.tsx`)
- 商品概览区：删掉日元，只留 `到手 RMB 225.00`
- 结果区主数字改成 RMB：`RMB 4.51 / 个`，去掉日元那一行
- "单件单位"输入框 `placeholder` 改 `"个 / 张 / 枚"`，保存时若为空 fallback 到 `"个"`；显示 `unit || "个"` 已经是这个逻辑，保留
- 注意：`computePiecePrice` helper 不动，只是 UI 不再读 `pieceJpy`

## 4. 不动的部分
- AI 识别、保存逻辑、数据库字段、`computeParcelItemLanded` / `computePiecePrice` 全部不变
- 其它业务模块（仓库、销售等）此次不动
- import 页 / new 页里的"AI 识别原文回显"等不属于金额展示的地方不改
