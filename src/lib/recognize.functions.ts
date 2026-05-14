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
const NOISE_LINE_RE =
  /^(首页|订单中心|个人中心|退出登录|消息中心|帮助中心|复制|查看|修改|删除|返回|更多|展开|收起|登录|注册|搜索|确定|取消|联系客服|意见反馈|关于我们|加载更多)$/;

function preprocess(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !NOISE_LINE_RE.test(l))
    .filter((l) => !/^[-=*_]{3,}$/.test(l))
    .join("\n");
}

interface Segments {
  parcel_block: string | null;
  intl_fee_block: string | null;
  item_blocks: string[];
  raw_chars: number;
  cleaned_chars: number;
}

function segment(rawText: string): Segments {
  const cleaned = preprocess(rawText);
  const lines = cleaned.split("\n");

  // index of section starts
  let parcelStart = -1;
  let intlStart = -1;
  const itemStarts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (
      parcelStart < 0 &&
      (/^订单信息$/.test(l) ||
        /^订单详情$/.test(l) ||
        /^订单号/.test(l))
    ) {
      parcelStart = i;
    }
    if (intlStart < 0 && /国际物流费用(总计|明细)/.test(l)) {
      intlStart = i;
    }
    if (/^商品费用/.test(l)) {
      itemStarts.push(i);
    }
  }

  const slice = (from: number, to: number) =>
    from < 0 ? null : lines.slice(from, to < 0 ? lines.length : to).join("\n");

  // parcel ends at intl start or first item
  const parcelEnd =
    intlStart >= 0 ? intlStart : itemStarts[0] ?? lines.length;
  const intlEnd = itemStarts[0] ?? lines.length;

  const itemBlocks: string[] = [];
  for (let i = 0; i < itemStarts.length; i++) {
    const from = itemStarts[i];
    const to = itemStarts[i + 1] ?? lines.length;
    itemBlocks.push(lines.slice(from, to).join("\n"));
  }

  return {
    parcel_block: slice(parcelStart, parcelEnd),
    intl_fee_block: slice(intlStart, intlEnd),
    item_blocks: itemBlocks,
    raw_chars: rawText.length,
    cleaned_chars: cleaned.length,
  };
}

// ====================================================================
// 1. 后处理：金额/汇率/日期归一
// ====================================================================
const stripNum = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = String(v).replace(/[,\s¥￥]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

function normalizeParcel<T extends Record<string, unknown>>(o: T): T {
  const r: Record<string, unknown> = { ...o };
  for (const k of [
    "total_weight_g",
    "volume_cm3",
    "max_side_cm",
    "storage_days",
  ]) {
    if (k in r) r[k] = stripNum(r[k]);
  }
  return r as T;
}

function normalizeIntl<T extends Record<string, unknown>>(o: T): T {
  const r: Record<string, unknown> = { ...o };
  for (const k of Object.keys(r)) {
    if (k.endsWith("_jpy") || k.endsWith("_cny") || k === "intl_points_used") {
      r[k] = stripNum(r[k]);
    }
    if (k === "intl_exchange_rate") r[k] = stripNum(r[k]);
  }
  return r as T;
}

function normalizeItem<T extends Record<string, unknown>>(o: T): T {
  const r: Record<string, unknown> = { ...o };
  for (const k of Object.keys(r)) {
    if (k.endsWith("_jpy") || k.endsWith("_cny")) r[k] = stripNum(r[k]);
    if (k === "weight_g" || k === "quantity") r[k] = stripNum(r[k]);
    if (k === "exchange_rate") r[k] = stripNum(r[k]);
  }
  if (r.quantity == null) r.quantity = 1;
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
// 3. 通用单段抽取（带兜底升级模型重试）
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

  for (let attempt = 1; attempt <= 2; attempt++) {
    const modelName = attempt === 1 ? primary : fallback;
    try {
      const { output } = await generateText({
        model: getModel(modelName),
        output: Output.object({ schema: args.schema }),
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.block },
        ],
      });
      if (args.isCritical(output)) {
        return { ok: true, data: output, attempts: attempt, model: modelName };
      }
      // critical missing → continue to fallback
      if (attempt === 2) {
        return { ok: false, data: output, attempts: 2, model: modelName, reason: "关键字段缺失" };
      }
    } catch (e) {
      if (attempt === 2) {
        return {
          ok: false,
          data: {} as z.infer<T>,
          attempts: 2,
          model: modelName,
          reason: (e as Error).message,
        };
      }
    }
  }
  return { ok: false, data: {} as z.infer<T>, attempts: 0, model: primary, reason: "unknown" };
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
        "你是 meruki 包裹订单详情解析器。从下面的「订单详情」纯文本中提取字段，按 JSON schema 返回。所有金额/数字纯数字（去逗号、去单位）。地址里的姓名+电话剥离到 receiver_name / receiver_phone。找不到的字段返回 null，不要瞎猜。",
      block: data.block,
      isCritical: (v) => !!v.source_order_no,
    });
    return { ...r, data: normalizeParcel(r.data) };
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
        "你是 meruki 国际物流费用明细解析器。从下面文本中按 JSON schema 提取字段。所有金额纯数字。结算汇率抽取 `1日元≈X人民币` 的 X 值。支付时间转 ISO8601（默认 +09:00）。没出现的字段返回 null。",
      block: data.block,
      isCritical: (v) => v.intl_total_jpy != null,
    });
    return { ...r, data: normalizeIntl(r.data) };
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
        "你是 meruki 子订单解析器。下面这段以 `商品费用` 开头的文本对应**一个**子订单，请按 schema 提取字段。所有金额纯数字。`商品费用 X日元(≈Y人民币)` → item_total_jpy=X, item_total_cny=Y。订单编号填 sub_order_no，商户订单号填 merchant_order_no（不同字段）。日文标题→item_title，中文翻译→item_title_cn（没有就 null）。quantity 默认 1。",
      block: data.block,
      isCritical: (v) => v.item_total_jpy != null || v.unit_price_jpy != null,
    });
    return { ...r, index: data.index, data: normalizeItem(r.data) };
  });
