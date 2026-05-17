import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// ====================================================================
// Lovable AI Gateway helper
// ====================================================================
function getModel(name = "google/gemini-3-flash-preview") {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  return gateway(name);
}

// ====================================================================
// 0. 预处理 / 分段（纯本地，无 AI）
// ====================================================================
//
// 真实样本（用户提供）映射出来的稳定锚点：
//   trim 起点:  订单详情
//   trim 终点:  您可能还喜欢 | 国际运费计算器 | 下载购物明细
//   parcel:     [订单信息 …… 第一个 子订单：) 之间，剔除"附加保障 / 适用 X 服务 / 订单状态"
//   intl:       [国际物流费用明细 …… 关税|合计金额|下载购物明细)
//   item ×N:    每个 "子订单：XXXX" → 下一个 "子订单：" 或 "国际物流费用明细"
//
// 同时直接用正则把 sub_order_no / source_order_no / tracking_no 抽出来，
// 即使 AI 抽取那一步抖动也不会丢这些关键号码。
// ====================================================================

const NOISE_LINE_RE =
  /^(首页|订单中心|个人中心|退出登录|消息中心|帮助中心|复制|查看|修改|删除|返回|更多|展开|收起|登录|注册|搜索|确定|取消|联系客服|意见反馈|关于我们|加载更多|下载APP|更多店铺|搜索助手|品牌库|国际物流|确认收货)$/;

// 包裹区块内部要剔除的"子段"：每段从该锚点开始，到下一个我们关心的锚点结束
const PARCEL_DROP_ANCHORS = [
  "附加保障",
  "订单状态",
];

// 全页面级噪声段（在 trim 之前先一刀切掉）
const PAGE_TAIL_ANCHORS = [
  "您可能还喜欢",
  "国际运费计算器",
  "关于挖煤姬",
  "客服在线时间",
];

function trimPage(text: string): string {
  let t = text;
  // 1) 砍掉头部：定位到 "订单详情"
  const headIdx = t.indexOf("订单详情");
  if (headIdx > 0) t = t.slice(headIdx);
  // 2) 砍掉尾部：第一个出现的尾部锚点之前
  let tailIdx = -1;
  for (const a of PAGE_TAIL_ANCHORS) {
    const i = t.indexOf(a);
    if (i > 0 && (tailIdx < 0 || i < tailIdx)) tailIdx = i;
  }
  if (tailIdx > 0) t = t.slice(0, tailIdx);
  return t;
}

function preprocess(text: string): string {
  return trimPage(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !NOISE_LINE_RE.test(l))
    .filter((l) => !/^[-=*_]{3,}$/.test(l))
    .join("\n");
}

// 在 parcel block 内剔除 "附加保障 …… 订单状态 ……" 这些干扰子段，
// 保留头部 "订单信息" 到第一个干扰锚点之前的内容
function shrinkParcelBlock(block: string): string {
  const lines = block.split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (PARCEL_DROP_ANCHORS.some((a) => lines[i].startsWith(a))) {
      cut = i;
      break;
    }
  }
  return lines.slice(0, cut).join("\n");
}

interface Segments {
  parcel_block: string | null;
  intl_fee_block: string | null;
  item_blocks: string[];
  // 直接正则抽出来的"必中"号码，用于 fallback 注入
  hints: {
    source_order_no: string | null;
    tracking_no: string | null;
    status_text: string | null;
    sub_order_nos: string[];
  };
  raw_chars: number;
  cleaned_chars: number;
}

function regexHints(cleaned: string) {
  const orderNo = cleaned.match(/订单号\s*[:：]?\s*([A-Z0-9]{8,})/);
  const tracking = cleaned.match(/国际物流单号\s*[:：]?\s*([A-Z0-9]{6,})/);
  const status = cleaned.match(/状态\s*[:：]?\s*([^\n]{2,30})/);
  const subs: string[] = [];
  const subRe = /子订单\s*[:：]\s*([A-Z0-9]{6,})/g;
  let m: RegExpExecArray | null;
  while ((m = subRe.exec(cleaned))) subs.push(m[1]);
  return {
    source_order_no: orderNo?.[1] ?? null,
    tracking_no: tracking?.[1] ?? null,
    status_text: status?.[1]?.trim() ?? null,
    sub_order_nos: subs,
  };
}

