
-- pgcrypto for password encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- meruki_accounts
CREATE TABLE public.meruki_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_encrypted TEXT NOT NULL,
  display_name TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_status TEXT,
  last_error TEXT,
  session_cookie TEXT,
  cookie_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meruki_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_select_meruki_accounts" ON public.meruki_accounts FOR SELECT USING (true);
CREATE POLICY "open_insert_meruki_accounts" ON public.meruki_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update_meruki_accounts" ON public.meruki_accounts FOR UPDATE USING (true);
CREATE POLICY "open_delete_meruki_accounts" ON public.meruki_accounts FOR DELETE USING (true);

-- japan_parcels
CREATE TABLE public.japan_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.meruki_accounts(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  source_order_no TEXT,
  tracking_no TEXT,
  item_title TEXT,
  item_title_cn TEXT,
  item_image_url TEXT,
  seller TEXT,
  category TEXT,
  price_jpy NUMERIC,
  service_fee_jpy NUMERIC,
  domestic_freight_jpy NUMERIC,
  intl_freight_jpy NUMERIC,
  total_jpy NUMERIC,
  total_cny NUMERIC,
  exchange_rate NUMERIC,
  status TEXT NOT NULL DEFAULT 'paid',
  purchased_at TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  warehouse_location TEXT,
  weight_g NUMERIC,
  notes TEXT,
  raw_payload JSONB,
  completeness INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX japan_parcels_account_order_uniq
  ON public.japan_parcels(account_id, source_order_no)
  WHERE account_id IS NOT NULL AND source_order_no IS NOT NULL;

CREATE INDEX japan_parcels_status_idx ON public.japan_parcels(status);
CREATE INDEX japan_parcels_source_idx ON public.japan_parcels(source);
CREATE INDEX japan_parcels_purchased_at_idx ON public.japan_parcels(purchased_at DESC);

ALTER TABLE public.japan_parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_select_japan_parcels" ON public.japan_parcels FOR SELECT USING (true);
CREATE POLICY "open_insert_japan_parcels" ON public.japan_parcels FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update_japan_parcels" ON public.japan_parcels FOR UPDATE USING (true);
CREATE POLICY "open_delete_japan_parcels" ON public.japan_parcels FOR DELETE USING (true);

-- meruki_sync_runs
CREATE TABLE public.meruki_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.meruki_accounts(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  fetched_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  message TEXT
);

CREATE INDEX meruki_sync_runs_account_idx ON public.meruki_sync_runs(account_id, started_at DESC);

ALTER TABLE public.meruki_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_select_meruki_sync_runs" ON public.meruki_sync_runs FOR SELECT USING (true);
CREATE POLICY "open_insert_meruki_sync_runs" ON public.meruki_sync_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update_meruki_sync_runs" ON public.meruki_sync_runs FOR UPDATE USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_japan_parcels_updated_at BEFORE UPDATE ON public.japan_parcels
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER set_meruki_accounts_updated_at BEFORE UPDATE ON public.meruki_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
