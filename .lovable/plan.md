# 商品打包单价计算器

把"整件商品 → 实际包含 N 个小件"的拆分逻辑做成单商品维度的小工具，得到真实的单件成本（含运费分摊和关税），并在列表中显示。

## 一、数据库改动

`japan_parcel_items` 新增 3 个可空字段（不影响现有 quantity / unit_price_jpy / item_total_jpy 采购口径）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `pack_pieces` | int | 一件商品里实际包含的小件数 |
| `pack_pieces_source` | text | `title` / `image` / `manual`，用于 UI 上的小图标 |
| `pack_unit_note` | text | 单件单位，如"个 / 张 / 枚 / 块"，默认"个" |

衍生值不入库，前端按公式实时算：
- `piece_unit_jpy = item_total_jpy / pack_pieces`
- `piece_landed_cny = landedCny / pack_pieces`（landedCny 已含运费分摊 + 关税，复用 `computeParcelItemLanded`）

## 二、AI 估算（两步管线）

新建 `src/lib/pack-pieces.functions.ts`，两个独立 serverFn：

### Step 1 - `estimatePiecesFromTitle`
- 输入：`{ title, title_cn }`
- 模型：`google/gemini-3-flash-preview`（轻量、便宜）
- Few-shot prompt 覆盖典型表达：
  - "ポケモンカード 100枚セット" → 100
  - "ジャンク品 まとめ 30点" → 30
  - "フィギュア 1個" → 1
  - "ガチャ ノーマル 5種コンプ" → 5
- 用 `Output.object` 严格输出 `{ pieces: number|null, confidence: 'high'|'medium'|'low', reasoning: string }`
- 标题没明确数量时返回 `pieces: null` + 原因，**不要瞎猜**

### Step 2 - `estimatePiecesFromImage`（仅在 Step 1 返回 null 时调用）
- 输入：`{ image_url, title, title_cn }`
- 模型：`google/gemini-2.5-flash`（多模态）
- Prompt 要求数清楚图中可见小件数量，无法判断返回 null
- 输出同上结构

### Step 3 - 手动
- 用户直接输入框填数字

## 三、UI - 拆包计算器 Dialog

新建 `src/components/japan-parcel/pack-price-calculator-dialog.tsx`。

入口（一个 `Calculator` 图标按钮）：
- `parcel-edit-sections.tsx` 子订单卡片金额区右侧
- `purchase.japan-parcel.index.tsx` 列表视图商品行末尾
- `parcel-card-dialog.tsx` 商品行

Dialog 流程：

```text
┌─ 拆包单价计算 ────────────────────────────┐
│ [缩略图] ポケモンカード 100枚セット         │
│         宝可梦卡 100 张套装                 │
│                                             │
│ 整件金额   ¥12,000  到手 ¥600.00 CNY        │
│                                             │
│ ① 从标题分析  [✨ 分析标题]                 │
│    → "100枚セット" 识别为 100 件 (高置信)   │
│                                             │
│ ② 从图片分析  [🖼️ 分析图片]  (无图时禁用)   │
│    → 标题已识别，跳过                       │
│                                             │
│ 包内件数 [  100  ] 件                       │
│ 单件单位 [  张  ]                           │
│                                             │
│ ─── 单件成本 ───                            │
│ ¥120 / 张   到手 ¥6.00 / 张                 │
│                                             │
│              [取消]   [保存]                │
└─────────────────────────────────────────────┘
```

交互细节：
- 打开 dialog 自动跑 Step 1（loading skeleton）
- Step 1 返回 null 且有图片 → 自动跑 Step 2
- 两步都失败 → 提示"请手动填写"
- 件数框可随时手填，触发实时重算并把 source 标记为 `manual`
- 保存写入 3 个字段，关闭 dialog 刷新查询

## 四、列表显示

`purchase.japan-parcel.index.tsx` 商品行紧凑视图里加一行小字（无数据不显示）：

```text
数量 12 · 拆 100 张 · ¥6.0/张 🤖
```

来源图标：
- `title` → 📝
- `image` → 🖼️
- `manual` → 🖐️ （或不显示）

同步在 `parcel-card-dialog.tsx` 和 `items-hover-preview.tsx` 加同样一行小字。

## 五、复用的工具函数

`src/lib/japan-parcel.helpers.ts` 加：

```ts
export function computePiecePrice(
  landedCny: number | null,
  itemJpy: number,
  pieces: number | null
): { pieceJpy: number | null; pieceCny: number | null }
```

`computeParcelItemLanded` 不动。

## 六、实施顺序

1. migration: `japan_parcel_items` 加 3 列
2. `pack-pieces.functions.ts`：两个 serverFn + zod
3. `japan-parcel.helpers.ts`：加 `computePiecePrice`
4. `pack-price-calculator-dialog.tsx`：组件 + 两步管线 UI
5. 在 3 处入口（编辑面板 / 列表视图 / parcel-card-dialog）挂上按钮
6. 在 3 处展示位（列表行 / parcel-card-dialog / hover preview）加单价小字
7. 扩展 `japan-parcel.functions.ts` 的 update serverFn 接受新字段（list select 已是 `*` 或需要追加 3 个字段）

## 七、不动的范围

- 识别管线 `recognize.functions.ts` 不动，拆包件数只在用户主动点开 dialog 时触发
- 采购口径 quantity / unit_price_jpy / item_total_jpy 语义不变
- 关税、运费分摊、到手价主算法不动