function segment(rawText: string): Segments {
  const cleaned = preprocess(rawText);
  const lines = cleaned.split("\n");

  // 找各区块起点
  let parcelStart = -1;
  let intlStart = -1;
  // 子订单起点：行以 "子订单：" 或 "子订单:" 开头
  const itemStarts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (parcelStart < 0 && /^订单信息$/.test(l)) parcelStart = i;
    if (intlStart < 0 && /^国际物流费用明细$/.test(l)) intlStart = i;
    if (/^子订单\s*[:：]/.test(l)) itemStarts.push(i);
  }

  // 兜底：如果没找到 "订单信息" 这行，但有 "订单号"，就以 "订单号" 行作为起点
  if (parcelStart < 0) {
    const i = lines.findIndex((l) => /^订单号/.test(l));
    if (i >= 0) parcelStart = i;
  }
  // 兜底：intl 没找到完整标题，用 "国际物流费用总计"
  if (intlStart < 0) {
    const i = lines.findIndex((l) => /国际物流费用总计/.test(l));
    if (i >= 0) intlStart = i;
  }

  // 单订单兜底：没有 "子订单：" 锚点时，用 "商品清单"/"费用明细" 作为唯一子订单起点
  let singleItemStart = -1;
  if (itemStarts.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (/^(商品清单|费用明细)$/.test(lines[i])) {
        singleItemStart = i;
        break;
      }
    }
    if (singleItemStart >= 0) itemStarts.push(singleItemStart);
  }

  const parcelEnd =
    itemStarts.length > 0
      ? itemStarts[0]
      : intlStart >= 0
      ? intlStart
      : lines.length;

  const intlEnd = lines.length; // intl 在尾部噪声已被 trimPage 砍掉之后基本就到末尾

  const sliceLines = (from: number, to: number) =>
    from < 0 ? null : lines.slice(from, to).join("\n");

  // parcel：取 parcelStart..parcelEnd，再剔除附加保障 / 订单状态 子段
  let parcel_block = sliceLines(parcelStart, parcelEnd);
  if (parcel_block) parcel_block = shrinkParcelBlock(parcel_block);

  const intl_fee_block = sliceLines(intlStart, intlEnd);

  // 子订单：每段从 itemStarts[k] 到 itemStarts[k+1] 或 intlStart 或 lines.length
  const item_blocks: string[] = [];
  for (let k = 0; k < itemStarts.length; k++) {
    const from = itemStarts[k];
    const next = itemStarts[k + 1] ?? (intlStart > from ? intlStart : lines.length);
    item_blocks.push(lines.slice(from, next).join("\n"));
  }

  return {
    parcel_block,
    intl_fee_block,
    item_blocks,
    hints: regexHints(cleaned),
    raw_chars: rawText.length,
    cleaned_chars: cleaned.length,
  };
}

