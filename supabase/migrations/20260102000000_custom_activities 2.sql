-- ============================================================================
-- Phase 2B.1.5: per-user custom activity suggestions
-- ============================================================================
-- When a user types a custom activity option, we save it to their personal
-- recommendations so it appears as a chip in their picker for future polls.
--
-- Scope: per-user. A user only sees their own custom suggestions.
-- ============================================================================

create table if not exists public.user_custom_activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 100),
  emoji       text check (char_length(emoji) <= 8),
  created_at  timestamptz default now(),
  -- Prevents duplicates per user (case-insensitive via lower())
  unique (user_id, label)
);

-- Index for fast per-user lookups
create index if not exists idx_user_custom_activities_user
  on public.user_custom_activities(user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS — only the owner can see and manage their own custom activities
-- ----------------------------------------------------------------------------
alter table public.user_custom_activities enable row level security;

-- Drop any leftover policies (idempotent migration)
drop policy if exists user_custom_activities_select on public.user_custom_activities;
drop policy if exists user_custom_activities_insert on public.user_custom_activities;
drop policy if exists user_custom_activities_delete on public.user_custom_activities;

create policy user_custom_activities_select
  on public.user_custom_activities for select
  to authenticated
  using (user_id = auth.uid());

create policy user_custom_activities_insert
  on public.user_custom_activities for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_custom_activities_delete
  on public.user_custom_activities for delete
  to authenticated
  using (user_id = auth.uid());

-- Verify the table exists
select 'user_custom_activities created' as status
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'user_custom_activities'
);
