-- Run in Supabase SQL Editor

create table if not exists public.media_ratings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tmdb_id      integer not null,
  media_type   text not null check (media_type in ('movie', 'tv')),
  title        text not null check (char_length(title) between 1 and 300),
  poster_url   text,
  year         text,
  genre        text,
  rating       smallint not null check (rating between 1 and 5),
  notes        text check (char_length(notes) <= 280),
  watched_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

create index if not exists media_ratings_user_idx on public.media_ratings(user_id, watched_at desc);

grant select, insert, update, delete on public.media_ratings to authenticated;
grant select, insert, update, delete on public.media_ratings to service_role;

alter table public.media_ratings enable row level security;

create policy "read own and friends media ratings"
on public.media_ratings for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.friendships
    where (user_a_id = auth.uid() and user_b_id = media_ratings.user_id)
       or (user_b_id = auth.uid() and user_a_id = media_ratings.user_id)
  )
);

create policy "insert own media rating"
on public.media_ratings for insert to authenticated
with check (auth.uid() = user_id);

create policy "update own media rating"
on public.media_ratings for update to authenticated
using (auth.uid() = user_id);

create policy "delete own media rating"
on public.media_ratings for delete to authenticated
using (auth.uid() = user_id);

drop trigger if exists set_media_ratings_updated_at on public.media_ratings;
create trigger set_media_ratings_updated_at
  before update on public.media_ratings
  for each row execute function public.set_updated_at();
