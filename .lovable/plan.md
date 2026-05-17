## 目标
在「拆包单价计算」弹窗里，把左上角的商品缩略图变成可点击放大的图片，方便人工数数。

## 改动范围
仅 `src/components/japan-parcel/pack-price-calculator-dialog.tsx`，第 181–190 行附近的 `<img>` 渲染。

## 实现
- 复用已有的 `ClickableThumb`（`src/components/japan-parcel/image-lightbox.tsx`），它已经在 `parcel-edit-panel`、列表等地方使用，自带点击 → 全屏 lightbox 行为。
- 把现有 `<img src={item.item_image_url} ... />` 替换为：
  ```tsx
  <ClickableThumb
    src={item.item_image_url}
    alt={item.title ?? ""}
    className="h-20 w-20 rounded-md object-cover border"
  />
  ```
- 保留无图占位分支（`item.item_image_url ? ... : <占位>`）不变。

## 不动的部分
- AI 识别流程、状态字段、单价计算逻辑全部不变。
- 其它入口（列表、edit panel 等）已是 ClickableThumb，无需改。
