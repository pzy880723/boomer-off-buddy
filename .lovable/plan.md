# 智能识别升级方案

## 问题诊断

当前一次性把全部文字/截图丢给 `recognizeParcelBlock` 让模型同时输出 parcel + intl_fee + items[]，准确率低的原因：

1. 粘贴文字里大量噪声（导航、广告、推荐位、按钮文字）干扰模型
2. 没有利用 meruki 页面天然的"区块标题"结构（订单详情 / 国际物流费用明细 / 商品费用 ×N）
3. 一次输出 schema 太大，items 数组容易丢字段或漏件
4. 用户看不到中间过程，失败时不知道哪一步出错，也无法修

## 方案：两步识别管线 + 可视化时间线

### 第一步：分段（Segmenter）

不依赖 AI，本地用正则/关键词把粘贴文本切成结构化区块：

```text
原始文本
  ↓ 去噪（去导航/页脚/重复空行）
  ↓ 按锚点切分
{
  parcel_block:    "订单详情" 段（订单号/物流单号/状态/重量体积/收货地址）
  intl_fee_block:  "国际物流费用明细" 段（含金额/支付/发送方式 …）
  item_blocks:     ["商品费用 6000日元 …", "商品费用 …", …]   // 每个子订单一段
}
```

锚点关键词（可在 skill 里维护）：
- parcel：`订单信息` / `订单号` / `国际物流单号` / `收货地址`
- intl_fee：`国际物流费用总计` / `国际物流费用明细`
- item：`商品费用` / `订单编号` + `商户订单号` 配对出现

截图模式：第一步改为先调一次 vision 模型只做"OCR + 分段"，把原始文字 + 段落标记吐回来。

### 第二步：分块抽取（Extractor）

对每个区块独立调用一次结构化抽取，schema 比现在小得多，准确率高：

- `extractParcel(parcel_block)` → ParcelInfo
- `extractIntlFee(intl_fee_block)` → IntlFee
- `extractItem(item_block)` → SubItem  （并发 N 次，每个子订单一次）

每次都用：
- 较小的 zod schema（更聚焦）
- 1-2 条 few-shot 示例（prompt 内嵌真实样本）
- 后处理：金额去逗号/¥/円、日期归一 ISO、汇率正则补抽

### 第三步：校验与修复

- schema 通过 → 直接填表
- 关键字段缺失（如 item.item_total_jpy 为空）→ 对该块重试一次（可换 gemini-2.5-pro）
- 全部失败 → 把原文段落和报错回显给用户

### 服务端实现

新增 `src/lib/recognize.functions.ts`：

```ts
recognizeParcelPipeline({ text?, image_base64? })
  → AsyncIterable<{ step, status, data?, error? }>   // 流式
```

用 TanStack server route `/api/public/recognize-parcel`（SSE）流式吐出每一步事件，比改 createServerFn 流式更直接。

事件类型：
```
{ step:"preprocess",   status:"running"|"done"  }
{ step:"segment",      status:"done", data:{ parcel:bool, intl:bool, items:N } }
{ step:"extract_parcel", status:"done", data:{...} }
{ step:"extract_intl",   status:"done", data:{...} }
{ step:"extract_item",   status:"done", index, data:{...} }   // ×N
{ step:"validate",     status:"done", data:{ filled, missing:[...] } }
{ step:"complete",     status:"done", data:{ parcel, intl_fee, items[] } }
```

### 前端 UI：分析时间线

把现在的"识别中…"按钮换成一张展开式时间线卡片：

```text
✓ 预处理         去噪 1.2KB → 0.4KB        120ms
✓ 分段           找到 1+1+3 个区块         80ms
✓ 包裹信息       9/10 字段                 1.4s
✓ 国际物流       12/13 字段                1.3s
⟳ 子订单 1/3     正在解析…                 …
○ 子订单 2/3
○ 子订单 3/3
○ 字段校验
```

每行可展开看该步抽到的原始 JSON，方便用户判断是不是哪条信息没抓到。

## 准确率提升清单

| 改进 | 效果 |
|---|---|
| 文本分段后再抽取 | 噪声消除，schema 变小，最大幅度提升 |
| Few-shot 真实样本（在 skill 里维护） | 字段命名歧义大幅降低 |
| 子订单并发 + 每个独立抽取 | 多件商品不再相互"串味" |
| 失败块自动重试 + 升级到 gemini-2.5-pro | 兜底兜住边缘 case |
| 后处理金额/日期/汇率正则归一 | 数字类字段稳定 |
| 时间线把每步结果可视化 | 用户可立刻定位错的字段并手动改 |

## 生成 skill：`.workspace/skills/meruki-parcel-recognizer/`

```
SKILL.md                       # 何时用、调用方式、预期输入输出
references/
  field-glossary.md            # meruki 中文/日文字段 → 内部字段名 对照
  segment-anchors.md           # 分段锚点关键词清单
  few-shot-examples.md         # 1-2 条真实粘贴文本 + 标准 JSON
  postprocess-rules.md         # 金额/日期/汇率/重量正则规则
prompts/
  segment.md                   # 分段 prompt
  extract-parcel.md
  extract-intl-fee.md
  extract-item.md
```

`SKILL.md` 描述里写清楚"meruki 日本代购包裹订单识别"，未来 agent 检索到相关任务会自动加载。

## 需要你提供（关键）

为了让 few-shot 和分段锚点真实有效，需要 1-2 份真实样本：
- 一段用 GoFullPage 截屏后 OCR 出来的、或直接从 meruki 详情页复制粘贴的**完整原始文本**
- 对应"应该识别成什么"的几个关键字段值（手填即可）

没有也能先按现在内存里 mem://features/meruki-order-model 的字段定义生成一版骨架，等样本到了再迭代。

## 不动的部分

- 数据库 schema 不变
- 现有 `recognizeParcelBlock` 保留作为 fallback
- 表单结构、保存逻辑、列表/详情页不变

---

实施顺序：
1. 建 skill 目录骨架（先用合成样本占位）
2. 写 `recognize.functions.ts` 分段+抽取管线
3. 写 SSE 路由 `/api/public/recognize-parcel`
4. 前端把识别按钮换成时间线卡片，订阅 SSE
5. 等你给真实样本后，回填 few-shot + 锚点词，调一轮回归

请回答 3 个事：
1. **样本**：能不能贴一份真实 meruki 详情页粘贴文本？（最影响准确率）
2. **进度展示粒度**：上面的时间线 OK，还是希望更简化（一行 progress）？
3. **模型**：默认主路径用 `gemini-3-flash-preview`，仅失败重试时升级到 `gemini-2.5-pro`，可以吗？
