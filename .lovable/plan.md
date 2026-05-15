## 目标

包裹列表里"采购时间"实际上来自国际物流的支付时间（`intl_pay_at`）。把这个字段明确化、可排序，并把列表升级为支持「包裹维度 / 商品维度」两种展示模式，同时去掉来源相关的 UI。

## 一、数据层（无需建表）

`japan_parcels.intl_pay_at` 字段已存在，无需迁移。只动 serverFn：

1. `listJapanParcels`（`src/lib/japan-parcel.functions.ts`）
   - SELECT 增补 `intl_pay_at`。
   - 增加可选入参 `sort: { field: 'intl_pay_at' | 'grand_total_cny' | 'created_at'; dir: 'asc' | 'desc' }`，默认 `{ field: 'intl_pay_at', dir: 'desc' }`。
   - `intl_pay_at` 排序时使用 `nullsLast`（避免没付款的包裹冒到顶）。

2. 新建 / 编辑包裹时已经有 `intl_pay_at` 字段（保存逻辑不动），只需确认 AI 识别（`recognize.functions.ts`）会把"国际支付时间"写入 `intl_pay_at`。如缺失则在后处理里补一行映射。

## 二、列表 UI（`src/routes/purchase.japan-parcel.index.tsx`）

### 2.1 删除"来源"
- 删除工具栏里"来源"下拉过滤及其 state（`sources`、`toggleSource`）。
- 删除"订单 / 标题"单元格下方的 `· Meruki / · 手动录入` 文案，只保留 `source_order_no`。
- `listJapanParcels` 的 `source` 入参一并去掉。

### 2.2 表头排序
- 将"合计"、"支付时间"两个表头做成可点击按钮：
  - 点击循环：`desc → asc → desc`。
  - 当前激活列旁显示 ↑/↓ 图标，其它列显示淡色 ⇅。
- 默认 `intl_pay_at desc`。
- 排序状态保存在组件 state，传给 serverFn；切换时复用 React Query 缓存。

### 2.3 「采购时间」列改名 + 取值
- 列名改为「支付时间」，副标题（hover tooltip）注明"国际物流支付时间"。
- 单元格优先显示 `intl_pay_at`，回退到 `purchased_at`，再回退到 `created_at`，并显示"年-月-日 时:分"。

### 2.4 展示模式切换：包裹维度 / 商品维度
- 工具栏新增小型分段控件（与 `CurrencyToggle` 同款样式）：`包裹 | 商品`，默认"包裹"，记到 localStorage（新 hook `use-parcel-view-mode.ts`，复用 `useSyncExternalStore` 套路）。

- **包裹维度（现状）**：保持当前列结构（图 / 订单·标题 / 子单数 / 合计 / 支付时间 / 状态 / 操作）。

- **商品维度**：
  - 把 `rows.flatMap(items)` 展平成"每行 1 个子订单"，没有子订单的包裹保留 1 行占位。
  - 列结构改为：勾选 · 商品图 · 商品标题（带原文小字）· 所属包裹号（点击进卡片）· 单价 ¥ · 数量 · 关税类目/税率 · 国际支付时间（取自父包裹的 `intl_pay_at`）· 状态（取父包裹）。
  - "合计"列在商品维度下显示子订单的 `item_total_jpy / item_total_cny`。
  - 排序仍按父包裹的 `intl_pay_at`（同包裹的子订单连续出现，子订单内部按 `position` 排）。
  - 勾选/批量删除在商品维度下禁用（避免误删整包），或仅显示"打开包裹"操作。

### 2.5 卡片对话框无变化
点击商品行 / 包裹行都打开现有 `ParcelCardDialog`。

## 三、不改动
- 状态字典、关税计算、币种切换、`ParcelOverviewSections`、卡片对话框逻辑保持不变。
- 不引入新表、不引入新依赖。

## 四、验证
- 打开列表：默认按支付时间倒序；点击表头能切换升降序；表头有箭头指示。
- 工具栏"来源"下拉消失，标题副行不再出现来源标签。
- 切换"商品维度"：列变为以子订单为行，标题、图片、单价、所属包裹号都对得上。
- 没有 `intl_pay_at` 的旧包裹排在末尾（nullsLast），单元格回退展示 `purchased_at`。

## 技术细节

```ts
// src/lib/japan-parcel.functions.ts
type SortField = 'intl_pay_at' | 'grand_total_cny' | 'created_at';
const SortSchema = z
  .object({
    field: z.enum(['intl_pay_at', 'grand_total_cny', 'created_at']).optional(),
    dir: z.enum(['asc', 'desc']).optional(),
  })
  .optional();

let q = supabaseAdmin
  .from('japan_parcels')
  .select('id,source,source_order_no,...,intl_pay_at,grand_total_jpy,grand_total_cny,...')
  .limit(100);
const sf = data.sort?.field ?? 'intl_pay_at';
const dir = data.sort?.dir ?? 'desc';
q = q.order(sf, { ascending: dir === 'asc', nullsFirst: false });
```

```ts
// src/hooks/use-parcel-view-mode.ts
export type ParcelViewMode = 'parcel' | 'item';
// localStorage key: jp-parcel-view-mode
```

```tsx
// 表头排序按钮
<button onClick={() => toggleSort('intl_pay_at')} className="...">
  支付时间 {sort.field === 'intl_pay_at' ? (sort.dir === 'asc' ? <ArrowUp/> : <ArrowDown/>) : <ArrowUpDown className="opacity-30"/>}
</button>
```