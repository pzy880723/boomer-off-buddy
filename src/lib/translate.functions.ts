import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const InputSchema = z.object({
  titles: z.array(z.string().min(1).max(500)).min(1).max(40),
});

const OutSchema = z.object({
  translations: z.array(z.string()),
});

const SYSTEM = `你是日本代购商品标题翻译助手。请将下列日文商品标题逐条翻译为简洁、自然、准确的中文标题。
要求：
- 保留品牌、型号、数字、规格、颜色、尺寸等关键信息
- 去掉「未使用」「中古」「美品」「送料無料」「即決」「新品」「正規品」等冗余销售用词
- 不要加任何前缀/编号/引号
- 输出 JSON：{"translations": ["...", "..."]}，与输入数组同长度同顺序`;

export const translateTitles = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
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
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: OutSchema }),
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: data.titles.map((t, i) => `${i + 1}. ${t}`).join("\n"),
          },
        ],
      });
      // pad / trim to match input length
      const result = data.titles.map((_, i) => output.translations[i] ?? null);
      return { ok: true as const, translations: result };
    } catch (e) {
      return { ok: false as const, reason: (e as Error).message, translations: data.titles.map(() => null) };
    }
  });
