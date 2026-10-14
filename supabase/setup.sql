-- =============================================================================
--  Anusree's Daily Tracker — paste this whole file into the Supabase SQL Editor
-- =============================================================================
--  Dashboard → SQL Editor → New query → paste → Run.
--
--  This is byte-for-byte the same migration as
--  `supabase/migrations/0001_records.sql`; it is duplicated at the repository
--  root only so there is an obvious single block to copy when applying it by
--  hand. With the Supabase CLI you would instead run:
--
--      supabase link --project-ref <your-project-ref>
--      supabase db push
--
--  It is idempotent: running it twice is safe.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The records table
-- ---------------------------------------------------------------------------
create table if not exists public.records (
  id           text        not null,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  entity       text        not null,
  entity_label text,
  updated_at   bigint      not null default 0,
  deleted      boolean     not null default false,
  server_at    timestamptz not null default now(),
  payload      jsonb       not null default '{}'::jsonb,
  primary key (user_id, entity, id)
);

comment on table public.records is
  'Per-user synced records for Anusree''s Daily Tracker. payload mirrors the client record exactly.';

create index if not exists records_user_server_at_idx
  on public.records (user_id, server_at);

create index if not exists records_user_entity_idx
  on public.records (user_id, entity);

-- ---------------------------------------------------------------------------
-- 2. Stamp server_at on every write
-- ---------------------------------------------------------------------------
create or replace function public.touch_records_server_at()
returns trigger
language plpgsql
as $$
begin
  new.server_at := now();
  return new;
end;
$$;

drop trigger if exists records_touch_server_at on public.records;
create trigger records_touch_server_at
  before insert or update on public.records
  for each row execute function public.touch_records_server_at();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own"
  on public.records for select
  to authenticated
  using (auth.uid() = user_id);

create policy "records_insert_own"
  on public.records for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "records_update_own"
  on public.records for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "records_delete_own"
  on public.records for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Optional server-side reminder queue (Web Push groundwork)
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_jobs (
  id          text        not null,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  dedupe_key  text        not null,
  fire_at     timestamptz not null,
  title       text        not null,
  body        text        not null default '',
  category    text        not null default 'activity',
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, dedupe_key)
);

create index if not exists reminder_jobs_due_idx
  on public.reminder_jobs (fire_at)
  where sent_at is null;

alter table public.reminder_jobs enable row level security;

drop policy if exists "reminder_jobs_select_own" on public.reminder_jobs;
drop policy if exists "reminder_jobs_write_own" on public.reminder_jobs;

create policy "reminder_jobs_select_own"
  on public.reminder_jobs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "reminder_jobs_write_own"
  on public.reminder_jobs for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Optional Web Push subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id           uuid        not null default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  endpoint     text        not null,
  p256dh       text        not null,
  auth_key     text        not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  primary key (id),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;

create policy "push_subscriptions_own"
  on public.push_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Per-entity sync summary used by the Settings screen
-- ---------------------------------------------------------------------------
create or replace view public.record_counts
with (security_invoker = true) as
select
  user_id,
  entity,
  count(*) filter (where not deleted) as live_rows,
  count(*) filter (where deleted) as tombstoned_rows,
  max(updated_at) as last_client_write,
  max(server_at) as last_server_write
from public.records
group by user_id, entity;

-- ---------------------------------------------------------------------------
-- Done. Verify with:
--   select count(*) from public.records;
-- ---------------------------------------------------------------------------
