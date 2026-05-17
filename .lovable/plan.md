## 操作列居中

`src/routes/purchase.japan-parcel.index.tsx`：操作列表头已经是 `text-center`，但单元格还是右对齐。

把每个 `<TableCell className="text-right" ...>`（操作列）改成 `text-center`，对应内部 `<div className="flex justify-end gap-0.5">` 改成 `justify-center`。仅此一处单元格，正常/回收站两种分支共用同一个 TableCell，所以只改一行。