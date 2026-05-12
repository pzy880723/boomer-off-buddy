create table if not exists public.meruki_raw_captures (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.meruki_accounts(id) on delete cascade,
  source_url text not null,
  payload jsonb not null,
  recognized boolean not null default false,
  captured_at timestamptz not null default now()
);
alter table public.meruki_raw_captures enable row level security;
create policy open_select_meruki_raw_captures on public.meruki_raw_captures for select using (true);
create policy open_insert_meruki_raw_captures on public.meruki_raw_captures for insert with check (true);
create policy open_delete_meruki_raw_captures on public.meruki_raw_captures for delete using (true);
create index if not exists idx_meruki_raw_captures_account_time on public.meruki_raw_captures(account_id, captured_at desc);