// ====================================================================
// 1. 后处理：金额/汇率/日期/地址归一
// ====================================================================
const stripNum = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[,\s¥￥円]/g, "");
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// "2024-12-27 22:53" → ISO with +09:00
const toIsoJp = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // already ISO
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T]?(\d{1,2})?:?(\d{1,2})?/);
  if (!m) return s;
  const [, y, mo, d, h = "0", mi = "0"] = m;
  const pad = (x: string) => x.padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+09:00`;
};

// "1日元≈0.0481人民币" → 0.0481
const extractRate = (raw: string): number | null => {
  const m = raw.match(/1\s*日元\s*[≈=]\s*([0-9.]+)\s*人民币/);
  return m ? Number(m[1]) : null;
};

// "潘瞻远18657433310\n地址" → { name, phone, address }
function splitReceiver(block: string): {
  receiver_name: string | null;
  receiver_phone: string | null;
  receiver_address: string | null;
} {
  const idx = block.indexOf("收货地址");
  if (idx < 0) return { receiver_name: null, receiver_phone: null, receiver_address: null };
  const tail = block.slice(idx + "收货地址".length).split("\n").map((l) => l.trim()).filter(Boolean);
  // 第一行通常是 "姓名 + 11 位手机号" 拼一起
  const first = tail[0] ?? "";
  const phoneMatch = first.match(/(1\d{10})/);
  const phone = phoneMatch?.[1] ?? null;
  const name = phone ? first.replace(phone, "").trim() || null : first || null;
  const address = tail.slice(1).join(" ").trim() || null;
  return { receiver_name: name, receiver_phone: phone, receiver_address: address };
}

function normalizeParcel<T extends Record<string, unknown>>(o: T, rawBlock?: string): T {
  const r: Record<string, unknown> = { ...o };
  for (const k of ["total_weight_g", "volume_cm3", "max_side_cm", "storage_days"]) {
    if (k in r) r[k] = stripNum(r[k]);
  }
  // 用本地解析覆盖收货地址三件套（更稳）
  if (rawBlock) {
    const rec = splitReceiver(rawBlock);
    if (rec.receiver_name) r.receiver_name = rec.receiver_name;
    if (rec.receiver_phone) r.receiver_phone = rec.receiver_phone;
    if (rec.receiver_address) r.receiver_address = rec.receiver_address;
  }
  return r as T;
}

function normalizeIntl<T extends Record<string, unknown>>(o: T, rawBlock?: string): T {
  const r: Record<string, unknown> = { ...o };
  for (const k of Object.keys(r)) {
    if (k.endsWith("_jpy") || k.endsWith("_cny") || k === "intl_points_used") {
      r[k] = stripNum(r[k]);
    }
    if (k === "intl_exchange_rate") r[k] = stripNum(r[k]);
  }
  if (r.intl_pay_at) r.intl_pay_at = toIsoJp(r.intl_pay_at);
  if (rawBlock && r.intl_exchange_rate == null) r.intl_exchange_rate = extractRate(rawBlock);
  return r as T;
}

function normalizeItem<T extends Record<string, unknown>>(o: T, rawBlock?: string): T {
  const r: Record<string, unknown> = { ...o };
  for (const k of Object.keys(r)) {
    if (k.endsWith("_jpy") || k.endsWith("_cny")) r[k] = stripNum(r[k]);
    if (k === "weight_g" || k === "quantity") r[k] = stripNum(r[k]);
    if (k === "exchange_rate") r[k] = stripNum(r[k]);
  }
  if (r.pay_at) r.pay_at = toIsoJp(r.pay_at);
  if (r.quantity == null) r.quantity = 1;
  if (rawBlock) {
    if (r.exchange_rate == null) r.exchange_rate = extractRate(rawBlock);
    if (!r.sub_order_no) {
      const m = rawBlock.match(/子订单\s*[:：]\s*([A-Z0-9]{6,})/);
      if (m) r.sub_order_no = m[1];
    }
  }
  return r as T;
}

// ====================================================================
// 2. 三个分块 schema
// ====================================================================
const ParcelSchema = z.object({
  source_order_no: z.string().nullable().optional(),
  tracking_no: z.string().nullable().optional(),
  status_text: z.string().nullable().optional(),
  total_weight_g: z.number().nullable().optional(),
  volume_cm3: z.number().nullable().optional(),
  max_side_cm: z.number().nullable().optional(),
  storage_days: z.number().nullable().optional(),
  receiver_name: z.string().nullable().optional(),
  receiver_phone: z.string().nullable().optional(),
  receiver_address: z.string().nullable().optional(),
});

const IntlFeeSchema = z.object({
  intl_total_jpy: z.number().nullable().optional(),
  intl_total_cny: z.number().nullable().optional(),
  intl_pay_method: z.string().nullable().optional(),
  intl_pay_at: z.string().nullable().optional(),
  intl_merchant_order_no: z.string().nullable().optional(),
  intl_exchange_rate: z.number().nullable().optional(),
  intl_freight_jpy: z.number().nullable().optional(),
  intl_ship_method: z.string().nullable().optional(),
  intl_charge_method: z.string().nullable().optional(),
  intl_keep_packaging_jpy: z.number().nullable().optional(),
  intl_reinforce_jpy: z.number().nullable().optional(),
  intl_send_fee_jpy: z.number().nullable().optional(),
  intl_photo_fee_jpy: z.number().nullable().optional(),
  intl_merge_fee_jpy: z.number().nullable().optional(),
  intl_points_used: z.number().nullable().optional(),
});

const ItemSchema = z.object({
  sub_order_no: z.string().nullable().optional(),
  merchant_order_no: z.string().nullable().optional(),
  pay_method: z.string().nullable().optional(),
  pay_at: z.string().nullable().optional(),
  weight_g: z.number().nullable().optional(),
  exchange_rate: z.number().nullable().optional(),
  unit_price_jpy: z.number().nullable().optional(),
  service_fee_jpy: z.number().nullable().optional(),
  domestic_freight_jpy: z.number().nullable().optional(),
  freight_diff_jpy: z.number().nullable().optional(),
  item_total_jpy: z.number().nullable().optional(),
  item_total_cny: z.number().nullable().optional(),
  item_title: z.string().nullable().optional(),
  item_title_cn: z.string().nullable().optional(),
  item_image_url: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
});

// ====================================================================
// 3. Few-shot prompt 片段（取自真实样本）
// ====================================================================
const FEWSHOT_PARCEL = `
【字段对照】
  订单号 → source_order_no
  国际物流单号 → tracking_no
  状态 → status_text
  重量（含包装盒）"18500g" → total_weight_g=18500
  体积 "199950cm³" → volume_cm3=199950
  最大边长（含包装）"75cm" → max_side_cm=75
  存储天数 "0天" → storage_days=0
  收货地址下一行 "潘瞻远18657433310" → receiver_name="潘瞻远", receiver_phone="18657433310"
  再下一行 "中国大陆 上海市 …" → receiver_address

