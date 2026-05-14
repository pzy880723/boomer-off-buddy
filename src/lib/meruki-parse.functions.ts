import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Schemas ----------

const ParentSchema = z.object({
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
  intl_total_jpy: z.number().nullable().optional(),
  intl_total_cny: z.number().nullable().optional(),
  intl_freight_jpy: z.number().nullable().optional(),
  intl_ship_method: z.string().nullable().optional(),
  intl_charge_method: z.string().nullable().optional(),
  intl_keep_packaging_jpy: z.number().nullable().optional(),
  intl_reinforce_jpy: z.number().nullable().optional(),
  intl_send_fee_jpy: z.number().nullable().optional(),
  intl_photo_fee_jpy: z.number().nullable().optional(),
  intl_merge_fee_jpy: z.number().nullable().optional(),
  intl_points_used: z.number().nullable().optional(),
  intl_pay_method: z.string().nullable().optional(),
  intl_pay_at: z.string().nullable().optional(),
  intl_merchant_order_no: z.string().nullable().optional(),
  intl_exchange_rate: z.number().nullable().optional(),
});

const ItemSchema = z.object({
  sub_order_no: z.string().nullable().optional(),
  source_platform: z.string().nullable().optional(),
  item_title: z.string().nullable().optional(),
  item_title_cn: z.string().nullable().optional(),
  item_image_url: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  addon_service: z.string().nullable().optional(),
  unit_price_jpy: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  item_total_jpy: z.number().nullable().optional(),
  item_total_cny: z.number().nullable().optional(),
  item_price_jpy: z.number().nullable().optional(),
  service_fee_jpy: z.number().nullable().optional(),
  domestic_freight_jpy: z.number().nullable().optional(),
  freight_diff_jpy: z.number().nullable().optional(),
  weight_g: z.number().nullable().optional(),
  exchange_rate: z.number().nullable().optional(),
  pay_method: z.string().nullable().optional(),
  pay_at: z.string().nullable().optional(),
  merchant_order_no: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const TimelineEntrySchema = z.object({
  at: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
});

const ResultSchema = z.object({
  parent: ParentSchema.default({}),
  items: z.array(ItemSchema).default([]),
  status_timeline: z.array(TimelineEntrySchema).default([]),
});

export type ParsedParent = z.infer<typeof ParentSchema>;
export type ParsedItem = z.infer<typeof ItemSchema>;
export type ParsedTimelineEntry = z.infer<typeof TimelineEntrySchema>;

const SYSTEM_PROMPT = `你是 meruki 日本代购"合单大包裹"截图解析助手。用户会一次上传 1~6 张截图，对应同一个大包裹的不同区块（订单基础信息 / 订单状态时间线 / 国际物流费用明细 / 子订单商品 / 子订单费用）。请把所有截图合并理解为 **一个父订单 + N 个子订单**，输出 JSON：

{
  "parent": {
    "source_order_no": "父订单号（如 KHDZ2DSDEKY9ETG，长字母数字串）",
    "tracking_no": "国际物流单号（如 CN094890935JP）",
    "status_text": "状态原文（如 国际物流已发货 / 合单待审核 / 邮寄方式已选择）",
    "total_weight_g": 含包装总重(g),
    "volume_cm3": 体积(cm³),
    "max_side_cm": 最大边长(cm),
    "storage_days": 存储天数,
    "receiver_name": "收货人",
    "receiver_phone": "电话",
    "receiver_address": "收货地址(完整一行)",
    "intl_total_jpy": 国际物流费用总计JPY,
    "intl_total_cny": 国际物流费用总计CNY(约人民币的数字),
    "intl_freight_jpy": 国际物流费,
    "intl_ship_method": "发送方式（如 日本邮政 海运件）",
    "intl_charge_method": "收费方式（如 按重量收费 18,500g）",
    "intl_keep_packaging_jpy": 保留原始包装,
    "intl_reinforce_jpy": 强化内部加固,
    "intl_send_fee_jpy": 发送手续费,
    "intl_photo_fee_jpy": 拍照费,
    "intl_merge_fee_jpy": 合单手续费,
    "intl_points_used": 已使用积分,
    "intl_pay_method": "支付方式",
    "intl_pay_at": "支付时间 ISO",
    "intl_merchant_order_no": "国际物流商户订单号",
    "intl_exchange_rate": 汇率(0.0481之类)
  },
  "items": [
    {
      "sub_order_no": "子订单号（如 MYAY2KCPVGY7WHY 或 CYAE5T4WEF6XGCP）",
      "source_platform": "来源平台（如 JDirectItems Auction / Yahoo / Mercari）",
      "item_title": "商品标题（保留原日文）",
      "item_title_cn": "中文标题（如有）",
      "item_image_url": "商品图 URL",
      "condition": "商品状态（二手/未使用/新品 等）",
      "addon_service": "附加服务",
      "unit_price_jpy": 商品单价JPY,
      "quantity": 数量,
      "item_total_jpy": 商品费用合计JPY,
      "item_total_cny": 商品费用合计CNY(数字),
      "item_price_jpy": 商品价格(明细行),
      "service_fee_jpy": 手续费,
      "domestic_freight_jpy": 日本国内运费,
      "freight_diff_jpy": 运费补差,
      "weight_g": 入库重量(g),
      "exchange_rate": 该子订单结算汇率,
      "pay_method": "支付方式",
      "pay_at": "支付时间 ISO",
      "merchant_order_no": "商户订单号"
    }
  ],
  "status_timeline": [
    { "at": "2025/01/03 16:53 ISO 化", "text": "国际物流已发货" }
  ]
}

规则：
- 看不到的字段一律返回 null，不要猜测；多张图里同一个字段以最完整的为准。
- 子订单按截图里的顺序排列；子订单可能有 1~多个。
- 金额一律纯数字 JPY，不要千分位逗号、不要 ¥ / 円 / 人民币 字样；CNY 同理。
- 时间转 ISO（带 T）；如只有 "2024-12-23 21:41" 也输出 "2024-12-23T21:41:00"。
- "1日元≈0.0484人民币" 这类汇率提取为 0.0484 数字。
- 状态时间线按时间倒序或正序都可，原文照搬即可。`;

function mapStatus(text: string | null | undefined): string {
  if (!text) return "purchased";
  const t = text.trim();
  if (/签收|已收|delivered/i.test(t)) return "delivered";
  if (/国际|运输|发往|EMS|海运|空运|竹蜻蜓|shipping/i.test(t)) return "shipping_intl";
  if (/入库|到仓|warehouse|已到|合单/i.test(t)) return "at_jp_warehouse";
  if (/完成|已上架|completed/i.test(t)) return "completed";
  return "purchased";
}

// ---------- Parse ----------

const ParseInput = z.object({
  images: z
    .array(
      z.object({
        image_base64: z.string().min(1),
        mime_type: z.string().default("image/png"),
      }),
    )
    .min(1)
    .max(8),
});

export const parseMerukiParcelScreenshots = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ParseInput.parse(input))
  .handler(async ({ data }) => {
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
    const model = gateway("google/gemini-2.5-pro");

    const imageParts = data.images.map((img) => {
      const dataUrl = img.image_base64.startsWith("data:")
        ? img.image_base64
        : `data:${img.mime_type};base64,${img.image_base64}`;
      return { type: "image" as const, image: dataUrl };
    });

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ResultSchema }),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `这是一个合单大包裹的 ${data.images.length} 张分块截图，请整体理解后返回一个父订单 + 子订单数组 + 状态时间线。`,
              },
              ...imageParts,
            ],
          },
        ],
      });

      const parent = output.parent ?? {};
      const items = output.items ?? [];
      const timeline = output.status_timeline ?? [];

      // dedupe check on parent order no
      let already_exists = false;
      if (parent.source_order_no) {
        const { data: existing } = await supabaseAdmin
          .from("japan_parcels")
          .select("id")
          .eq("source_order_no", parent.source_order_no)
          .maybeSingle();
        already_exists = !!existing;
      }

      return {
        ok: true as const,
        parent,
        items,
        status_timeline: timeline,
        derived_status: mapStatus(parent.status_text),
        already_exists,
      };
    } catch (e) {
      return {
        ok: false as const,
        reason: (e as Error).message,
        parent: {} as ParsedParent,
        items: [] as ParsedItem[],
        status_timeline: [] as ParsedTimelineEntry[],
        derived_status: "purchased",
        already_exists: false,
      };
    }
  });

