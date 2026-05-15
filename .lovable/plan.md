# 关税自动化 + 清理列表入口 + 表头居中

## 1. 关税自动计算（去掉手动按钮）

### 1.1 改造 `src/lib/tariff.functions.ts`
- 入参 `id` 由 `z.string().uuid()` 改为 `z.string()`，并新增可选字段 `persist: z.boolean().optional()`（默认 `true`，保持旧行为）。
- `persist === false` 时跳过 `supabaseAdmin.update(...)`，仅返回 `results`（id → category）。
- 这样新建页（item 还没入库，id 是本地临时 uuid）也能复用同一个 serverFn。

### 1.2 新建包裹页 `src/routes/purchase.japan-parcel.new.tsx`
- 在 AI 识别管线 **最后一步**（Recognize 完成后、或 `setItems(validItems)` 之后）追加一个自动步骤："关税分类"：
  - 调用 `classifyItemsTariff({ items, persist: false })`。
  - 用返回的 `results` 把每个子订单的 `tariff_category` / `tariff_rate` 写回 `items` 内存数组。
  - RecognizeTimeline 增加一条 step（status: running → done / error，error 静默失败不阻断保存）。
- 用户手动新增/编辑子订单标题时，**不再实时调 AI**，避免噪音；只在"识别完成后"自动跑一次。
- 用户也可以在子订单卡片里手动改类目（沿用现有下拉，无需新增 UI）。
- 保存时 `tariffJpy / tariffCny` 已经因为 `items[].tariff_rate` 自动得到正确值，无需改 totals 逻辑。

### 1.3 详情/编辑页 `src/components/japan-parcel/parcel-edit-panel.tsx`
- 删除 "AI 关税类目" 按钮（约 354–363 行那一段）和相关 import / state（仅删除按钮 UI 与 mutation 触发逻辑，保留下拉手动选择）。
- 在 `useEffect`（首次拿到 items 时）判断：若存在 `tariff_rate == null` 的子订单，则自动调用 `classifyItemsTariff({ items: missingOnly, persist: true })` 静默回填；完成后让 list/detail query 失效以刷新。
- 失败 `toast.error`，不阻塞页面。

## 2. 删除"截图批量导入"入口

`src/routes/purchase.japan-parcel.index.tsx`：
- 删除 PageHeader actions 里指向 `/purchase/japan-parcel/import` 的按钮（约 273–276 行）。
- `description` 文案去掉"截图批量导入"字样，改为"AI 识图 · 手动录入 · 状态人工维护"。
- 空状态 `EmptyState` 的 description 同步去掉"可以截图批量导入"措辞。
- 保留路由文件 `purchase.japan-parcel.import.tsx` 不动（避免拖动其他依赖）；只是没有入口而已。

## 3. 列表表头居中

`src/routes/purchase.japan-parcel.index.tsx`：
- 给 `<TableHead>` 统一加 `className="text-center"`（除"标题"列保持左对齐以方便阅读）。
- 单元格保持现状（金额仍右对齐 / mono、文本仍左对齐），只动表头。

## 验收
- 新建包裹：粘贴截图 → 识别完成自动出现"关税分类"步骤 → 子订单卡片直接显示类目和税率 → 右侧总计卡的"+ 关税 (CNY)"自动有数值，无需点任何按钮。
- 详情页右上角不再有 "AI 关税类目" 按钮；老数据进入详情会自动补齐缺失类目。
- 列表页头部右侧只剩"新建包裹"按钮，表头列名居中显示。
