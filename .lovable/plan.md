## 问题

meruki 包裹只买了 1 件商品时，页面不会出现 `子订单：XXXX` 区块，只有：

```
订单信息 …
商品清单
  [seller / 标题 / 单价 / 数量]
费用明细
  商品费用 / 订单编号 / 支付方式 / 支付时间 / 商户订单号 / 重量 / 结算汇率 / 商品价格 / 手续费 / 日本国内运费 …
国际物流费用明细 …
```

当前 `src/lib/recognize.functions.ts` 的 `segment()` 只按 `^子订单\s*[:：]` 切分子订单，因此单订单包裹识别后子订单数 = 0，整个商品+费用都被错误地塞进 parcel_block。

## 方案（仅改 `src/lib/recognize.functions.ts`）

### 1. `segment()` 兜底分支

在算出 `itemStarts` 之后：

- 若 `itemStarts.length === 0`，再扫一遍找以下两个锚点（取先出现的那行作为单子订单起点）：
  - `^商品清单$`
  - `^费用明细$`
- 找到则构造一个"伪子订单"块：从该行 → `intlStart` (或 lines.length)，作为唯一的 `item_blocks[0]`。
- 同时把 `parcelEnd` 更新为这个起点，使 parcel_block 不再吞掉商品/费用段。
- `hints.sub_order_nos` 留空即可（订单编号会在 item 抽取时识别）。

### 2. ItemSchema few-shot 补充

在 `FEWSHOT_ITEM` 末尾追加一段「单订单形态」示例：

```
【兜底：单订单包裹（没有"子订单："行）】
此时块以 `商品清单` 或 `费用明细` 开头：
- `订单编号` → sub_order_no
- 商品标题在 seller 行（如 "JDirectItems Fleamarket卖家:NEXUS"）之后
- "商品费用 17,100日元(≈830人民币)" → item_total_jpy / item_total_cny
- 其余字段语义不变（重量、结算汇率、商品价格、手续费、日本国内运费、支付方式、支付时间、商户订单号）
```

附 1 段真实样本输入 + 期望 JSON（用本次截图：sub_order_no=GPP8QCBCBP77XYF, item_title="Technics テクニクス スピーカーシステム SB-5A", item_total_jpy=17100, item_total_cny=830, weight_g=23800, exchange_rate=0.0485, unit_price_jpy=16800, service_fee_jpy=300, domestic_freight_jpy=0, merchant_order_no=AW9K3A847TWE, pay_method=微信支付, pay_at=2025-01-06T02:08:00+09:00, quantity=1）。

### 3. `extractSubItem` 关键字段判定

`isCritical` 已经覆盖 `item_total_jpy / unit_price_jpy / sub_order_no`，单订单形态下 `订单编号` 会被抽到 `sub_order_no`，无需调整。

### 4. 不动的部分

- 前端 `smart-recognize-panel.tsx` / `recognize-timeline.tsx` 不动 —— 流水线接口没变。
- 数据库 schema 不动。
- 多子订单逻辑不动（仅在 `itemStarts.length === 0` 时走兜底）。

## 验证

用户重新粘贴/上传单订单截图触发识别 → 应看到 timeline 中 `分段` 显示 1 个子订单块 → `子订单 #1 抽取` 命中 → 表单自动填出 1 条子订单。
