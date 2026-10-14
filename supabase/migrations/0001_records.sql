-- =============================================================================
--  Anusree's Daily Tracker — Supabase schema
-- =============================================================================
--  Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query),
--  or apply it with the Supabase CLI:
--
--      supabase link --project-ref <your-project-ref>
--      supabase db push
--
--  Design notes
--  ------------
--  * One polymorphic `records` table holds every entity type. The local app
--    already models its data as (entity, id, updatedAt, payload), and the change
--    log replays exactly that shape, so a single table with a JSONB payload
--    keeps the sync worker simple and lets a new entity type ship without a
--    migration.
--  * The columns that actually need indexing (entity, updated_at, owner, the
--    deletion tombstone) are promoted out of the payload.
--  * Timestamps are epoch milliseconds, matching the client, so ordering and
--    last-write-wins comparisons need no conversion.
--  * Row Level Security is enabled and every policy is scoped to auth.uid(), so
--    even with the public anon key in the bundle one signed-in user can never
--    read or write another user's rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. The records table
-- ---------------------------------------------------------------------------
create table if not exists public.records (
  -- Stable uuid generated on the client, so a record keeps its identity across
  -- devices and can be merged without collisions.
  id           text        not null,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  -- Entity discriminator, e.g. 'events', 'tasks', 'sleepSessions'.
  entity       text        not null,
  -- Human-readable owner label for easier debugging in the dashboard.
  entity_label text,
  -- Last time the owning device changed this record (epoch millis, UTC).
  updated_at   bigint      not null default 0,
  -- Soft-delete tombstone. Rows are never hard-deleted so that a delete on one
  -- device propagates instead of being resurrected by a stale copy elsewhere.
  deleted      boolean     not null default false,
  -- Server-side receive time, used for the incremental pull cursor.
  server_at    timestamptz not null default now(),
  payload      jsonb       not null default '{}'::jsonb,
  primary key (user_id, entity, id)
);

comment on table public.records is
  'Per-user synced records for Anusree''s Daily Tracker. payload mirrors the client record exactly.';

-- The sync worker pulls "everything for this user changed since cursor".
create index if not exists records_user_server_at_idx
  on public.records (user_id, server_at);

-- Useful for per-entity dashboards and debugging.
create index if not exists records_user_entity_idx
  on public.records (user_id, entity);

-- ---------------------------------------------------------------------------
-- 2. Keep server_at honest on upsert
-- ---------------------------------------------------------------------------
-- The client never sends server_at; this trigger stamps it so the pull cursor
-- always advances, even when a device re-pushes an older updated_at.
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

-- Recreate policies idempotently.
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

-- Deletes are soft in this app, but allow hard deletes for the same owner so a
-- manual cleanup or a future "purge" feature stays possible.
create policy "records_delete_own"
  on public.records for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Server-side reminder jobs (optional Web Push groundwork)
-- ---------------------------------------------------------------------------
-- The local-first app schedules reminders in the browser while it is open. Real
-- closed-browser reminders need a server, so this table is ready for a cron
-- worker to read. Nothing writes to it unless you enable that feature.
create table if not exists public.reminder_jobs (
  id          text        not null,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  -- Unique delivery key. The same reminder can never be delivered twice.
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

comment on table public.reminder_jobs is
  'Optional server-side reminder queue for Web Push. Unused by the local-first build.';

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
-- 5. Web Push subscriptions (optional)
-- ---------------------------------------------------------------------------
-- Populated by the client only if you implement the optional Web Push path.
-- Never store the VAPID private key here — it belongs in server-side env vars.
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
-- 6. Convenience: current sync size per user
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

comment on view public.record_counts is
  'Per-entity row counts for the signed-in user. security_invoker keeps RLS in force.';