【示例输入】
订单信息
订单号 KHDZ2DSDEKY9ETG
国际物流单号 CN094890935JP
状态 国际物流已发货
重量（含包装盒）
18500g
体积
199950cm³
最大边长（含包装） 75cm
存储天数 0天
收货地址
潘瞻远18657433310
中国大陆 上海市 上海城区 闵行区 光华路728号C5栋3层左侧

【示例输出】
{"source_order_no":"KHDZ2DSDEKY9ETG","tracking_no":"CN094890935JP","status_text":"国际物流已发货","total_weight_g":18500,"volume_cm3":199950,"max_side_cm":75,"storage_days":0,"receiver_name":"潘瞻远","receiver_phone":"18657433310","receiver_address":"中国大陆 上海市 上海城区 闵行区 光华路728号C5栋3层左侧"}
`.trim();

const FEWSHOT_INTL = `
【字段对照】
  国际物流费用总计 X日元(≈Y人民币) → intl_total_jpy=X, intl_total_cny=Y
  支付方式 → intl_pay_method
  支付时间 → intl_pay_at（ISO8601 +09:00）
  商户订单号 → intl_merchant_order_no
  结算汇率 "1日元≈0.0481人民币" → intl_exchange_rate=0.0481
  国际物流费 → intl_freight_jpy
  发送方式 "日本邮政 海运件" → intl_ship_method
  收费方式 "按重量收费 18,500g" → intl_charge_method
  保留原始包装 → intl_keep_packaging_jpy
  强化内部加固(...) → intl_reinforce_jpy
  发送手续费 → intl_send_fee_jpy
  拍照费 → intl_photo_fee_jpy
  合单手续费 → intl_merge_fee_jpy
  已使用积分 "0 (1积分=1日元)" → intl_points_used=0

【示例输入】
国际物流费用明细
国际物流费用总计 16,410日元(≈790人民币)
支付方式 支付宝
支付时间 2024-12-27 22:53
商户订单号 VZT493JP38GS
结算汇率 1日元≈0.0481人民币
国际物流费 8,600日元
发送方式 日本邮政 海运件
收费方式 按重量收费 18,500g
保留原始包装 0日元
强化内部加固(15kg~20kg) 2,500日元
发送手续费 700日元
拍照费 0日元
合单手续费 0日元
已使用积分 0 (1积分=1日元)

