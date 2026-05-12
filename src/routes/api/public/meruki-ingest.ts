import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const Schema = z.object({
  ingest_token: z.string().uuid(),
  source_url: z.string().max(2048),
  payload: z.unknown(),
});

// Walk a JSON object, find any array of plain objects that smells like an order
// list. Heuristic: keys like list/items/data/records/result/rows. Returns the
// first non-empty match; empty array if none.
function findOrderArray(node: unknown, depth = 0): Record<string, unknown>[] {
  if (!node || depth > 6) return [];
  if (Array.isArray(node)) {
    const objs = node.filter((x) => x && typeof x === "object" && !Array.isArray(x));
    if (objs.length && looksLikeOrders(objs as Record<string, unknown>[])) {
      return objs as Record<string, unknown>[];
    }
    return [];
  }
  if (typeof node !== "object") return [];
  const obj = node as Record<string, unknown>;
  // Prefer well-known list keys
  for (const k of ["list", "items", "data", "records", "rows", "result", "content"]) {
    if (k in obj) {
      const r = findOrderArray(obj[k], depth + 1);
      if (r.length) return r;
    }
  }
  for (const v of Object.values(obj)) {
    const r = findOrderArray(v, depth + 1);
    if (r.length) return r;
  }
  return [];
}

function looksLikeOrders(arr: Record<string, unknown>[]): boolean {
  if (arr.length === 0) return false;
  const sample = arr[0];
  const keys = Object.keys(sample).map((k) => k.toLowerCase());
  const hints = ["orderno", "ordernum", "orderid", "order_id", "ordersn", "id"];
  const titleHints = ["title", "name", "goodsname", "itemtitle", "productname"];
  const priceHints = ["price", "amount", "totalprice", "total"];
  const hasId = keys.some((k) => hints.includes(k));
  const hasContent =
    keys.some((k) => titleHints.includes(k)) || keys.some((k) => priceHints.includes(k));
  return hasId && hasContent;
}

function pick(obj: Record<string, unknown>, ...names: string[]): unknown {
  const lower = new Map<string, string>();
  for (const k of Object.keys(obj)) lower.set(k.toLowerCase(), k);
  for (const n of names) {
    const real = lower.get(n.toLowerCase());
    if (real !== undefined && obj[real] !== undefined && obj[real] !== null) return obj[real];
  }
  return undefined;
}

function toStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}
function toNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapStatus(raw: string | null): string {
  if (!raw) return "paid";
  if (/竞拍|出价|bidding/i.test(raw)) return "bidding";
  if (/付款|已支付|paid/i.test(raw)) return "paid";
  if (/入库|仓库|warehouse/i.test(raw)) return "warehouse_jp";
  if (/国际|国際|发货|shipping/i.test(raw)) return "shipping_intl";
  if (/清关|customs/i.test(raw)) return "customs";
  if (/派送|国内/i.test(raw)) return "shipping_cn";
  if (/签收|完成|delivered|complete/i.test(raw)) return "delivered";
  return "paid";
}

function normalizeOrder(o: Record<string, unknown>) {
  const orderNo = toStr(
    pick(o, "orderNo", "orderNum", "orderId", "order_id", "orderSn", "id"),
  );
  if (!orderNo) return null;
  const title = toStr(pick(o, "itemTitle", "goodsName", "title", "productName", "name"));
  const image = toStr(pick(o, "itemImage", "goodsImg", "image", "img", "picUrl", "thumbnail"));
  const seller = toStr(pick(o, "seller", "sellerName", "shopName", "shop"));
  const price = toNum(pick(o, "price", "goodsPrice", "amount", "total", "totalPrice"));
  const statusRaw = toStr(pick(o, "statusText", "statusName", "status", "orderStatus"));
  const warehouse = toStr(pick(o, "warehouse", "warehouseName", "location"));
  return {
    source: "meruki",
    source_order_no: orderNo,
    item_title: title,
    item_image_url: image,
    seller,
    price_jpy: price,
    total_jpy: price,
    warehouse_location: warehouse,
    status: mapStatus(statusRaw),
    notes: statusRaw,
    raw_payload: JSON.parse(JSON.stringify(o)),
  };
}

function computeCompleteness(p: ReturnType<typeof normalizeOrder>): number {
  if (!p) return 0;
  const fields = [p.item_title, p.item_image_url, p.seller, p.price_jpy, p.warehouse_location];
  const filled = fields.filter((v) => v !== null && v !== "").length;
  return Math.round((filled / fields.length) * 100);
}

export const Route = createFileRoute("/api/public/meruki-ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return json({ error: "invalid payload", detail: parsed.error.issues }, 400);
        }
        const { ingest_token, source_url, payload } = parsed.data;

        const { data: account, error: accErr } = await supabaseAdmin
          .from("meruki_accounts")
          .select("id")
          .eq("ingest_token", ingest_token)
          .maybeSingle();
        if (accErr) return json({ error: accErr.message }, 500);
        if (!account) return json({ error: "unknown ingest_token" }, 401);

        const orders = findOrderArray(payload);
        const normalized = orders.map(normalizeOrder).filter((x): x is NonNullable<typeof x> => !!x);

        const { data: run } = await supabaseAdmin
          .from("meruki_sync_runs")
          .insert({ account_id: account.id, status: "running", message: source_url.slice(0, 200) })
          .select()
          .single();

        let inserted = 0;
        let updated = 0;
        for (const o of normalized) {
          const completeness = computeCompleteness(o);
          const { data: existing } = await supabaseAdmin
            .from("japan_parcels")
            .select("id")
            .eq("account_id", account.id)
            .eq("source_order_no", o.source_order_no)
            .maybeSingle();
          if (existing?.id) {
            await supabaseAdmin
              .from("japan_parcels")
              .update({ ...o, completeness })
              .eq("id", existing.id);
            updated++;
          } else {
            await supabaseAdmin
              .from("japan_parcels")
              .insert({ ...o, account_id: account.id, completeness });
            inserted++;
          }
        }

        await supabaseAdmin
          .from("meruki_accounts")
          .update({
            last_login_status: "ok",
            last_login_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", account.id);

        if (run?.id) {
          await supabaseAdmin
            .from("meruki_sync_runs")
            .update({
              status: "success",
              finished_at: new Date().toISOString(),
              fetched_count: normalized.length,
              inserted_count: inserted,
              updated_count: updated,
              message:
                normalized.length === 0
                  ? `未识别为订单数据：${source_url.slice(0, 160)}`
                  : source_url.slice(0, 200),
            })
            .eq("id", run.id);
        }

        return json({
          ok: true,
          fetched: normalized.length,
          inserted,
          updated,
          recognized: normalized.length > 0,
        });
      },
    },
  },
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
