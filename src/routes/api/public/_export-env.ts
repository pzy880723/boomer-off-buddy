// 临时导出脚本——拿完 key 立刻删除！
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/_export-env")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t");
        if (token !== "boomeroff-2026-onetime") {
          return new Response("nope", { status: 404 });
        }
        return Response.json({
          SUPABASE_URL: process.env.SUPABASE_URL ?? null,
          SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY ?? null,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
          MERUKI_ENC_KEY: process.env.MERUKI_ENC_KEY ?? null,
          LOVABLE_API_KEY: process.env.LOVABLE_API_KEY ?? null,
        });
      },
    },
  },
});
