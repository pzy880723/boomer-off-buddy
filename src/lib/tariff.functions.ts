import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TARIFF_CATEGORIES } from "./tariff";

const CATEGORY_KEYS = TARIFF_CATEGORIES.map((c) => c.key) as [string, ...string[]];

const ResultItemSchema = z.object({
  id: z.string().min(1),
  category: z.enum(CATEGORY_KEYS),
});

const OutputSchema = z.object({
  results: z.array(ResultItemSchema),
});

export const classifyItemsTariff = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        items: z
          .array(
            z.object({
              id: z.string(),
              item_title: z.string().nullable().optional(),
              item_title_cn: z.string().nullable().optional(),
            }),
          )
          .min(1)
          .max(50),
        persist: z.boolean().optional(),
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
    

    const dictText = TARIFF_CATEGORIES.map(
      (c) => `- ${c.key} (${c.label}, ${Math.round(c.rate * 100)}%)`,
    ).join("\n");

    const itemsText = data.items
      .map(
        (it) =>
          `id=${it.id}  标题=${it.item_title_cn || it.item_title || "(无标题)"}  原文=${it.item_title || ""}`,
      )
      .join("\n");

    const system = `你是日本海淘行邮税分类助手。根据中国行邮税三档（13%、20%、50%）将每个商品归入下列类目之一。

类目字典（key 必须从中选）：
${dictText}

判定规则：
- 食品/零食/保健品/药品/书籍/CD/DVD/玩具/手办/模型/普通小家电/游戏机/电脑及配件 → 13%
- 服装/鞋/包/普通手表/美容仪/数码相机/耳机/运动用品/文具 → 20%
- 化妆品/护肤品/香水/烟酒/高档手表（参考价≥1万元）→ 50%
- 不确定时选 other (20%)
只返回字段 id 与 category，category 必须来自字典 key。`;

    const userPrompt = `请为以下子订单分类，仅返回 JSON，格式 {"results":[{"id":"...","category":"..."}]}，不要任何解释或 markdown：\n${itemsText}`;

    async function callModel(modelId: string) {
      const { text } = await generateText({
        model: gateway(modelId),
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      });
      return text;
    }

    function extractJson(raw: string): unknown {
      let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const start = s.search(/[\{\[]/);
      const endChar = start !== -1 && s[start] === "[" ? "]" : "}";
      const end = s.lastIndexOf(endChar);
      if (start === -1 || end === -1) throw new Error("no json found");
      s = s.substring(start, end + 1);
      try {
        return JSON.parse(s);
      } catch {
        s = s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
        return JSON.parse(s);
      }
    }

    let parsed: z.infer<typeof OutputSchema> | null = null;
    let lastErr: unknown = null;
    for (const modelId of ["google/gemini-2.5-flash", "google/gemini-2.5-pro"]) {
      try {
        const raw = await callModel(modelId);
        const json = extractJson(raw);
        const normalized = Array.isArray((json as { results?: unknown }).results)
          ? json
          : { results: Array.isArray(json) ? json : [] };
        parsed = OutputSchema.parse(normalized);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!parsed) throw new Error(`AI 分类失败: ${(lastErr as Error)?.message ?? "unknown"}`);

    const persist = data.persist !== false;
    let updated = 0;
    if (persist) {
      for (const r of parsed.results) {
        const cat = TARIFF_CATEGORIES.find((c) => c.key === r.category);
        if (!cat) continue;
        const { error } = await supabaseAdmin
          .from("japan_parcel_items")
          .update({ tariff_category: cat.key, tariff_rate: cat.rate })
          .eq("id", r.id);
        if (!error) updated++;
      }
    }

    return { ok: true, updated, total: data.items.length, results: parsed.results };
  });
