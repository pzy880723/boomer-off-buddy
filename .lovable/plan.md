# 日本小包裹"新建包裹"流程开发计划

## 目标

把现有 `/purchase/japan-parcel/new` 改造成一个独立、完整的"新建包裹"工作台：
- 顶部一个智能输入框，支持粘贴整段网页文字 **或** 截图，AI 识别后自动回填下面的字段
- 表单分三大块：**订单信息**、**国际物流费用明细**、**子订单（包裹内物品）列表**
- 子订单可手动新增/删除/编辑，每个子订单也支持单独的智能识别
- 关税自动按所有子订单合计计算
- 合计金额 = 子订单商品费总和 + 国际物流费总和 + 关税
- 保存时一次性写入 `japan_parcels` 主表 + 多条 `japan_parcel_items` 子表

## 入口

`/purchase/japan-parcel` 列表页右上角"新建包裹"按钮 → 跳转 `/purchase/japan-parcel/new`，与"导入截图"按钮并列存在。

## 页面结构

```text
┌─ 新建小包裹订单 ────────── [返回] [保存] ┐
│                                          │
│ ┌─ 智能填写 ─────────────────────────┐  │
│ │ [Tab: 粘贴文字 | 粘贴截图]          │  │
│ │ ┌────────────────────────────────┐ │  │
│ │ │ 文本框 / 截图拖拽区             │ │  │
│ │ └────────────────────────────────┘ │  │
│ │              [✨ 一键识别并填充]    │  │
│ └────────────────────────────────────┘  │
│                                          │
│ ┌─ 订单信息 ─────────────────────────┐  │
│ │ 来源订单号 / 国际物流单号 / 状态    │  │
│ │ 重量(g) / 体积(cm³) / 最大边长(cm)  │  │
│ │ 存储天数                            │  │
│ │ 收货人 / 电话 / 地址                │  │
│ └────────────────────────────────────┘  │
│                                          │
│ ┌─ 国际物流费用明细 ─────────────────┐  │
│ │ 总计 JPY (≈CNY 自动算)              │  │
│ │ 支付方式 / 支付时间 / 商户订单号     │  │
│ │ 结算汇率                            │  │
│ │ 国际物流费 / 发送方式 / 收费方式     │  │
│ │ 保留原始包装 / 强化加固 / 发送手续费 │  │
│ │ 拍照费 / 合单手续费 / 已使用积分     │  │
│ └────────────────────────────────────┘  │
│                                          │
│ ┌─ 子订单（商品 N 件）   [+ 新增子订单] │
│ │ ┌── 子订单 #1 ─────── [✨识别] [×] │ │
│ │ │ 商品费用 JPY / ≈CNY               │ │
│ │ │ 订单编号 / 支付方式 / 支付时间    │ │
│ │ │ 商户订单号 / 入库重量 / 结算汇率  │ │
│ │ │ 商品价格 / 手续费                 │ │
│ │ │ 日本国内运费 / 运费补差           │ │
│ │ └──────────────────────────────────┘ │
│ │ ┌── 子订单 #2 ──────────────── [×] │ │
│ │ └──────────────────────────────────┘ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌─ 合计 ─────────────────────────────┐  │
│ │ 商品总额 X 日元                     │  │
│ │ + 国际物流费 Y 日元                 │  │
│ │ + 关税 Z 日元（按 X 自动算）        │  │
│ │ ───────────────────────────         │  │
│ │ = 合计 ¥XX,XXX (≈￥XXX)            │  │
│ └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## 实施步骤

### 1. 数据库微调
现有表结构基本够用，只补两件事：
- 给 `japan_parcels` 新增 `tariff_jpy NUMERIC`、`tariff_cny NUMERIC`、`grand_total_jpy NUMERIC`、`grand_total_cny NUMERIC`（4 个金额汇总字段，方便列表/详情直接展示）
- 关税计算规则使用一个常量，例如默认 `tariffRate = 0`（占位，可后续在设置中维护）。如不知确切规则，先做成"按子订单商品费总和 × 可配置百分比"，默认 0，UI 上仍展示该行。

### 2. 抽出新组件
- `src/components/parcel-info-section.tsx`：订单信息块
- `src/components/parcel-intl-fee-section.tsx`：国际物流费用明细块
- `src/components/parcel-item-card.tsx`：单个子订单卡片（含字段编辑 + 单独"识别"按钮 + 删除）
- `src/components/parcel-totals.tsx`：底部合计
- `src/components/smart-fill-box.tsx`：顶部智能输入框（文字/截图 Tab）

### 3. 新增 AI 识别 server function
在 `src/lib/ai.functions.ts` 新增：
- `recognizeParcelText({ text })`：纯文字解析，返回 `{ parcel, intl_fee, items[] }` 三段结构（用 zod schema + `Output.object`）
- `recognizeParcelBlock({ image_base64?, text? })`：统一入口，可二选一传入

返回的 schema 字段和上面三段表单字段一一对齐。子订单解析为数组。

### 4. 改写 `purchase.japan-parcel.new.tsx`
- 顶部智能填写盒子，识别成功后 `setForm` 主表字段 + `setItems` 数组
- 三段卡片渲染主表
- 子订单区可 `+ 新增`、`×ml 删除`、单条"识别"
- 底部合计实时随字段变化重算
- 保存：
  1. `createJapanParcel(主表 + 4 个汇总字段)` → 取 `id`
  2. 遍历子订单 `createParcelItem({ parent_id: id, ... })`（新增 server function）
  3. 全部成功 → toast + 跳详情页

### 5. 新增子订单 server function
`createParcelItem` / `bulkCreateParcelItems`，配合现有 `updateParcelItem`、`deleteParcelItem`。

### 6. 列表页按钮调整
`purchase.japan-parcel.index.tsx` 顶部已有"导入截图"按钮，并列加一个 `+ 新建包裹` → `/purchase/japan-parcel/new`。

### 7. 详情页同步
`purchase.japan-parcel.$id.tsx` 也展示新增的关税/合计字段，并允许"在已有包裹下新增子订单"按钮（复用 `parcel-item-card`）。

## 技术细节

- **AI 模型**：沿用 `google/gemini-3-flash-preview`（识别截图），文字解析也用同一模型
- **识别 schema** 用 zod 严格定义三段结构，避免脏数据落库
- **合计计算**全部在前端 `useMemo` 完成，保存时再写入 4 个汇总字段（保证列表查询不必回表 sum）
- **关税规则**先做成可配置常量 `TARIFF_RATE` 在 `japan-parcel.helpers.ts`，默认 0，后续接入设置
- **金额换算**：所有 `xxx_cny` 字段在前端用 `结算汇率 × xxx_jpy` 实时显示，用户也可手动覆盖
- 表单状态用受控 `useState`；子订单数组使用 `id: crypto.randomUUID()` 作为 key
- AI 调用沿用现有 `recognizeParcelScreenshot` 模式（`createServerFn` + `Output.object`）

## 不在本次范围

- 关税具体税率规则（先占位 0，等业务确认）
- 子订单的"商品图片上传"（沿用现有 `item_image_url` 文本字段）
- 自动汇率拉取（汇率仍由用户/AI 填入）
