import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const ParcelExtractSchema = z.object({
  source_order_no: z.string().nullable().optional(),
  tracking_no: z.string().nullable().optional(),
  item_title: z.string().nullable().optional(),
  item_title_cn: z.string().nullable().optional(),
  seller: z.string().nullable().optional(),
  price_jpy: z.number().nullable().optional(),
  service_fee_jpy: z.number().nullable().optional(),
  domestic_freight_jpy: z.number().nullable().optional(),
  intl_freight_jpy: z.number().nullable().optional(),
  total_jpy: z.number().nullable().optional(),
  warehouse_location: z.string().nullable().optional(),
  weight_g: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const recognizeParcelScreenshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        image_base64: z.string().min(1), // data URL or raw base64
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
    const model = gateway("google/gemini-3-flash-preview");

    const dataUrl = data.image_base64.startsWith("data:")
      ? data.image_base64
      : `data:${data.mime_type};base64,${data.image_base64}`;

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ParcelExtractSchema }),
        messages: [
          {
            role: "system",
            content:
              "你是一个日本代购订单截图识别助手。请从图片中提取订单字段，返回 JSON。所有金额为日元数字（不含货币符号），中文标题填 item_title_cn，原始日文填 item_title。无法识别的字段返回 null。",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "请识别这张订单截图中的字段。" },
              { type: "image", image: dataUrl },
            ],
          },
        ],
      });
      return { ok: true, fields: output };
    } catch (e) {
      const msg = (e as Error).message;
      return { ok: false, reason: msg };
    }
  });
