## 目标
所有展示商品图片的地方，点击缩略图后弹出大图查看（支持关闭，移动端也可用）。

## 实现方案

新建一个轻量复用组件 `src/components/japan-parcel/image-lightbox.tsx`：
- 内部封装 `Dialog`（来自 `@/components/ui/dialog`）+ `<img>`
- 用法：`<ClickableThumb src={url} alt="" className="..." />` —— 渲染缩略图，点击后弹出无边框 Dialog 显示原图（`max-w-[90vw] max-h-[90vh] object-contain`），背景半透明，点击空白/ESC 关闭
- 鼠标悬停加 `cursor-zoom-in` 提示

## 替换以下位置的 `<img>`

| 文件 | 行 | 用途 |
| --- | --- | --- |
| `src/routes/purchase.japan-parcel.index.tsx` | 489-495 | 列表 item 视图缩略图 |
| `src/components/japan-parcel/parcel-card-dialog.tsx` | 182-185 | 包裹卡片 dialog 内子项缩略图 |
| `src/components/japan-parcel/parcel-edit-panel.tsx` | 245-248 | 编辑面板内子项缩略图 |
| `src/components/japan-parcel/items-hover-preview.tsx` | 53-57 | hover 预览中的缩略图 |
| `src/routes/purchase.japan-parcel.import.tsx` | 458-460 | 导入预览缩略图 |
| `src/components/japan-parcel/item-image-uploader.tsx` | 已上传后的预览图 | 上传组件中已有图的点击放大（保留上传/删除按钮，不冲突） |

`item-image-uploader.tsx` 需要稍微小心：原本整个缩略图区域可能是 input/上传触发器，要把"已有图片预览"和"上传触发"分离 —— 点击图片放大，点击右上角小按钮重新上传/删除。

## 不改动
- 业务逻辑、数据流、识别管线均不动
- 仅 UI 层

## 验证
保存后 build 通过，在列表、详情、编辑面板、上传组件分别点击图片，确认弹窗能正常打开/关闭，且不与原有 hover/click 行为冲突。