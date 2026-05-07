-- Phase 3.0: realtime + push foundation

-- device_tokens: one row per device per user
create table public.device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  token         text not null,
  platform      text not null check (platform in ('ios', 'android')),
  device_name   text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, token)
);

create index device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

create policy "device_tokens_select" on public.device_tokens
  for select using (auth.uid() = user_id);

create policy "device_tokens_insert" on public.device_tokens
  for insert with check (auth.uid() = user_id);

create policy "device_tokens_update" on public.device_tokens
  for update using (auth.uid() = user_id);

create policy "device_tokens_delete" on public.device_tokens
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.device_tokens to authenticated;

-- notification_log: audit trail of every push we attempted
create table public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  ref_id      uuid,
  title       text not null,
  body        text,
  data        jsonb default '{}',
  delivered   boolean not null default false,
  error       text,
  sent_at     timestamptz not null default now()
);

create index notification_log_user_idx
  on public.notification_log(user_id, sent_at desc);

alter table public.notification_log enable row level security;

create policy "notification_log_select" on public.notification_log
  for select using (auth.uid() = user_id);

-- only send-push edge function (service role) inserts here — no client insert
grant select on public.notification_log to authenticated;

-- notification_prefs column on profiles
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default jsonb_build_object(
    'messages',        true,
    'photos',          true,
    'bills',           true,
    'feed',            true,
    'hangout_invites', true,
    'quiet_hours_enabled', false,
    'quiet_hours_start', '22:00',
    'quiet_hours_end',   '08:00'
  );
