import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const ResultSchema = z.object({
  pieces: z.number().int().min(1).max(100000).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string().max(200),
  unit: z.string().max(8).nullable().optional(),
});

function gateway() {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

const TITLE_SYSTEM = `你是日本代购商品"打包件数"分析助手。
任务：根据商品标题判断这个商品里实际包含几个"小件"（用于单价拆分）。
注意：
- "100枚セット" / "30点まとめ" / "5個入り" / "12本セット" / "20冊" → 直接给出数字
- "ガチャ 1回" / "フィギュア 1個" / 单件商品 → 1
- "コンプ" 套装+前面的数字（如 "5種コンプ" → 5）
- "詰め合わせ" / "アソート" / "ジャンク まとめ" 没明确数字 → pieces=null
- 含糊不清、量词无法判断 → pieces=null，不要瞎猜
unit 字段：从标题里推单位（枚=张、点/個/本/冊/箱→ 个/本/册/箱），不确定填 null。
输出 JSON：{"pieces": number|null, "confidence": "high"|"medium"|"low", "reasoning": "简短中文说明", "unit": "..."|null}`;

const IMAGE_SYSTEM = `你是日本代购商品"打包件数"图像分析助手。
任务：数清楚图片里这件商品里有几个可独立售出的"小件"（用于单价拆分）。
注意：
- 一盒卡牌、一整袋小物件、一堆杂货 → 尽量数清楚可见数量
- 单一物品 → 1
- 完全数不清/重叠遮挡严重 → pieces=null，置信度 low
- 不要把单件商品的零件分别算（比如手办的底座+本体算 1 件）
输出 JSON：{"pieces": number|null, "confidence": "high"|"medium"|"low", "reasoning": "简短中文说明", "unit": "..."|null}`;

export const estimatePiecesFromTitle = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().nullable().optional(),
        title_cn: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const text = [data.title_cn, data.title].filter(Boolean).join(" / ").trim();
    if (!text) {
      return { ok: false as const, reason: "标题为空" };
    }
    try {
      const model = gateway()("google/gemini-3-flash-preview");
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ResultSchema }),
        messages: [
          { role: "system", content: TITLE_SYSTEM },
          { role: "user", content: `商品标题：${text}` },
        ],
      });
      return { ok: true as const, ...output };
    } catch (e) {
      return { ok: false as const, reason: (e as Error).message };
    }
  });

export const estimatePiecesFromImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        image_url: z.string().url(),
        title: z.string().nullable().optional(),
        title_cn: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const text = [data.title_cn, data.title].filter(Boolean).join(" / ").trim();
    try {
      const model = gateway()("google/gemini-2.5-flash");
      const { output } = await generateText({
        model,
        output: Output.object({ schema: ResultSchema }),
        messages: [
          { role: "system", content: IMAGE_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `商品标题：${text || "(无)"}` },
              { type: "image", image: new URL(data.image_url) },
            ],
          },
        ],
      });
      return { ok: true as const, ...output };
    } catch (e) {
      return { ok: false as const, reason: (e as Error).message };
    }
  });
