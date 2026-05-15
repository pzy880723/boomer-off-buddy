alter table public.japan_parcel_items
  add column if not exists tariff_category text,
  add column if not exists tariff_rate numeric;