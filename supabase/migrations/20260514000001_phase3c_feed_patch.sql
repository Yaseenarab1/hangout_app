-- ============================================================================
-- Phase 3C patch: apply everything that was skipped when the original migration
-- stopped at the bad feed_posts_active_idx (now() in partial index predicate).
--
-- Safe to run even if some pieces already exist — uses IF NOT EXISTS /
-- CREATE OR REPLACE / DROP IF EXISTS throughout.
-- ============================================================================

-- ── Missing indexes on feed_posts ─────────────────────────────────────────────

create index if not exists feed_posts_active_idx
  on public.feed_posts(created_at desc)
  where deleted_at is null;

create index if not exists feed_posts_permanent_idx
  on public.feed_posts(author_id, created_at desc)
  where deleted_at is null and expires_at is null;

create index if not exists feed_posts_storage_path_idx
  on public.feed_posts(storage_path);

create index if not exists feed_posts_thumbnail_path_idx
  on public.feed_posts(thumbnail_path)
  where thumbnail_path is not null;

-- ── Enable RLS + grants on feed_posts ─────────────────────────────────────────

alter table public.feed_posts enable row level security;
grant all on public.feed_posts to authenticated;

-- ── feed_post_visible_to() ────────────────────────────────────────────────────

create or replace function public.feed_post_visible_to(
  post  public.feed_posts,
  viewer uuid
)
returns boolean
language sql
security definer
stable
as $$
  select
    post.author_id = viewer
    or
    (
      post.deleted_at is null
      and (post.expires_at is null or post.expires_at > now())
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = post.author_id and b.blocked_id = viewer)
           or (b.blocker_id = viewer        and b.blocked_id = post.author_id)
      )
      and (
        (   post.visibility = 'hangout'
          and public.is_hangout_participant(post.hangout_id, viewer)
        )
        or
        (   post.visibility = 'friends'
          and public.are_friends(post.author_id, viewer)
        )
        or
        (   post.visibility = 'public'
          and public.are_friends(post.author_id, viewer)
        )
      )
    );
$$;

-- ── feed_posts RLS policies ───────────────────────────────────────────────────

drop policy if exists "feed_posts_select" on public.feed_posts;
drop policy if exists "feed_posts_insert" on public.feed_posts;
drop policy if exists "feed_posts_update" on public.feed_posts;
drop policy if exists "feed_posts_delete" on public.feed_posts;

create policy "feed_posts_select"
  on public.feed_posts for select
  using (public.feed_post_visible_to(feed_posts, auth.uid()));

create policy "feed_posts_insert"
  on public.feed_posts for insert
  with check (author_id = auth.uid());

create policy "feed_posts_update"
  on public.feed_posts for update
  using (author_id = auth.uid());

create policy "feed_posts_delete"
  on public.feed_posts for delete
  using (author_id = auth.uid());

-- ── feed_post_likes ───────────────────────────────────────────────────────────

create table if not exists public.feed_post_likes (
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists feed_post_likes_user_idx
  on public.feed_post_likes(user_id);

alter table public.feed_post_likes enable row level security;
grant all on public.feed_post_likes to authenticated;

drop policy if exists "feed_post_likes_select" on public.feed_post_likes;
drop policy if exists "feed_post_likes_insert" on public.feed_post_likes;
drop policy if exists "feed_post_likes_delete" on public.feed_post_likes;

create policy "feed_post_likes_select"
  on public.feed_post_likes for select
  using (
    exists (select 1 from public.feed_posts p where p.id = post_id)
  );

create policy "feed_post_likes_insert"
  on public.feed_post_likes for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.feed_posts p where p.id = post_id)
  );

create policy "feed_post_likes_delete"
  on public.feed_post_likes for delete
  using (user_id = auth.uid());

-- ── feed_post_comments ────────────────────────────────────────────────────────

create table if not exists public.feed_post_comments (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references public.feed_posts(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id)   on delete cascade,
  body       text        not null
               check (length(body) > 0 and length(body) <= 500),
  edited_at  timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists feed_post_comments_post_idx
  on public.feed_post_comments(post_id, created_at);

alter table public.feed_post_comments enable row level security;
grant all on public.feed_post_comments to authenticated;

drop policy if exists "feed_post_comments_select" on public.feed_post_comments;
drop policy if exists "feed_post_comments_insert" on public.feed_post_comments;
drop policy if exists "feed_post_comments_update" on public.feed_post_comments;
drop policy if exists "feed_post_comments_delete" on public.feed_post_comments;

create policy "feed_post_comments_select"
  on public.feed_post_comments for select
  using (
    deleted_at is null
    and exists (select 1 from public.feed_posts p where p.id = post_id)
  );

create policy "feed_post_comments_insert"
  on public.feed_post_comments for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.feed_posts p where p.id = post_id)
  );

