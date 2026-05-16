## 目标

在小包裹列表顶部增加 5 档状态 Tab 切换栏（全部 / 已采购 / 已签收 / 问题包裹 / 回收站），同时去掉当前的 PageHeader 标题区，直接呈现「搜索栏 + 新建按钮」+「状态 Tab」。

## UX

```text
┌─────────────────────────────────────────────────┐
│ [🔍 搜索订单号/标题/物流单号]   [展示][币种][+新建] │
├─────────────────────────────────────────────────┤
│ 全部  已采购③  已签收  问题包裹①  回收站         │
└─────────────────────────────────────────────────┘
```

- 默认停留在「已采购」。
- 「已采购」「问题包裹」右上角显示数字角标（统计全部数据，不随搜索变化）。
- Tab 选择不持久化（刷新回到默认「已采购」）。
- 回收站 Tab 内：列表行的「删除」按钮变为「还原 / 彻底删除」两个操作。

## 数据库变更（migration）

为 `japan_parcels` 增加两列：
- `is_problem boolean NOT NULL DEFAULT false` — 手动标记的问题包裹
- `deleted_at timestamptz` — 软删除时间，NULL 表示未删除

## 后端（src/lib/japan-parcel.functions.ts）

- `listJapanParcels`：
  - 新增入参 `tab: "all" | "purchased" | "delivered" | "problem" | "trash"`，默认 `purchased`。
  - 非 `trash` 时强制 `deleted_at is null`；`trash` 时强制 `deleted_at is not null`。
  - `purchased` / `delivered` 按 `status` 简化映射过滤（沿用 `simplifyStatus` 的反向规则，在 SQL 端用 `in(...)`）。
  - `problem` 时 `is_problem = true`。
- 新增 `getJapanParcelCounts` serverFn：一次返回 `{ all, purchased, delivered, problem, trash }`（统计全部数据，忽略搜索/过滤；purchased/delivered/problem 仅计未删除）。
- 新增 `setJapanParcelProblem({ id, is_problem })` —— 用于在行操作里手动标记/取消问题包裹。
- 改造删除语义：
  - `deleteJapanParcel` / `bulkDeleteJapanParcels` 改为软删除（写 `deleted_at = now()`）。
  - 新增 `restoreJapanParcel(s)` 用于回收站还原。
  - 新增 `purgeJapanParcel(s)` 用于回收站彻底删除（真正 `DELETE`）。

## 前端（src/routes/purchase.japan-parcel.index.tsx）

- 删除 `<PageHeader ... />`，把「新建包裹」按钮移到搜索栏右侧（保留预热逻辑）。
- 新增 `tab` 本地 state，默认 `"purchased"`；把 `tab` 加入 `listOptions` 的 queryKey，传给 serverFn。
- 新增独立 `useQuery` 拉取 `getJapanParcelCounts`，用于 Tab 角标。
- 渲染状态 Tab 栏（shadcn `Tabs` 或自定义按钮组），角标用 `Badge`，仅在 count>0 时显示。
- 移除现有的「状态」DropdownMenu 过滤器（被 Tab 取代）。
- 在「回收站」Tab 下：
  - 行操作隐藏「编辑 / 标记签收」；显示「还原」「彻底删除」。
  - 隐藏批量删除按钮，改为「批量还原 / 批量彻底删除」。
- 在非回收站 Tab 下，行操作增加「标记/取消问题包裹」入口（dropdown 或图标按钮）。

## 不改动

- 详情页、新建页、识别管线、视图模式切换、币种切换全部保持不变。
- 已有 5 档状态字典不变；问题包裹是与 status 正交的独立标记。
