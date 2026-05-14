
-- 1. 扩展父表 japan_parcels
ALTER TABLE public.japan_parcels
  ADD COLUMN IF NOT EXISTS status_text text,
  ADD COLUMN IF NOT EXISTS total_weight_g numeric,
  ADD COLUMN IF NOT EXISTS volume_cm3 numeric,
  ADD COLUMN IF NOT EXISTS max_side_cm numeric,
  ADD COLUMN IF NOT EXISTS storage_days integer,
  ADD COLUMN IF NOT EXISTS receiver_name text,
  ADD COLUMN IF NOT EXISTS receiver_phone text,
  ADD COLUMN IF NOT EXISTS receiver_address text,
  ADD COLUMN IF NOT EXISTS intl_total_jpy numeric,
  ADD COLUMN IF NOT EXISTS intl_total_cny numeric,
  ADD COLUMN IF NOT EXISTS intl_ship_method text,
  ADD COLUMN IF NOT EXISTS intl_charge_method text,
  ADD COLUMN IF NOT EXISTS intl_keep_packaging_jpy numeric,
  ADD COLUMN IF NOT EXISTS intl_reinforce_jpy numeric,
  ADD COLUMN IF NOT EXISTS intl_send_fee_jpy numeric,
  ADD COLUMN IF NOT EXISTS intl_photo_fee_jpy numeric,
  ADD COLUMN IF NOT EXISTS intl_merge_fee_jpy numeric,
  ADD COLUMN IF NOT EXISTS intl_points_used numeric,
  ADD COLUMN IF NOT EXISTS intl_pay_method text,
  ADD COLUMN IF NOT EXISTS intl_pay_at timestamptz,
  ADD COLUMN IF NOT EXISTS intl_merchant_order_no text,
  ADD COLUMN IF NOT EXISTS intl_exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS status_timeline jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_japan_parcels_source_order_no ON public.japan_parcels (source_order_no);

-- 2. 新建子订单表
CREATE TABLE IF NOT EXISTS public.japan_parcel_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.japan_parcels(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  sub_order_no text,
  source_platform text,
  item_title text,
  item_title_cn text,
  item_image_url text,
  condition text,
  addon_service text,
  unit_price_jpy numeric,
  quantity integer DEFAULT 1,
  item_total_jpy numeric,
  item_total_cny numeric,
  item_price_jpy numeric,
  service_fee_jpy numeric,
  domestic_freight_jpy numeric,
  freight_diff_jpy numeric,
  weight_g numeric,
  exchange_rate numeric,
  pay_method text,
  pay_at timestamptz,
  merchant_order_no text,
  notes text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jp_items_parent ON public.japan_parcel_items (parent_id);
CREATE INDEX IF NOT EXISTS idx_jp_items_sub_no ON public.japan_parcel_items (sub_order_no);

ALTER TABLE public.japan_parcel_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY open_select_japan_parcel_items ON public.japan_parcel_items FOR SELECT USING (true);
CREATE POLICY open_insert_japan_parcel_items ON public.japan_parcel_items FOR INSERT WITH CHECK (true);
CREATE POLICY open_update_japan_parcel_items ON public.japan_parcel_items FOR UPDATE USING (true);
CREATE POLICY open_delete_japan_parcel_items ON public.japan_parcel_items FOR DELETE USING (true);

CREATE TRIGGER tg_japan_parcel_items_updated_at
  BEFORE UPDATE ON public.japan_parcel_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. 把现有扁平商品字段迁移成子订单行
INSERT INTO public.japan_parcel_items (
  parent_id, position, item_title, item_title_cn, item_image_url,
  item_price_jpy, service_fee_jpy, domestic_freight_jpy, freight_diff_jpy,
  item_total_jpy, item_total_cny, weight_g, exchange_rate, notes
)
SELECT id, 0, item_title, item_title_cn, item_image_url,
       price_jpy, service_fee_jpy, domestic_freight_jpy, intl_freight_jpy,
       total_jpy, total_cny, weight_g, exchange_rate, notes
FROM public.japan_parcels
WHERE item_title IS NOT NULL OR price_jpy IS NOT NULL OR item_image_url IS NOT NULL;