【示例输出】
{"intl_total_jpy":16410,"intl_total_cny":790,"intl_pay_method":"支付宝","intl_pay_at":"2024-12-27T22:53:00+09:00","intl_merchant_order_no":"VZT493JP38GS","intl_exchange_rate":0.0481,"intl_freight_jpy":8600,"intl_ship_method":"日本邮政 海运件","intl_charge_method":"按重量收费 18,500g","intl_keep_packaging_jpy":0,"intl_reinforce_jpy":2500,"intl_send_fee_jpy":700,"intl_photo_fee_jpy":0,"intl_merge_fee_jpy":0,"intl_points_used":0}
`.trim();

const FEWSHOT_ITEM = `
【字段对照】
  子订单：XXXX → sub_order_no=XXXX
  商品费用 X日元(≈Y人民币) → item_total_jpy=X, item_total_cny=Y
  订单编号 → sub_order_no（与"子订单："同值，二者取一）
  商户订单号 → merchant_order_no（**和 sub_order_no 不同**）
  支付方式 → pay_method
  支付时间 → pay_at（ISO8601 +09:00）
  入库重量 "9510g" → weight_g=9510
  结算汇率 "1日元≈0.0492人民币" → exchange_rate=0.0492
  商品价格 → unit_price_jpy（单价；quantity 默认 1）
  手续费 → service_fee_jpy
  日本国内运费 → domestic_freight_jpy
  运费补差 → freight_diff_jpy
  商品标题（日文原文）→ item_title（出现在分类如 "JDirectItems Auction" 之后那行）
  附加服务 / 二手 / 易碎品 / 航空禁运 等都不是标题，**忽略**
  item_title_cn 没有就 null，不要瞎翻

【示例输入】
子订单：CYAE5T4WEF6XGCP
商品信息
商品单价
商品数量
JDirectItems Auction
♪・希少モデル ダイアトーン DIATONE　MODEL　MC-150 MODULAR STEREO カセット FMチューナー プレーヤー モジュラーステレオ・♪管1218-50
二手
易碎品
航空禁运
附加服务
未选择
5,800日元
1
商品费用 6,000日元(≈291人民币)
订单编号 CYAE5T4WEF6XGCP
支付方式 支付宝
支付时间 2024-12-23 21:41
商户订单号 MGZ63TCXCXDW7CCARP
入库重量 7568g
结算汇率 1日元≈0.0484人民币
商品价格 5,800日元
手续费 200日元
日本国内运费 0日元
运费补差 1,980日元

【示例输出】
{"sub_order_no":"CYAE5T4WEF6XGCP","merchant_order_no":"MGZ63TCXCXDW7CCARP","pay_method":"支付宝","pay_at":"2024-12-23T21:41:00+09:00","weight_g":7568,"exchange_rate":0.0484,"unit_price_jpy":5800,"service_fee_jpy":200,"domestic_freight_jpy":0,"freight_diff_jpy":1980,"item_total_jpy":6000,"item_total_cny":291,"item_title":"♪・希少モデル ダイアトーン DIATONE　MODEL　MC-150 MODULAR STEREO カセット FMチューナー プレーヤー モジュラーステレオ・♪管1218-50","item_title_cn":null,"quantity":1}

