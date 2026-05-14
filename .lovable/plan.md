## 问题诊断

1. **概览卡片乱**：当前 `ParcelCardDialog` 概览只用一个 4 列小网格塞了 4 个字段（物流单号 / 采购时间 / 商品数 / 合计），既没有完整的包裹订单信息，又把费用明细放在最下面 1 行 7 列里挤在一起。你要的"上面订单信息→运费明细→子订单→合计"完全没体现。

2. **编辑标签反人类**：编辑用的是旧的 `ParcelForm`，分组是「商品 / 价格 / 物流 / 备注」。这是早期"一个订单 = 一件商品"时代的字段，现在包裹本身没有"商品/卖家/品类/单价"——这些都在子订单里。所以你看到的"商品/价格/物流/备注"全是错位的旧字段，难怪无法理解。

## 修改方案（只动前端展示，不改数据库与 server 函数）

### 1. 重写 `ParcelCardDialog` 的"概览"标签（src/components/japan-parcel/parcel-card-dialog.tsx）

四段式纵向布局，每段一个区块卡片，标题清晰：

```text
┌─────────────────────────────────────────┐
│ ① 包裹信息                              │
│   订单号 / 物流单号 / 平台订单号        │
│   采购时间 / 状态 / 备注 / 收件地址     │
├─────────────────────────────────────────┤
│ ② 国际物流费用明细                      │
│   运费 加固 合单 发送 拍照 保留包装     │
│   积分抵扣 关税 汇率 支付方式 支付时间  │
│   小计：JPY xxx ≈ CNY xxx               │
├─────────────────────────────────────────┤
│ ③ 子订单信息  (N)                       │
│   每行：图 + 中文标题(日文小字) + 单价×数量 + 小计
│   小计：商品总额 JPY xxx                │
├─────────────────────────────────────────┤
│ ④ 合计费用                              │
│   商品总额 + 国际物流小计 + 关税        │
│   = 合计 JPY xxx ≈ CNY xxx (大字突出)   │
└─────────────────────────────────────────┘
```

### 2. 新建 `ParcelEditSections` 组件，替换旧 `ParcelForm`

新文件 `src/components/japan-parcel/parcel-edit-sections.tsx`，与上述概览同结构、同顺序的 4 段，每段内部把字段改为可编辑：

- **① 包裹信息**：`source_order_no`、`tracking_no`、`intl_merchant_order_no`、`purchased_at`、`status`(下拉)、`notes`、收件相关字段（如 `receiver_name`、`warehouse_location`）。
- **② 国际物流费用明细**：`intl_freight_jpy`、`intl_reinforce_jpy`、`intl_merge_fee_jpy`、`intl_send_fee_jpy`、`intl_photo_fee_jpy`、`intl_keep_packaging_jpy`、`intl_points_used`、`tariff_jpy`、`intl_exchange_rate`、`intl_ship_method`、`intl_charge_method`、`intl_pay_method`、`intl_pay_at`、`intl_total_jpy`、`intl_total_cny`。
- **③ 子订单**：复用现有的子订单列表 + 行内"编辑/删除"按钮和子订单编辑弹窗（已有逻辑保留）。
- **④ 合计**：`grand_total_jpy`、`grand_total_cny` 两个数字输入；旁边显示一个根据上面字段自动算出的"建议值"提示（不强制覆盖，方便人工核对）。

旧 `ParcelForm` 中"商品 / 卖家 / 品类 / 单价 / 服务费 / 国内运费 / 重量"等单商品字段**不再在编辑界面出现**（数据保留在 DB 不动），因为它们对"包裹"概念无意义。

### 3. 简化 `ParcelEditPanel`（src/components/japan-parcel/parcel-edit-panel.tsx）

- 顶部保留：快捷状态切换条 + 保存 + 删除。
- 删除：左侧旧的"商品图 / 完成度环 / 总价小卡 / raw_payload" 整列（compact 模式本来也没显示，详情页也一并精简）。
- 主体直接渲染 `<ParcelEditSections>`。状态时间线挪到 ① 包裹信息卡片底部一个折叠区里。

### 4. 让"概览"和"编辑"完全对齐

两个 Tab 用同一组分段标题与同一种字段顺序，区别只是「只读 vs 可编辑」，避免再出现"概览看到的字段和编辑里看到的字段对不上"。

## 涉及文件

- `src/components/japan-parcel/parcel-card-dialog.tsx`（重写概览 Tab）
- `src/components/japan-parcel/parcel-edit-sections.tsx`（**新建**）
- `src/components/japan-parcel/parcel-edit-panel.tsx`（用新组件替换 `ParcelForm`，去掉左栏冗余卡）
- `src/routes/purchase.japan-parcel.$id.tsx`（保持当前的极简 wrapper，不需要再改）

不改：server 函数、数据库 schema、`ParcelForm`（其它地方如 `/new` 仍可能用到，先留着不删）。

## 验收

- 点击列表行 → 弹窗"概览"上到下依次是：包裹信息 → 国际物流费用明细 → 子订单 → 合计费用。
- 点击 ✏️ → 弹窗"编辑"是同样 4 段，且字段与"概览"一一对应；不再出现"商品/价格/物流/备注"四标签。
- 子订单区域仍可单独编辑/删除每个商品。
