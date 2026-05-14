import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCompleteness } from "./japan-parcel.helpers";

// One order extracted from a list/detail screenshot.
const OrderSchema = z.object({
  source_order_no: z.string().nullable().optional(),
  item_title: z.string().nullable().optional(),
  item_title_cn: z.string().nullable().optional(),
  item_image_url: z.string().nullable().optional(),
  seller: z.string().nullable().optional(),
  price_jpy: z.number().nullable().optional(),
  service_fee_jpy: z.number().nullable().optional(),
  domestic_freight_jpy: z.number().nullable().optional(),
  intl_freight_jpy: z.number().nullable().optional(),
  total_jpy: z.number().nullable().optional(),
  weight_g: z.number().nullable().optional(),
  warehouse_location: z.string().nullable().optional(),
  tracking_no: z.string().nullable().optional(),
  purchased_at: z.string().nullable().optional(),
  status_text: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const ResultSchema = z.object({
  orders: z.array(OrderSchema).default([]),
});

export type ParsedOrder = z.infer<typeof OrderSchema>;

const SYSTEM_PROMPT = `你是一个 meruki 日本代购后台订单截图解析助手。用户会上传一张 meruki 订单列表或合并订单详情的整页长截图。请把图中**每一条订单**都提取出来，返回 JSON：
{
  "orders": [
    {
      "source_order_no": "订单号（如 MRK-2024-... 或纯数字）",
      "item_title": "商品标题（保留原日文）",
      "item_title_cn": "中文标题（如有）",
      "item_image_url": "商品缩略图 URL（如能从 img src 看到）",
      "seller": "卖家名称",
      "price_jpy": 商品价格（日元数字，无符号）,
      "service_fee_jpy": 代购手续费,
      "domestic_freight_jpy": 日本国内运费,
      "intl_freight_jpy": 国际运费,
      "total_jpy": 订单合计日元,
      "weight_g": 重量克,
      "warehouse_location": "仓位",
      "tracking_no": "物流单号",
      "purchased_at": "下单/采购时间 ISO 字符串",
      "status_text": "页面上看到的状态原文（如 已入库待选择邮寄方式 / 卖家已发货 / 已处理待入库 / 待发货 / 国际运输中 / 已签收）",
      "notes": "其它备注"
    }
  ]
}
规则：
- 看不到的字段一律返回 null，不要猜。
- 一张截图里能看到几条订单就返回几条，**不要漏**。
- 合并订单详情图：父订单本身可能没有商品，子订单作为独立 order 返回。
- 金额一律返回纯数字日元，不要千分位逗号或货币符号。`;

function mapStatus(text: string | null | undefined): string {
  if (!text) return "purchased";
  const t = text.trim();
  if (/签收|已收|delivered/i.test(t)) return "delivered";
  if (/国际|运输|发往|EMS|竹蜻蜓|shipping/i.test(t)) return "shipping_intl";
  if (/入库|到仓|warehouse|已到/i.test(t)) return "at_jp_warehouse";
  if (/完成|已上架|completed/i.test(t)) return "completed";
  return "purchased";
}

export const parseMerukiListScreenshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        image_base64: z.string().min(1),
        mime_type: z.string().default("image/png"),
      })
      .parse(input),
  )
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

    const dataUrl = data.image_base64.startsWith("data:")
      ? data.image_base64
      : `data:${data.mime_type};base64,${data.image_base64}`;

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ResultSchema }),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "请把这张截图里的所有订单都提取出来。" },
              { type: "image", image: dataUrl },
            ],
          },
        ],
      });

      const orders = (output.orders ?? []).map((o) => ({
        ...o,
        status: mapStatus(o.status_text),
      }));

      // Dedupe check against existing rows by source_order_no.
      const orderNos = orders
        .map((o) => o.source_order_no)
        .filter((x): x is string => !!x);
      let existing: Set<string> = new Set();
      if (orderNos.length) {
        const { data: rows } = await supabaseAdmin
          .from("japan_parcels")
          .select("source_order_no")
          .in("source_order_no", orderNos);
        existing = new Set(
          (rows ?? []).map((r) => r.source_order_no as string).filter(Boolean),
        );
      }

      return {
        ok: true as const,
        orders: orders.map((o) => ({
          ...o,
          already_exists: o.source_order_no
            ? existing.has(o.source_order_no)
            : false,
        })),
      };
    } catch (e) {
      return { ok: false as const, reason: (e as Error).message, orders: [] };
    }
  });

const ImportInputSchema = z.object({
  orders: z.array(
    OrderSchema.extend({
      status: z.string().default("purchased"),
    }),
  ),
});

export const importParsedOrders = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ImportInputSchema.parse(input))
  .handler(async ({ data }) => {
    let inserted = 0;
    let skipped = 0;
    for (const o of data.orders) {
      if (!o.source_order_no) {
        skipped += 1;
        continue;
      }
      // Skip if exists.
      const { data: existing } = await supabaseAdmin
        .from("japan_parcels")
        .select("id")
        .eq("source_order_no", o.source_order_no)
        .maybeSingle();
      if (existing) {
        skipped += 1;
        continue;
      }
      const row = {
        source: "meruki",
        source_order_no: o.source_order_no,
        item_title: o.item_title ?? null,
        item_title_cn: o.item_title_cn ?? null,
        item_image_url: o.item_image_url ?? null,
        seller: o.seller ?? null,
        price_jpy: o.price_jpy ?? null,
        service_fee_jpy: o.service_fee_jpy ?? null,
        domestic_freight_jpy: o.domestic_freight_jpy ?? null,
        intl_freight_jpy: o.intl_freight_jpy ?? null,
        total_jpy: o.total_jpy ?? null,
        weight_g: o.weight_g ?? null,
        warehouse_location: o.warehouse_location ?? null,
        tracking_no: o.tracking_no ?? null,
        purchased_at: o.purchased_at ?? null,
        status: o.status ?? "purchased",
        notes: o.notes ?? null,
      };
      const completeness = computeCompleteness(row);
      const { error } = await supabaseAdmin
        .from("japan_parcels")
        .insert({ ...row, completeness });
      if (error) {
        skipped += 1;
        continue;
      }
      inserted += 1;
    }
    return { ok: true, inserted, skipped };
  });
