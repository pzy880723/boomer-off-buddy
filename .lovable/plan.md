# 包裹列表 + 子订单体验改造

## 一、列表页改造（/purchase/japan-parcel）

### 字段调整
- **图**：仍显示第一个子订单图片；鼠标 hover 弹出 Popover，平铺显示该包裹下其他所有商品的缩略图（点击行/缩略图打开包裹详情卡片）
- **订单编号 / 标题**：标题取「第一个子订单的中文标题」（无则取日文标题），副标题保留 `source_order_no`
- **删除「卖家」列**（一个包裹只有一个平台，不需要展示）
- **子单数量**：保留
- **状态**：UI 上只展示并可切换两档：
  - 「已采购」（默认）→ 写入 `purchased`
  - 「已签收」→ 写入 `delivered`，且自动写入 `received_at = now()`
  - 旧值 `at_jp_warehouse / shipping_intl / paid` 等 UI 上一律显示为「已采购」；`completed` 显示为「已签收」
- **合计 ￥**：用「包裹合计」= 所有子订单 `item_total_jpy` + `intl_total_jpy` + `tariff_jpy`（CNY 同理用 `grand_total_*`），不再回退到 `total_jpy` 单字段
- **采购时间**：用 `purchased_at`（即包裹的时间），保持
- **删除「完整度」列** + 删除筛选「仅看待补全」开关

### 包裹卡片（点击行打开 Dialog）
- 顶部：包裹号、tracking_no、状态切换按钮、合计金额
- 商品 Grid：所有子订单图片 + 中文标题 + 单价 + 数量 + 小计
- 费用明细：国际运费、加固、合单、关税、汇率、合计
- 底部「打开详情页编辑」按钮 → `/purchase/japan-parcel/$id`

## 二、子订单图片粘贴（新建/详情页）

- 在子订单卡片图片区域支持：拖拽上传 / 点击上传 / **Ctrl+V 粘贴剪贴板图片**
- 图片上传到 Lovable Cloud 存储桶 `parcel-item-images`（公共读，按 `parcel/{uuid}/item-{idx}-{rand}.png` 路径）
- 上传完成后写入 `item_image_url`（公共 URL）

## 三、子订单中文标题自动翻译

- 在新建包裹页保存前 / 智能识别完成后，对所有 `item_title 非空 且 item_title_cn 为空` 的子订单，调用一个新 serverFn `translateTitles({titles: string[]}) → string[]`
- 模型：`google/gemini-3-flash-preview`，system prompt：「将下列日文商品标题翻译为简洁自然的中文标题，保留品牌/型号/数字，去掉如『未使用』『中古』『送料無料』等冗余词；输出 JSON 数组」
- 翻译触发时机：① 智能识别完成后自动批量翻译并填入；② 子订单卡片每行加「翻译」小按钮，可单条手动重译
- 列表页打开时若发现「第一个子订单 `item_title_cn` 为空但 `item_title` 有值」，懒加载触发后台批量补翻译（一次最多 20 条）

## 四、技术细节

### 数据库
- 新建 storage bucket `parcel-item-images`（public）+ RLS 允许 anon insert/select（与现有 RLS 一致）
- 不改任何表结构

### 新增/修改文件
```text
supabase/migrations/xxx_create_parcel_images_bucket.sql
src/lib/translate.functions.ts                         (新, translateTitles)
src/lib/storage.functions.ts                           (新, getUploadSignedPath / 直接前端 supabase.storage.upload)
src/components/japan-parcel/parcel-card-dialog.tsx     (新)
src/components/japan-parcel/item-image-uploader.tsx    (新, 拖拽+点击+粘贴)
src/components/japan-parcel/items-hover-preview.tsx    (新, hover 缩略图)
src/lib/japan-parcel.helpers.ts                        (新增 simplifyStatus, getDisplayTitle)
src/routes/purchase.japan-parcel.index.tsx             (列表大改)
src/routes/purchase.japan-parcel.new.tsx               (子订单图片改用 uploader + 自动翻译)
src/routes/purchase.japan-parcel.$id.tsx               (子订单图片改用 uploader)
```

### 状态简化映射
```ts
function simplifyStatus(s: string): "purchased" | "delivered" {
  return ["delivered", "completed"].includes(s) ? "delivered" : "purchased";
}
```

## 五、不在本次范围内
- 智能识别 pipeline 本身（已在上一轮稳定）
- 详情页表单字段重排
- 关税计算规则
