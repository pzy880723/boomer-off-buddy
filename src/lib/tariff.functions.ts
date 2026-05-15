import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TARIFF_CATEGORIES } from "./tariff";

const CATEGORY_KEYS = TARIFF_CATEGORIES.map((c) => c.key) as [string, ...string[]];

const ResultItemSchema = z.object({
  id: z.string().uuid(),
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
              id: z.string().uuid(),
              item_title: z.string().nullable().optional(),
              item_title_cn: z.string().nullable().optional(),
            }),
          )
          .min(1)
          .max(50),
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
    const model = gateway("google/gemini-2.5-flash");

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

    const { output } = await generateText({
      model,
      output: Output.object({ schema: OutputSchema }),
      messages: [
        { role: "system", content: system },
        { role: "user", content: `请为以下子订单分类:\n${itemsText}` },
      ],
    });

    let updated = 0;
    for (const r of output.results) {
      const cat = TARIFF_CATEGORIES.find((c) => c.key === r.category);
      if (!cat) continue;
      const { error } = await supabaseAdmin
        .from("japan_parcel_items")
        .update({ tariff_category: cat.key, tariff_rate: cat.rate })
        .eq("id", r.id);
      if (!error) updated++;
    }

    return { ok: true, updated, total: data.items.length, results: output.results };
  });
