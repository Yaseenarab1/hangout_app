-- Restaurant ratings (Beli-style)
-- Users rate restaurants they've visited. Friends' ratings surface in the
-- RestaurantSearchPicker as group compatibility scores.

create table if not exists public.restaurant_ratings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  place_id      text not null,
  place_name    text not null check (char_length(place_name) between 1 and 200),
  place_address text,
  place_photo   text,         -- Google Places photo resource name (proxied)
  place_type    text,         -- primaryType e.g. "Italian restaurant"
  rating        smallint not null check (rating between 1 and 5),
  notes         text check (char_length(notes) <= 280),
  visited_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, place_id)
);

create index if not exists ratings_user_idx  on public.restaurant_ratings(user_id, visited_at desc);
create index if not exists ratings_place_idx on public.restaurant_ratings(place_id);

alter table public.restaurant_ratings enable row level security;

-- Any authenticated user can read ratings.
-- Service layer already filters to specific user IDs (self + friends),
-- so no sensitive data leaks at the query level.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'restaurant_ratings' and policyname = 'authenticated users read ratings'
  ) then
    execute $p$
      create policy "authenticated users read ratings"
      on public.restaurant_ratings for select
      to authenticated
      using (true)
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'restaurant_ratings' and policyname = 'insert own rating'
  ) then
    execute $p$
      create policy "insert own rating"
      on public.restaurant_ratings for insert
      with check (auth.uid() = user_id)
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'restaurant_ratings' and policyname = 'update own rating'
  ) then
    execute $p$
      create policy "update own rating"
      on public.restaurant_ratings for update
      using (auth.uid() = user_id)
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'restaurant_ratings' and policyname = 'delete own rating'
  ) then
    execute $p$
      create policy "delete own rating"
      on public.restaurant_ratings for delete
      using (auth.uid() = user_id)
    $p$;
  end if;
end $$;

-- Auto-update updated_at
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
