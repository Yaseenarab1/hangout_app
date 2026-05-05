-- ============================================================================
-- Phase 2C: per-user saved restaurants
-- ============================================================================
-- When a user selects a restaurant in a poll (or types a custom one), we save
-- it to their personal recommendations so it appears in their "My saved
-- restaurants" list for future polls. Same shape as user_custom_activities
-- but specialized for restaurants — they have a place_id, address, etc.
-- ============================================================================

create table if not exists public.user_custom_restaurants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  /** Display name (always set). */
  name            text not null check (char_length(name) between 1 and 200),
  /** Full address (optional). */
  address         text check (char_length(address) <= 300),
  /** Google Places place_id, if this came from Places. NULL for custom entries. */
  google_place_id text,
  /** Cached metadata from Google (rating, price, photo ref, etc.) as JSONB. */
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  -- Prevents duplicates per user
  unique (user_id, google_place_id),
  unique (user_id, name) -- if no place_id, dedupe by name
);

create index if not exists idx_user_custom_restaurants_user
  on public.user_custom_restaurants(user_id, created_at desc);

-- RLS
alter table public.user_custom_restaurants enable row level security;

drop policy if exists user_custom_restaurants_select on public.user_custom_restaurants;
drop policy if exists user_custom_restaurants_insert on public.user_custom_restaurants;
drop policy if exists user_custom_restaurants_delete on public.user_custom_restaurants;

create policy user_custom_restaurants_select
  on public.user_custom_restaurants for select
  to authenticated
  using (user_id = auth.uid());

create policy user_custom_restaurants_insert
  on public.user_custom_restaurants for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_custom_restaurants_delete
  on public.user_custom_restaurants for delete
  to authenticated
  using (user_id = auth.uid());

select 'user_custom_restaurants created' as status
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'user_custom_restaurants'
);
