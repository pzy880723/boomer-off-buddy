## 目标

在 `/purchase/japan-parcel` 列表页，勾选多条包裹后，工具条目前只有"批量删除"。增加一个"批量签收"按钮，一键把所选包裹状态改成 `delivered`，并写入 `received_at = now()`。回收站 tab 下不显示该按钮。

## 改动

### 1. 新增 serverFn `bulkUpdateJapanParcelStatus`
文件：`src/lib/japan-parcel.functions.ts`

参考已有的 `updateJapanParcelStatus` 和 `bulkDeleteJapanParcels`：

- 入参：`{ ids: string[] (1..500), status: string }`
- 行为：`update({ status, received_at: status === 'delivered' ? now : 已存在不动 })`。简单起见：当 `status === 'delivered'` 时同时写 `received_at = new Date().toISOString()`（即便已有值也覆盖为最新签收时间，符合"批量签收"语义）；其它状态只更新 status。
- 返回 `{ ok: true, count }`

### 2. 列表页加按钮
文件：`src/routes/purchase.japan-parcel.index.tsx`

- 引入新 serverFn，新增 `signMut`（`useMutation`，成功 toast `已签收 N 条`，清空 `selected`，`invalidateAll()`）。
- 在非回收站分支（`!isTrash`）的批量操作栏中，"批量删除"前插入：
  ```
  <Button variant="outline" size="sm" disabled={signMut.isPending}
    onClick={() => {
      if (confirm(`确认将选中的 ${selected.size} 条包裹标记为已签收？`))
        signMut.mutate(Array.from(selected));
    }}>
    <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
    批量签收
  </Button>
  ```
  (图标用 lucide-react 的 `PackageCheck`，已与项目风格一致；若已导入其它包裹图标可复用。)

### 不改动
- 单条签收入口（详情/编辑面板）保持现状。
- 状态字典、tab 计数、RLS 都无需改。