// ---------- Import ----------

const ImportInput = z.object({
  parent: ParentSchema,
  items: z.array(ItemSchema),
  status_timeline: z.array(TimelineEntrySchema).default([]),
  status: z.string().default("purchased"),
  overwrite: z.boolean().default(false),
});

export const importParsedParcel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ImportInput.parse(input))
  .handler(async ({ data }) => {
    const p = data.parent;
    if (!p.source_order_no) {
      return { ok: false as const, reason: "缺少父订单号", parent_id: null };
    }

    // Check existence
    const { data: existing } = await supabaseAdmin
      .from("japan_parcels")
      .select("id")
      .eq("source_order_no", p.source_order_no)
      .maybeSingle();

    if (existing && !data.overwrite) {
      return {
        ok: false as const,
        reason: "已存在同单号，跳过",
        parent_id: existing.id as string,
      };
    }

    const parentRow = {
      source: "meruki",
      source_order_no: p.source_order_no,
      tracking_no: p.tracking_no ?? null,
      status: data.status,
      status_text: p.status_text ?? null,
      total_weight_g: p.total_weight_g ?? null,
      volume_cm3: p.volume_cm3 ?? null,
      max_side_cm: p.max_side_cm ?? null,
      storage_days: p.storage_days ?? null,
      receiver_name: p.receiver_name ?? null,
      receiver_phone: p.receiver_phone ?? null,
      receiver_address: p.receiver_address ?? null,
      intl_total_jpy: p.intl_total_jpy ?? null,
      intl_total_cny: p.intl_total_cny ?? null,
      intl_freight_jpy: p.intl_freight_jpy ?? null,
      intl_ship_method: p.intl_ship_method ?? null,
      intl_charge_method: p.intl_charge_method ?? null,
      intl_keep_packaging_jpy: p.intl_keep_packaging_jpy ?? null,
      intl_reinforce_jpy: p.intl_reinforce_jpy ?? null,
      intl_send_fee_jpy: p.intl_send_fee_jpy ?? null,
      intl_photo_fee_jpy: p.intl_photo_fee_jpy ?? null,
      intl_merge_fee_jpy: p.intl_merge_fee_jpy ?? null,
      intl_points_used: p.intl_points_used ?? null,
      intl_pay_method: p.intl_pay_method ?? null,
      intl_pay_at: p.intl_pay_at ?? null,
      intl_merchant_order_no: p.intl_merchant_order_no ?? null,
      intl_exchange_rate: p.intl_exchange_rate ?? null,
      status_timeline: data.status_timeline ?? [],
    };

    let parentId: string;
    if (existing) {
      const { data: row, error } = await supabaseAdmin
        .from("japan_parcels")
        .update(parentRow)
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      parentId = row.id as string;
      // wipe existing items so we can fully replace
      await supabaseAdmin.from("japan_parcel_items").delete().eq("parent_id", parentId);
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("japan_parcels")
        .insert(parentRow)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      parentId = row.id as string;
    }

    if (data.items.length) {
      const itemRows = data.items.map((it, idx) => ({
        parent_id: parentId,
        position: idx,
        sub_order_no: it.sub_order_no ?? null,
        source_platform: it.source_platform ?? null,
        item_title: it.item_title ?? null,
        item_title_cn: it.item_title_cn ?? null,
        item_image_url: it.item_image_url ?? null,
        condition: it.condition ?? null,
        addon_service: it.addon_service ?? null,
        unit_price_jpy: it.unit_price_jpy ?? null,
        quantity: it.quantity ?? 1,
        item_total_jpy: it.item_total_jpy ?? null,
        item_total_cny: it.item_total_cny ?? null,
        item_price_jpy: it.item_price_jpy ?? null,
        service_fee_jpy: it.service_fee_jpy ?? null,
        domestic_freight_jpy: it.domestic_freight_jpy ?? null,
        freight_diff_jpy: it.freight_diff_jpy ?? null,
        weight_g: it.weight_g ?? null,
        exchange_rate: it.exchange_rate ?? null,
        pay_method: it.pay_method ?? null,
        pay_at: it.pay_at ?? null,
        merchant_order_no: it.merchant_order_no ?? null,
        notes: it.notes ?? null,
      }));
      const { error } = await supabaseAdmin.from("japan_parcel_items").insert(itemRows);
      if (error) throw new Error(error.message);
    }

    return {
      ok: true as const,
      parent_id: parentId,
      items_inserted: data.items.length,
      replaced: !!existing,
    };
  });
