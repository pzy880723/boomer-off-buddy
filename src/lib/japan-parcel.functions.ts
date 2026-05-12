import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCompleteness } from "./japan-parcel.helpers";

const ParcelSchema = z.object({
  id: z.string().uuid().optional(),
  source: z.string().default("manual"),
  source_order_no: z.string().nullable().optional(),
  tracking_no: z.string().nullable().optional(),
  item_title: z.string().nullable().optional(),
  item_title_cn: z.string().nullable().optional(),
  item_image_url: z.string().nullable().optional(),
  seller: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  price_jpy: z.number().nullable().optional(),
  service_fee_jpy: z.number().nullable().optional(),
  domestic_freight_jpy: z.number().nullable().optional(),
  intl_freight_jpy: z.number().nullable().optional(),
  total_jpy: z.number().nullable().optional(),
  total_cny: z.number().nullable().optional(),
  exchange_rate: z.number().nullable().optional(),
  status: z.string().default("paid"),
  purchased_at: z.string().nullable().optional(),
  eta: z.string().nullable().optional(),
  received_at: z.string().nullable().optional(),
  warehouse_location: z.string().nullable().optional(),
  weight_g: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
});

export const listJapanParcels = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { search?: string; status?: string[]; source?: string[]; onlyIncomplete?: boolean }) =>
      input ?? {},
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("japan_parcels").select("*").order("created_at", { ascending: false });
    if (data.status?.length) q = q.in("status", data.status);
    if (data.source?.length) q = q.in("source", data.source);
    if (data.onlyIncomplete) q = q.lt("completeness", 80);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(
        `item_title.ilike.${s},source_order_no.ilike.${s},tracking_no.ilike.${s},seller.ilike.${s}`,
      );
    }
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getJapanParcel = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("japan_parcels")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { row };
  });

export const createJapanParcel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ParcelSchema.parse(input))
  .handler(async ({ data }) => {
    const completeness = computeCompleteness(data);
    const { data: row, error } = await supabaseAdmin
      .from("japan_parcels")
      .insert({ ...data, completeness })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row };
  });

export const updateJapanParcel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    ParcelSchema.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const completeness = computeCompleteness(rest);
    const { data: row, error } = await supabaseAdmin
      .from("japan_parcels")
      .update({ ...rest, completeness })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row };
  });

export const deleteJapanParcel = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("japan_parcels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