【兜底：单订单包裹（无"子订单："行）】
此时块以 \`商品清单\` 或 \`费用明细\` 开头，整段就是**唯一**子订单：
  订单编号 → sub_order_no
  商户订单号 → merchant_order_no（与 sub_order_no 不同）
  商品标题在 seller 行（如 "JDirectItems Fleamarket卖家:NEXUS"）之后那行
  "商品费用 X日元(≈Y人民币)" → item_total_jpy=X, item_total_cny=Y
  其余字段（重量/结算汇率/商品价格/手续费/日本国内运费/支付方式/支付时间）语义同上

【示例输入】
商品清单
JDirectItems Fleamarket卖家:NEXUS
Technics テクニクス スピーカーシステム SB-5A
二手 物流保障 没有明显的损伤或污渍 航空禁运
附加服务
未选择
16,800日元
1
费用明细
商品费用 17,100日元(≈830人民币)
订单编号 GPP8QCBCBP77XYF
支付方式 微信支付
支付时间 2025-01-06 02:08
商户订单号 AW9K3A847TWE
重量 23800g
结算汇率 1日元≈0.0485人民币
商品价格 16,800日元
手续费 300日元
日本国内运费 0日元

【示例输出】
{"sub_order_no":"GPP8QCBCBP77XYF","merchant_order_no":"AW9K3A847TWE","pay_method":"微信支付","pay_at":"2025-01-06T02:08:00+09:00","weight_g":23800,"exchange_rate":0.0485,"unit_price_jpy":16800,"service_fee_jpy":300,"domestic_freight_jpy":0,"freight_diff_jpy":null,"item_total_jpy":17100,"item_total_cny":830,"item_title":"Technics テクニクス スピーカーシステム SB-5A","item_title_cn":null,"quantity":1}
`.trim();

// ====================================================================
// 4. 通用单段抽取（带兜底升级模型重试）
// ====================================================================
async function extractWith<T extends z.ZodTypeAny>(args: {
  schema: T;
  systemPrompt: string;
  block: string;
  primaryModel?: string;
  fallbackModel?: string;
  isCritical: (v: z.infer<T>) => boolean;
}): Promise<{
  ok: boolean;
  data: z.infer<T>;
  attempts: number;
  model: string;
  reason?: string;
}> {
  const primary = args.primaryModel ?? "google/gemini-3-flash-preview";
  const fallback = args.fallbackModel ?? "google/gemini-2.5-pro";

  let lastOut: z.infer<T> = {} as z.infer<T>;
  let lastModel = primary;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const modelName = attempt === 1 ? primary : fallback;
    lastModel = modelName;
    try {
      const { output } = await generateText({
        model: getModel(modelName),
        output: Output.object({ schema: args.schema }),
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.block },
        ],
      });
      const out = output as z.infer<T>;
      lastOut = out;
      if (args.isCritical(out)) {
        return { ok: true, data: out, attempts: attempt, model: modelName };
      }
      if (attempt === 2) {
        return { ok: false, data: out, attempts: 2, model: modelName, reason: "关键字段缺失" };
      }
    } catch (e) {
      if (attempt === 2) {
        return {
          ok: false,
          data: lastOut,
          attempts: 2,
          model: modelName,
          reason: (e as Error).message,
        };
      }
    }
  }
  return { ok: false, data: lastOut, attempts: 0, model: lastModel, reason: "unknown" };
}

// ====================================================================
// SERVER FUNCTIONS — 客户端按管线顺序调用
// ====================================================================

// --- Step 1: 分段（纯本地，瞬间返回） ---
export const segmentParcelText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(1).max(50000) }).parse(input),
  )
  .handler(async ({ data }) => {
    return { ok: true as const, segments: segment(data.text) };
  });

// --- Step 1b: 截图 → OCR + 分段 ---
export const ocrAndSegment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        image_base64: z.string().min(1),
        mime_type: z.string().default("image/png"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const dataUrl = data.image_base64.startsWith("data:")
      ? data.image_base64
      : `data:${data.mime_type};base64,${data.image_base64}`;
    try {
      const { text } = await generateText({
        model: getModel("google/gemini-2.5-flash"),
        messages: [
          {
            role: "system",
            content:
              "你是OCR助手。请把这张 meruki 包裹订单截图中的所有可见文字按从上到下、从左到右的顺序原样输出。保留行结构，不要解释，不要总结，不要翻译，不要加标记。",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "请输出图片中所有文字。" },
              { type: "image", image: dataUrl },
            ],
          },
        ],
      });
      return {
        ok: true as const,
        ocr_text: text,
        segments: segment(text),
      };
    } catch (e) {
      return { ok: false as const, reason: (e as Error).message };
    }
  });

