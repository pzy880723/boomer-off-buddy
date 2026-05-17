ALTER TABLE public.japan_parcel_items
  ADD COLUMN IF NOT EXISTS pack_pieces integer,
  ADD COLUMN IF NOT EXISTS pack_pieces_source text,
  ADD COLUMN IF NOT EXISTS pack_unit_note text;