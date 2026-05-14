# 日本小包裹 父子结构重构 + AI 解析升级

## 背景

之前 `japan_parcels` 是扁平表，每行 = 一个商品。但实际 meruki 的"大包裹"是合单后的父订单（含国际物流单号、总重量、收货地址、状态时间线、国际物流费用明细），下挂多个子订单（每个子订单 = 一件商品 + 自己的商品费用）。

需要按真实数据结构重建。

## 数据模型

### 表 1: `japan_parcels`（父：合单大包裹）
保留原表，扩字段：
- 订单基础：`source_order_no`(父单号 KHDZ...) `tracking_no`(国际物流单号 CN...JP) `status` `status_text`
- 物流体积：`total_weight_g`(含包装) `volume_cm3` `max_side_cm` `storage_days`
- 收货：`receiver_name` `receiver_phone` `receiver_address`
- 国际物流费用明细（全部 JPY 数字 + 总价 CNY）：`intl_total_jpy` `intl_total_cny` `intl_freight_jpy` `intl_ship_method`(日本邮政海运件等) `intl_charge_method`(按重量) `intl_keep_packaging_jpy` `intl_reinforce_jpy` `intl_send_fee_jpy` `intl_photo_fee_jpy` `intl_merge_fee_jpy` `intl_points_used` `intl_pay_method` `intl_pay_at` `intl_merchant_order_no` `intl_exchange_rate`
- 时间线：`status_timeline` (jsonb，存 `[{at, text}]`)
- 旧字段（item_title 等扁平商品字段）保留为可空，做向后兼容

### 表 2: `japan_parcel_items`（子：子订单）新建
- `id` `parent_id`(→japan_parcels) `sub_order_no`(子单号 MYAY...) `position`
- 商品：`source_platform`(JDirectItems Auction 等) `item_title`(原日文) `item_title_cn` `item_image_url` `condition`(二手/未使用) `addon_service` `unit_price_jpy` `quantity`
- 费用：`item_total_jpy` `item_total_cny` `item_price_jpy` `service_fee_jpy` `domestic_freight_jpy` `freight_diff_jpy` `weight_g`(入库重量) `exchange_rate` `pay_method` `pay_at` `merchant_order_no`
- RLS 同 japan_parcels

迁移时把现有扁平行的商品字段搬成 1 条 item。

## AI 解析重写

`parseMerukiListScreenshot` 升级为 `parseMerukiParcelScreenshots`：
- 入参改为 `images: [{ base64, mime_type }]`（一次接收多张截图，对应同一个大包裹的 4-5 张分块图）
- 返回 schema：`{ parent: <父字段>, items: [<子字段>], status_timeline: [...] }`
- prompt 重写，明确告诉模型这是"meruki 合单大包裹的多张分块截图，请合并识别为一个父订单+若干子订单"

`importParsedOrders` 改成 `importParsedParcel`：
- 父订单按 `source_order_no` 判重；存在则提示"已存在，跳过"
- 不存在则插入父，再批量插入 items

## 导入页 UI 升级

`/purchase/japan-parcel/import`：

1. **多图上传**：dropzone 支持一次拖入多张（4-5 张），全部归到同一个"大包裹"
2. **进度条 + 步骤**（顶部 + 每张图）：
   - 顶部总进度：`已上传 X 张 → 压缩中 → AI 识别中 → 入库`，4 步水平 stepper
   - 每张图缩略图下方显示状态点：⬜ 待解析 / 🔵 上传中 / 🟡 解析中 / 🟢 完成 / 🔴 失败
3. **解析失败处理**：每张图独立 try/catch，失败不阻塞其它图，显示原因；底部"重试失败"按钮
4. **预览面板**：解析完成后，左边显示父订单字段（可编辑），右边列出所有子订单（可勾选/编辑/删除），底部"确认导入"

## 详情页改造

`/purchase/japan-parcel/$id`：
- 顶部：父订单信息（物流单号、总重量、体积、收货地址、状态徽章）
- 中间：状态时间线（竖向 timeline）
- 下半：国际物流费用明细卡 + 子订单列表（卡片式，每张显示商品图/标题/单价/费用/重量）
- 子订单点击展开编辑

## 列表页

保持现状但展示父订单：商品标题列改为"子订单数 + 第一个商品标题"，金额列用 `intl_total_cny + sum(items.item_total_cny)` 算实际成本。

## 实施步骤

1. 迁移：建 items 表 + 给 japan_parcels 加新字段 + 把现有行的商品字段搬到 items
2. helpers/types：新增 `ParcelItem` 类型，computeCompleteness 改为父+子综合
3. server fns：重写 parse/import + 增 items 的 CRUD
4. AI prompt 重写，多图入参
5. 导入页 UI（dropzone 多图 + stepper + 卡片预览）
6. 详情页重构（父信息 + timeline + items 列表）
7. 列表页金额/标题列适配
8. 旧 `meruki_accounts` / extension 不动

## 技术细节

- AI 模型继续用 `google/gemini-2.5-pro`，多图通过 `messages[].content` 的多个 `{type:'image'}` 段一次性传给同一次调用（让模型自己拼接）
- 状态时间线存 jsonb，避免再开一张表
- 子订单 `parent_id` 加索引；`japan_parcels.source_order_no` 加 unique 索引便于判重
- 进度条用本地 React state（`Map<imageId, status>`），不入库

## 暂不做

- 截图自动分类（让用户手动一次拖完所有相关图）
- 子订单状态独立流转（共用父状态）
- Chrome 插件改造

