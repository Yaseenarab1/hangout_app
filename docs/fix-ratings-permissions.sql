-- ============================================================
-- Run this in Supabase SQL Editor (one-shot: create + secure)
-- ============================================================

-- 1. Create the table
create table if not exists public.restaurant_ratings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  place_id      text not null,
  place_name    text not null check (char_length(place_name) between 1 and 200),
  place_address text,
  place_photo   text,
  place_type    text,
  rating        smallint not null check (rating between 1 and 5),
  notes         text check (char_length(notes) <= 280),
  visited_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, place_id)
);

-- 2. Indexes
create index if not exists ratings_user_idx  on public.restaurant_ratings(user_id, visited_at desc);
create index if not exists ratings_place_idx on public.restaurant_ratings(place_id);

-- 3. Grants
grant select, insert, update, delete on public.restaurant_ratings to authenticated;
grant select, insert, update, delete on public.restaurant_ratings to service_role;

-- 4. RLS
alter table public.restaurant_ratings enable row level security;

-- Read: own + friends
drop policy if exists "authenticated users read ratings" on public.restaurant_ratings;
drop policy if exists "read own and friends ratings"    on public.restaurant_ratings;
create policy "read own and friends ratings"
on public.restaurant_ratings for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.friendships
    where (user_a_id = auth.uid() and user_b_id = restaurant_ratings.user_id)
       or (user_b_id = auth.uid() and user_a_id = restaurant_ratings.user_id)
  )
);

-- Insert / update / delete: own only
drop policy if exists "insert own rating" on public.restaurant_ratings;
create policy "insert own rating"
on public.restaurant_ratings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own rating" on public.restaurant_ratings;
create policy "update own rating"
on public.restaurant_ratings for update
to authenticated
using (auth.uid() = user_id);

drop policy if exists "delete own rating" on public.restaurant_ratings;
create policy "delete own rating"
on public.restaurant_ratings for delete
to authenticated
using (auth.uid() = user_id);

-- 5. Auto-update updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ratings_updated_at on public.restaurant_ratings;
create trigger set_ratings_updated_at
  before update on public.restaurant_ratings
  for each row execute function public.set_updated_at();
