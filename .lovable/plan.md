
# 日本小包模块重设计

目标：列表更清爽、操作集中；新建 / 详情 / 编辑页排版高级感、信息层级清晰；首屏更快。

## 1. 列表页 `/purchase/japan-parcel`

### 列顺序调整
现在：选择 / 图 / 标题 / 子单 / 状态 / 合计 / 时间 / 操作  
改为：选择 / 图 / 标题 / 子单 / 合计 / 时间 / **状态** / **操作**

### 状态列（只读 Badge）
- 已采购 → 灰色 `secondary` Badge + Package icon
- 已签收 → 绿色 success Badge + CheckCircle icon
- 不再在状态列内放任何按钮

### 操作列（统一收口）
所有按钮迁入这一列，按状态条件显示：
- 状态为「已采购」：`确认签收`（主色，icon-only + tooltip 或带文字的小按钮）+ `编辑` + `删除`
- 状态为「已签收」：`撤销签收` + `编辑` + `删除`
- 三按钮全部 `h-8 w-8` icon button，带 hover tooltip，间距统一

### 视觉升级
- 表头：`uppercase tracking-wide text-[11px] text-muted-foreground`，去除粗黑感
- 行：`hover:bg-muted/40`，行高 56px → 60px，第一列加左侧 3px 透明 border，hover 时变 `border-primary/40`
- 图列：缩略图 40×40 → 44×44，圆角 `rounded-md`，叠加 `ring-1 ring-border`
- 合计列：CNY 大字 + JPY/关税小字两行，使用 `tabular-nums font-mono`，金额右对齐
- 顶部筛选 Card 改为透明边框 + `bg-muted/30`，按钮换成 `ghost` + 图标
- 工具栏的「截图批量导入」「新建包裹」分主次：新建为渐变主按钮，导入为 outline

### 性能优化
- 列表 server fn `listJapanParcels` 当前会拉取所有子订单（用于 hover 预览/合计兜底）→ 改为只 select 必要字段：`id, item_title, item_title_cn, item_image_url, item_total_jpy`，避免大对象传输
- `staleTime` 60s 已有，新增 `placeholderData: keepPreviousData`，搜索时不闪空
- 子订单缩略图改为 `loading="lazy" decoding="async"`
- 懒翻译批量从 20 → 12，减少首屏后台请求
- 列表页 route `loader` 已 `ensureQueryData`，确认走 SSR 缓存；`Route.preload = "intent"` 让 hover 链接预拉详情

## 2. 新建包裹页 `/purchase/japan-parcel/new`

### 排版重构（两栏 sticky 布局）
```text
┌───────────────────────────────────────────────────────┐
│ PageHeader（返回 / 标题 / 保存按钮 sticky 顶栏）       │
├──────────────────────────────┬────────────────────────┤
│ 左主栏 (lg:col-span-8)       │ 右侧栏 (lg:col-span-4) │
│                              │ sticky top-20          │
│ ① 智能识别（折叠 Card）       │ ┌────────────────────┐ │
│   - Tabs: 文本 / 截图         │ │ 实时合计卡         │ │
│   - 单击运行；运行中折叠输入   │ │ - 商品 ¥           │ │
│   - RecognizeTimeline         │ │ - 国际物流 ¥        │ │
│                              │ │ - 关税 ￥           │ │
│ ② 包裹信息                    │ │ ─────────────      │ │
│ ③ 国际物流费用                │ │ 合计 ￥xxxx 大字    │ │
│ ④ 子订单（accordion 折叠）    │ └────────────────────┘ │
│                              │                        │
│                              │ 完成度环 (复用)         │
└──────────────────────────────┴────────────────────────┘
```

- Section 卡片 `border-border/50 shadow-sm rounded-xl`，标题用 `text-base font-semibold` + 左侧 3px 渐变小条
- 字段网格 `gap-3`，金额字段 `font-mono tabular-nums`
- 子订单卡片使用 accordion，每条收起时只显示「序号 · 标题 · 金额 · 操作」；展开后才显示完整字段，减少首屏渲染
- 顶部「保存」按钮 sticky，滚动时一直可见
- 智能识别区在结果落入表单后自动折叠，`已识别 N 项` 状态行可重新展开

## 3. 详情 / 编辑 (`/purchase/japan-parcel/$id` + 弹窗复用 `ParcelEditPanel`)

### 顶部状态条改造
当前一长条「快捷修改状态 + AI 识别 + 删除 + 保存」拥挤，改成：
```text
┌──────────────────────────────────────────────────────┐
│ ◉ 状态：已采购    [切换为已签收]      [AI 关税][删除][保存]│
└──────────────────────────────────────────────────────┘
```
- 状态用大号 Badge 显示当前态，旁边只放一个「切换为另一状态」按钮（不再罗列全部状态）
- 高级操作右对齐，主按钮 `保存` 用渐变色

### 内容布局
同新建页的两栏结构：
- 左：① 包裹信息 / ② 国际物流费用 / ③ 子订单（卡片 + accordion）
- 右 sticky：合计卡 + 状态时间线（精简为最近 3 条 + 展开）

### 子订单卡视觉
- 缩略图 64×64 → 72×72，圆角加阴影
- 字段以 chips 形式分两行展示（单价 / 数量 / 重量 / 汇率 / 手续费 等），不再一长串文字
- 编辑/删除按钮悬停时浮现，默认隐藏

### 性能
- `getJapanParcel` 已一次返回 row + items，OK；详情页 `useQuery` 添加 `staleTime: 30_000`
- 列表点击行打开弹窗时，使用列表已缓存的 row 作为 `placeholderData`，避免空白闪烁
- 路由 `Route.preload = "intent"` 让列表 hover 时预拉详情
- 子订单图片 `loading="lazy"`

## 4. 通用样式（`src/styles.css`）
- 新增 `--shadow-card-elevated`、`--gradient-accent-bar` token
- 复用 `bg-gradient-brand`，主按钮一律使用

## 技术细节

文件改动清单：
- `src/routes/purchase.japan-parcel.index.tsx`：列顺序、操作列、状态 Badge、表头/行样式、列表 query 字段精简、preload
- `src/lib/japan-parcel.functions.ts`：`listJapanParcels` 子订单 select 字段裁剪
- `src/routes/purchase.japan-parcel.new.tsx`：两栏布局重构、智能识别折叠、子订单 accordion、sticky 合计卡
- `src/components/japan-parcel/parcel-edit-panel.tsx`：顶部操作条简化，状态切换二态化，子订单卡视觉
- `src/components/japan-parcel/parcel-edit-sections.tsx`：Section 视觉、合计卡升级
- `src/components/japan-parcel/parcel-card-dialog.tsx`：与详情页排版保持一致
- `src/styles.css`：新增 token

不改动：
- 数据库结构、server function 入参/出参签名
- 计算口径（依然 商品 + 国际物流 = JPY 合计；CNY 合计 = JPY/汇率 + 关税CNY）
- 智能识别管线、关税分类、翻译流程

