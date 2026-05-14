
# 用真实样本提升识别准确率

非常清楚。你给的这份完整复制文本是黄金样本，正好覆盖了三大区块和"包裹外噪声"（顶部导航/侧栏/底部"您可能还喜欢"商品列表/客服悬浮球文案）。这一份就足够把准确率拉上来。

## 关键发现（基于你的样本）

1. **包裹区块**起点严格是 `订单详情` 之后紧跟的 `订单信息`，终点是第一次出现 `子订单：` 之前。中间会出现 `附加保障` / `适用"新箱宝"服务` / `订单状态` 这些**必须丢弃**的子段。
2. **国际物流费用明细**起点是 `国际物流费用明细`，终点是 `关税` 或 `合计金额` 或 `下载购物明细`。
3. **每个子订单**的稳定锚点是 `子订单：XXXX`（XXXX = sub_order_no，可直接正则提取），终点是下一个 `子订单：` 或 `国际物流费用明细`。
4. **必须先做的整体噪声裁剪**：
   - 砍掉一切 `订单详情` 之前的内容（顶部导航/分类/搜索/账户菜单）
   - 砍掉 `您可能还喜欢` 之后的所有内容（推荐位 + 页脚 + 客服）
   - 这一刀下去，输入体积通常少 80%+，模型几乎不会再被串味

## 计划

### 1. 升级本地分段器 `segmentParcelText`

按上面发现重写切分逻辑（纯正则，无 AI）：

```text
trim:    [订单详情 …… 您可能还喜欢) 之间的内容
parcel:  [订单信息 …… 第一个 子订单：) 之间，并剔除 附加保障/订单状态 等子段
intl:    [国际物流费用明细 …… 关税|合计金额|下载购物明细)
items:   每个 子订单：(\w+) … 直到下一个 子订单：| 国际物流费用明细
```

子订单内部进一步用锚点 `商品费用` / `订单编号` / `入库重量` / `运费补差` 二次定位。

### 2. 把这份样本固化成 skill 资产

新增/覆盖：
- `.workspace/skills/meruki-parcel-recognizer/references/sample-full-page.md` — 你给的整段原文
- `.workspace/skills/meruki-parcel-recognizer/references/sample-expected.json` — 三大区块期望 JSON（parcel + intl_fee + items[2]）
- `.workspace/skills/meruki-parcel-recognizer/references/segment-anchors.md` — 上面的锚点规则更新（含丢弃段、起止边界）
- `.workspace/skills/meruki-parcel-recognizer/prompts/extract-parcel.md`、`extract-intl-fee.md`、`extract-item.md` — 每个 prompt 内嵌 1 条 few-shot（输入片段 → 期望 JSON），来自这份样本

### 3. 提升抽取阶段命中率

在 `recognize.functions.ts` 的三个 extractor：
- prompt 顶部塞入 few-shot（区块 → JSON）
- 字段说明用样本里**精确字眼**对齐：`国际物流单号` → `tracking_no`、`入库重量` → `weight_g`、`运费补差` → `freight_diff_jpy`、`强化内部加固` → `intl_reinforce_jpy`、`合单手续费` → `intl_merge_fee_jpy`、`存储天数` → `storage_days`、`最大边长（含包装）` → `max_side_cm`、`体积` → `volume_cm3`
- 后处理补强：
  - 金额：去 `日元`/`,`/`¥`/`円`/全角空格
  - 汇率：正则 `1日元≈([\d.]+)人民币`
  - 日期：`2024-12-27 22:53` → ISO
  - 重量：`18500g` / `9510g` → number
  - 体积：`199950cm³` → number
  - 收货人：`潘瞻远18657433310\n地址` → 拆 name/phone/address

### 4. UI 时间线增强（小改动）

在每个 step 的 detail 行显示"x/y 字段命中"和**裁剪前 → 裁剪后字符数**，让你一眼看到噪声被砍掉了多少：

```text
✓ 预处理   12,480 → 1,820 字符 (-85%)   80ms
✓ 分段     parcel ✓ · intl ✓ · items ×2  30ms
✓ 包裹     11/11 字段                    1.2s
✓ 国际     13/13 字段                    1.1s
✓ 子订单 1 13/13 字段                    1.0s
✓ 子订单 2 13/13 字段                    1.0s
```

### 5. 回归测试（手工验收）

把你这段文本贴进 `/purchase/japan-parcel/new`，期望：
- parcel.source_order_no = `KHDZ2DSDEKY9ETG`，tracking_no = `CN094890935JP`
- intl_fee.intl_total_jpy = 16410，intl_reinforce_jpy = 2500，intl_send_fee_jpy = 700
- items[0].sub_order_no = `MYAY2KCPVGY7WHY`，item_total_jpy = 7725，weight_g = 9510
- items[1].sub_order_no = `CYAE5T4WEF6XGCP`，item_total_jpy = 6000，weight_g = 7568

## 不动的部分

- 数据库 schema、表单、保存逻辑、`extension/` 旧抓取代码
- `recognizeParcelBlock` 仍保留作 fallback
- 模型策略：默认 `gemini-3-flash-preview`，关键字段缺失自动升级 `gemini-2.5-pro`

## 需要你确认 / 补充

1. **再来 1 份样本就更稳**：能不能再贴一份**只有 1 个子订单**的、和一份**带"国际物流未发货/合单待审核"等不同状态**的复制文本？两份就能覆盖 90%+ 真实场景。**没有也能先按这一份做，后面遇到 case 再迭代。**
2. 时间线展示我打算按上面那种"x/y 字段命中"的紧凑形式，OK 吗？
