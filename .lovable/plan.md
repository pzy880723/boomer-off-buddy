
## 背景

`/purchase/japan-parcel` 列表加载慢，"编辑"目前是跳转 `/$id` 详情页。需要：
1. 列表加载提速；
2. 点击「编辑」改为弹出卡片编辑框，不跳页面；
3. 编辑弹窗与详情页字段保持一致，"详情"和"编辑"展示相同的字段组。

数据库实际只有 1 条包裹/2 个子订单，慢的原因不在数据量，而在前端拉取链路与字段冗余。

---

## 一、列表加载提速

`src/lib/japan-parcel.functions.ts` `listJapanParcels`
- 把 `select("*")` 改成显式列表，**剔除 `raw_payload`**（每行可能几十 KB 的截图原始 JSON 是首屏卡顿元凶）和列表用不到的长字段。
- 子查询也只 select 列表/弹窗悬浮预览必需的列（已经精简，保持）。

`src/routes/purchase.japan-parcel.index.tsx`
- 给 Route 加 **loader**：`context.queryClient.ensureQueryData(...)`，配合 `useQuery` 的相同 queryKey，做 SSR/导航预取，首次进入不再等客户端 RTT。
- 列表行的"编辑/详情"链接加 `preload="intent"`（虽然改成弹窗后不再跳转，但保留给浏览器地址栏直接访问的场景）。
- 懒翻译副作用里**去掉 `qc.invalidateQueries`**，改为 `qc.setQueryData` 本地合并翻译结果，避免翻译完成后立刻再发一次列表请求。
- `staleTime` 从 30s 提到 60s，同时给 `useQuery` 加 `refetchOnWindowFocus: false`。

---

## 二、编辑改为弹窗 + 与详情字段对齐

### 抽取共享组件 `src/components/japan-parcel/parcel-edit-panel.tsx`
把当前 `purchase.japan-parcel.$id.tsx` 里"详情正文"的 JSX 抽成一个纯展示/编辑组件，接收 `parcelId`、`onClose?` 作为 props，内部自己用 `useQuery(['jp-parcel', id])` 拉详情、用各 mutation 写回。包含的区块（与现有详情页一致）：
- 左栏卡片：主图、状态徽章、完成度环、总价/物流单号/创建时间小表
- 原始数据折叠（如有）
- 右栏：
  - `<ParcelForm>`（所有字段：商品、价格、物流、收货、国际物流费用明细、关税、备注）
  - 状态时间线
  - 子订单列表 + "编辑子订单"嵌套 Dialog
- 底部操作：保存 / 删除 / 快捷状态切换

### 改造 `ParcelCardDialog` → 详情/编辑二合一
当前 `ParcelCardDialog` 只展示费用摘要，字段比详情页少。改造方案：
- Dialog 内放一个 `Tabs`：**"概览"** = 现有摘要卡片（合计、费用明细、商品网格）；**"编辑"** = 上面新建的 `<ParcelEditPanel parcelId={parcel.id} onClose={...} />`。
- 默认打开「概览」；列表行的 ✏️ 编辑按钮直接打开并切到「编辑」Tab。
- Dialog 容器调宽到 `max-w-5xl`，高度 `max-h-[90vh] overflow-y-auto`。

### 列表交互
`purchase.japan-parcel.index.tsx`
- 行点击 → 打开弹窗（默认"概览"Tab）。
- ✏️ 编辑按钮 → 打开弹窗 + 直接切到"编辑"Tab（不再 `<Link>` 跳转）。
- 保留 `purchase.japan-parcel.$id.tsx` 路由可直接访问（深链/分享），其内部直接渲染同一个 `<ParcelEditPanel>`，避免逻辑分裂。

---

## 三、文件改动清单

- 新增 `src/components/japan-parcel/parcel-edit-panel.tsx`
- 改 `src/components/japan-parcel/parcel-card-dialog.tsx`：加 Tabs，新增 `defaultTab` prop，宽度调大
- 改 `src/routes/purchase.japan-parcel.index.tsx`：加 loader、改编辑按钮逻辑、调整翻译副作用、`preload="intent"`
- 改 `src/routes/purchase.japan-parcel.$id.tsx`：瘦身为薄壳路由，渲染 `<ParcelEditPanel parcelId={id}/>`
- 改 `src/lib/japan-parcel.functions.ts`：`listJapanParcels` 的 `select` 列表收窄，剔除 `raw_payload`

## 不动

- 数据库结构、RLS、识别管线、新增包裹页 `/new`。
- 详情页路由本身仍然存在，行为只是从"独立大页面"变成"弹窗的同一面板"，没有功能丢失。

