## 改动

仅改 `src/components/japan-parcel/item-image-uploader.tsx`：

1. **移除框的 click 触发文件选择**：删 `onClick={() => inputRef.current?.click()}` 和 `onKeyDown` 中的 click 触发，框改为"focus 后接受 Ctrl+V 粘贴 / 拖拽"二合一。
2. **保留**：focus、粘贴监听、拖拽、删除按钮。
3. **框内文案**改为"点此 → Ctrl+V 粘贴 / 拖拽到此"。
4. **下方新增"上传图片"按钮**：调用现有 `inputRef.current?.click()` 打开文件选择器。

布局调整：原本在 `purchase.japan-parcel.new.tsx` 中只放 `<ItemImageUploader />`，现在组件自身改为竖向布局（框 + 按钮）。`ItemImageUploaderCompact` 同样保留按钮（已有）。

不动数据/上传逻辑。