// --- Step 2a: 抽 parcel ---
export const extractParcelInfo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ block: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const r = await extractWith({
      schema: ParcelSchema,
      systemPrompt:
        "你是 meruki 包裹订单详情解析器。从输入文本中按 schema 提取字段，返回 JSON。所有数字字段去掉单位/逗号。找不到的字段返回 null，**不要瞎猜**。\n\n" +
        FEWSHOT_PARCEL,
      block: data.block,
      isCritical: (v) => !!v.source_order_no,
    });
    return { ...r, data: normalizeParcel(r.data, data.block) };
  });

// --- Step 2b: 抽 intl_fee ---
export const extractIntlFee = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ block: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const r = await extractWith({
      schema: IntlFeeSchema,
      systemPrompt:
        "你是 meruki 国际物流费用明细解析器。按 schema 提取，返回 JSON。所有金额纯数字（去逗号、去 '日元'）。结算汇率从 '1日元≈X人民币' 取 X。支付时间转 ISO8601 +09:00。没出现的字段 null。\n\n" +
        FEWSHOT_INTL,
      block: data.block,
      isCritical: (v) => v.intl_total_jpy != null,
    });
    return { ...r, data: normalizeIntl(r.data, data.block) };
  });

// --- Step 2c: 抽单个子订单 ---
export const extractSubItem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ block: z.string().min(1), index: z.number() }).parse(input),
  )
  .handler(async ({ data }) => {
    const r = await extractWith({
      schema: ItemSchema,
      systemPrompt:
        "你是 meruki 子订单解析器。下面这段以 `子订单：XXXX` 开头的文本对应**一个**子订单，按 schema 提取，返回 JSON。所有金额/重量/汇率纯数字。`订单编号` 和 `商户订单号` 是不同字段。日文原文标题→item_title；item_title_cn 没有就 null（不要翻译）。quantity 默认 1。\n\n" +
        FEWSHOT_ITEM,
      block: data.block,
      isCritical: (v) =>
        v.item_total_jpy != null || v.unit_price_jpy != null || !!v.sub_order_no,
    });
    return { ...r, index: data.index, data: normalizeItem(r.data, data.block) };
  });

// ====================================================================
// 预扫订单号（识别前轻量查重）
//   - 文字模式：复用本地正则 hints，0 token
//   - 截图模式：用最便宜的视觉模型只问一句订单号
// ====================================================================
const PeekSchema = z.object({
  order_no: z.string().nullable().optional(),
});

export const peekOrderNo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(1).max(50000).optional(),
        image_base64: z.string().min(1).optional(),
        mime_type: z.string().default("image/png").optional(),
      })
      .refine((d) => !!d.text || !!d.image_base64, "text or image_base64 required")
      .parse(input),
  )
  .handler(async ({ data }) => {
    // 文字：正则直接拿
    if (data.text) {
      const cleaned = preprocess(data.text);
      const hints = regexHints(cleaned);
      return {
        ok: true as const,
        order_no: hints.source_order_no,
        source: "regex" as const,
      };
    }
    // 截图：最便宜的视觉模型
    try {
      const dataUrl = data.image_base64!.startsWith("data:")
        ? data.image_base64!
        : `data:${data.mime_type ?? "image/png"};base64,${data.image_base64}`;
      const { output } = await generateText({
        model: getModel("google/gemini-2.5-flash-lite"),
        output: Output.object({ schema: PeekSchema }),
        messages: [
          {
            role: "system",
            content:
              "你是订单号提取助手。只看图片中的『订单号』『注文番号』『受付番号』『订单编号』标签后面紧跟的那串字符（通常是 8 位以上的字母数字混合），返回 JSON {\"order_no\": \"...\"}。没有就返回 {\"order_no\": null}。不要解释。",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "图片中的订单号是？" },
              { type: "image", image: dataUrl },
            ],
          },
        ],
      });
      const out = output as z.infer<typeof PeekSchema>;
      const orderNo = (out.order_no ?? "").trim();
      return {
        ok: true as const,
        order_no: orderNo && orderNo.length >= 6 ? orderNo : null,
        source: "ai-lite" as const,
      };
    } catch (e) {
      return {
        ok: false as const,
        order_no: null,
        source: "ai-lite" as const,
        reason: (e as Error).message,
      };
    }
  });
