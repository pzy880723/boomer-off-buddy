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
  status: z.string().default("purchased"),
  status_text: z.string().nullable().optional(),
  purchased_at: z.string().nullable().optional(),
  eta: z.string().nullable().optional(),
  received_at: z.string().nullable().optional(),
  warehouse_location: z.string().nullable().optional(),
  weight_g: z.number().nullable().optional(),
  total_weight_g: z.number().nullable().optional(),
  volume_cm3: z.number().nullable().optional(),
  max_side_cm: z.number().nullable().optional(),
  storage_days: z.number().nullable().optional(),
  receiver_name: z.string().nullable().optional(),
  receiver_phone: z.string().nullable().optional(),
  receiver_address: z.string().nullable().optional(),
  intl_total_jpy: z.number().nullable().optional(),
  intl_total_cny: z.number().nullable().optional(),
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
  tariff_jpy: z.number().nullable().optional(),
  tariff_cny: z.number().nullable().optional(),
  grand_total_jpy: z.number().nullable().optional(),
  grand_total_cny: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
});

const ItemCreateSchema = z.object({
  parent_id: z.string().uuid(),
  position: z.number().int().min(0).default(0),
  sub_order_no: z.string().nullable().optional(),
  source_platform: z.string().nullable().optional(),
  item_title: z.string().nullable().optional(),
  item_title_cn: z.string().nullable().optional(),
  item_image_url: z.string().nullable().optional(),
  unit_price_jpy: z.number().nullable().optional(),
  quantity: z.number().int().nullable().optional(),
  item_total_jpy: z.number().nullable().optional(),
  item_total_cny: z.number().nullable().optional(),
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

export const listJapanParcels = createServerFn({ method: "GET" })
  .inputValidator(
    (input: { search?: string; status?: string[]; source?: string[]; onlyIncomplete?: boolean }) =>
      input ?? {},
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("japan_parcels")
      .select("*, japan_parcel_items(id, sub_order_no, item_title, item_title_cn, item_image_url, item_total_jpy, item_total_cny, unit_price_jpy, quantity, weight_g)")
      .order("created_at", { ascending: false });
    if (data.status?.length) q = q.in("status", data.status);
    if (data.source?.length) q = q.in("source", data.source);
    if (data.onlyIncomplete) q = q.lt("completeness", 80);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(
        `item_title.ilike.${s},source_order_no.ilike.${s},tracking_no.ilike.${s},seller.ilike.${s},receiver_name.ilike.${s}`,
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
    const { data: items } = await supabaseAdmin
      .from("japan_parcel_items")
      .select("*")
      .eq("parent_id", data.id)
      .order("position", { ascending: true });
    return { row, items: items ?? [] };
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

export const updateJapanParcelStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("japan_parcels")
      .update({ status: data.status })
      .eq("id", data.id)
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

export const bulkDeleteJapanParcels = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("japan_parcels")
      .delete()
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

const ItemUpdateSchema = z.object({
  id: z.string().uuid(),
  item_title: z.string().nullable().optional(),
  item_title_cn: z.string().nullable().optional(),
  item_image_url: z.string().nullable().optional(),
  unit_price_jpy: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  item_total_jpy: z.number().nullable().optional(),
  item_total_cny: z.number().nullable().optional(),
  service_fee_jpy: z.number().nullable().optional(),
  domestic_freight_jpy: z.number().nullable().optional(),
  freight_diff_jpy: z.number().nullable().optional(),
  weight_g: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateParcelItem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ItemUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await supabaseAdmin
      .from("japan_parcel_items")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row };
  });

export const deleteParcelItem = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("japan_parcel_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createParcelItem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ItemCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("japan_parcel_items")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { row };
  });

export const bulkCreateParcelItems = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ items: z.array(ItemCreateSchema).min(1).max(100) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("japan_parcel_items")
      .insert(data.items)
      .select();
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// 批量为缺失中文标题的子订单写入翻译结果
export const bulkSetItemTitlesCn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        updates: z.array(z.object({ id: z.string().uuid(), item_title_cn: z.string().min(1) })).min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let count = 0;
    for (const u of data.updates) {
      const { error } = await supabaseAdmin
        .from("japan_parcel_items")
        .update({ item_title_cn: u.item_title_cn })
        .eq("id", u.id);
      if (!error) count++;
    }
    return { ok: true, count };
  });