create policy "feed_post_comments_update"
  on public.feed_post_comments for update
  using (
    user_id = auth.uid()
    and created_at > now() - interval '5 minutes'
  );

create policy "feed_post_comments_delete"
  on public.feed_post_comments for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.feed_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- ── feed_post_mentions ────────────────────────────────────────────────────────

create table if not exists public.feed_post_mentions (
  id                uuid    primary key default gen_random_uuid(),
  post_id           uuid    not null references public.feed_posts(id) on delete cascade,
  mentioned_user_id uuid    not null references public.profiles(id)   on delete cascade,
  untagged_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (post_id, mentioned_user_id)
);

create index if not exists feed_post_mentions_user_idx
  on public.feed_post_mentions(mentioned_user_id, created_at desc);

alter table public.feed_post_mentions enable row level security;
grant all on public.feed_post_mentions to authenticated;

drop policy if exists "feed_post_mentions_select" on public.feed_post_mentions;
drop policy if exists "feed_post_mentions_insert" on public.feed_post_mentions;
drop policy if exists "feed_post_mentions_update" on public.feed_post_mentions;

create policy "feed_post_mentions_select"
  on public.feed_post_mentions for select
  using (
    exists (select 1 from public.feed_posts p where p.id = post_id)
  );

create policy "feed_post_mentions_insert"
  on public.feed_post_mentions for insert
  with check (
    exists (
      select 1 from public.feed_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

create policy "feed_post_mentions_update"
  on public.feed_post_mentions for update
  using (mentioned_user_id = auth.uid())
  with check (mentioned_user_id = auth.uid());

-- ── Storage bucket + policies ─────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('feed-posts', 'feed-posts', false)
on conflict (id) do nothing;

drop policy if exists "feed_posts_storage_select" on storage.objects;
drop policy if exists "feed_posts_storage_insert" on storage.objects;
drop policy if exists "feed_posts_storage_delete" on storage.objects;

create policy "feed_posts_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'feed-posts'
    and exists (
      select 1 from public.feed_posts p
      where p.storage_path = name
         or p.thumbnail_path = name
    )
  );

create policy "feed_posts_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'feed-posts'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "feed_posts_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'feed-posts'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- ── Triggers ──────────────────────────────────────────────────────────────────

create or replace function public.handle_post_mentions()
returns trigger
language plpgsql
security definer
as $$
declare
  v_username  text;
  v_user_id   uuid;
begin
  if new.caption is null or new.caption = '' then
    return new;
  end if;

  for v_username in
    select distinct lower(m[1])
    from regexp_matches(new.caption, '@([a-zA-Z0-9_]{3,30})', 'g') as m
  loop
    select id into v_user_id
    from public.profiles
    where lower(username) = v_username
    limit 1;

    if v_user_id is null or v_user_id = new.author_id then
      continue;
    end if;

    insert into public.feed_post_mentions (post_id, mentioned_user_id)
    values (new.id, v_user_id)
    on conflict (post_id, mentioned_user_id) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists feed_posts_mentions_trigger on public.feed_posts;
create trigger feed_posts_mentions_trigger
  after insert on public.feed_posts
  for each row execute function public.handle_post_mentions();

create or replace function public.link_feed_post_to_hangout_album()
returns trigger
language plpgsql
security definer
as $$
declare
  v_photo_id uuid;
begin
  if new.visibility <> 'hangout' or new.hangout_id is null then
    return new;
  end if;

  insert into public.hangout_photos (
    hangout_id, uploader_id, storage_path, thumbnail_path,
    width, height, size_bytes, mime_type, caption
  )
  values (
    new.hangout_id, new.author_id, new.storage_path,
    new.thumbnail_path, new.width, new.height,
    0, 'image/jpeg', new.caption
  )
  returning id into v_photo_id;

  update public.feed_posts
  set linked_hangout_photo_id = v_photo_id
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists feed_posts_link_album_trigger on public.feed_posts;
create trigger feed_posts_link_album_trigger
  after insert on public.feed_posts
  for each row execute function public.link_feed_post_to_hangout_album();

-- ── Cleanup stub ──────────────────────────────────────────────────────────────

create or replace function public.cleanup_expired_feed_posts()
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  delete from public.feed_posts
  where expires_at is not null
    and expires_at < now() - interval '7 days'
    and deleted_at is null;

  get diagnostics v_count = row_count;

  delete from public.feed_posts
  where deleted_at is not null
    and deleted_at < now() - interval '7 days';

  return v_count;
end;
$$;

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Wrapped in DO blocks so re-running doesn't error when tables are already members.

do $$ begin
  alter publication supabase_realtime add table public.feed_posts;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.feed_post_likes;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.feed_post_comments;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.feed_post_mentions;
exception when others then null; end $$;
