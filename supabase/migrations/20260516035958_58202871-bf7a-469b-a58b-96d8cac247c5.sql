ALTER TABLE public.japan_parcels
  ADD COLUMN IF NOT EXISTS is_problem boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_japan_parcels_deleted_at ON public.japan_parcels(deleted_at);
CREATE INDEX IF NOT EXISTS idx_japan_parcels_is_problem ON public.japan_parcels(is_problem) WHERE is_problem = true;