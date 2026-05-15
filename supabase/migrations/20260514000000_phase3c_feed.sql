-- ============================================================================
-- Phase 3C: Story-style social feed
--
-- Schema decisions recorded here:
-- • public = friends-only for v1 (no fof join). Expand in v2 without migration.
-- • friendships has NO status column — row presence = accepted friendship.
-- • Blocks are in public.blocks (blocker_id / blocked_id).
-- • Push notifications from mentions/comments are sent client-side (pg_net
--   not available). Triggers only handle DB-level rows (no HTTP calls).
-- • existing public.reports table is reused — no content_reports table.
-- • Storage RLS: exact path match against feed_posts columns, not UUID parsing.
-- ============================================================================

-- ── 1. profile_visibility enum + column ──────────────────────────────────────

do $$ begin
  create type public.profile_visibility as enum
    ('everyone', 'friends_only', 'nobody');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists profile_visibility public.profile_visibility
    not null default 'everyone';

-- ── 2. are_mutual_friends() ────────────────────────────────────────────────────
-- Thin alias over are_friends() so visibility code is self-documenting.
-- are_friends() already handles both canonical orderings (user_a_id < user_b_id).

create or replace function public.are_mutual_friends(_a uuid, _b uuid)
returns boolean
language sql
security definer
stable
as $$
  select public.are_friends(_a, _b);
$$;

-- ── 3. feed_posts table ───────────────────────────────────────────────────────

create table public.feed_posts (
  id                      uuid        primary key default gen_random_uuid(),
  author_id               uuid        not null
                                        references public.profiles(id)
                                        on delete cascade,
  storage_path            text        not null,
  thumbnail_path          text,
  width                   int         not null default 0,
  height                  int         not null default 0,
  caption                 text
                            check (caption is null or length(caption) <= 2200),

  -- 'hangout' | 'friends' | 'public'
  -- public = friends-only for v1; expand to true fof in v2 without migration
  visibility              text        not null
                            check (visibility in ('hangout', 'friends', 'public')),

  hangout_id              uuid        references public.hangouts(id)
                                        on delete cascade,

  -- NULL = permanent (keep on profile).
  -- Default = ephemeral 24h. Client sends NULL explicitly for "keep on profile".
  -- Failure mode for missing client value is ephemeral (safe), not permanent.
  expires_at              timestamptz default (now() + interval '24 hours'),

  -- FK to hangout_photos row created by the link trigger. SET NULL if the
  -- hangout photo is removed so the feed post stays visible.
  linked_hangout_photo_id uuid        references public.hangout_photos(id)
                                        on delete set null,

  created_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  deleted_by              uuid        references public.profiles(id),

  constraint hangout_visibility_requires_hangout_id check (
    (visibility = 'hangout' and hangout_id is not null)
    or (visibility != 'hangout' and hangout_id is null)
  )
);

create index feed_posts_author_chrono_idx
  on public.feed_posts(author_id, created_at desc);
create index feed_posts_hangout_idx
  on public.feed_posts(hangout_id)
  where hangout_id is not null;
create index feed_posts_active_idx
  on public.feed_posts(created_at desc)
  where deleted_at is null;
create index feed_posts_permanent_idx
  on public.feed_posts(author_id, created_at desc)
  where deleted_at is null and expires_at is null;
-- Used by storage RLS path matching (see policy below)
create index feed_posts_storage_path_idx
  on public.feed_posts(storage_path);
create index feed_posts_thumbnail_path_idx
  on public.feed_posts(thumbnail_path)
  where thumbnail_path is not null;

alter table public.feed_posts enable row level security;
grant all on public.feed_posts to authenticated;

-- ── 4. feed_post_visible_to() — central visibility predicate ─────────────────
-- Used by every RLS policy that gates on post visibility.
-- SECURITY DEFINER so it can query feed_posts without re-triggering RLS
-- (avoids the circular-policy recursion we hit in Phase 3D bills).

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
    -- Author always sees own posts (including deleted/expired)
    post.author_id = viewer
    or
    (
      post.deleted_at is null
      and (post.expires_at is null or post.expires_at > now())
      -- Block check: either direction hides the post
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = post.author_id and b.blocked_id = viewer)
           or (b.blocker_id = viewer        and b.blocked_id = post.author_id)
      )
      and (
        -- hangout: viewer must be a participant
        (   post.visibility = 'hangout'
          and public.is_hangout_participant(post.hangout_id, viewer)
        )
        or
        -- friends: mutual friends only
        (   post.visibility = 'friends'
          and public.are_friends(post.author_id, viewer)
        )
        or
        -- public = friends-only for v1
        -- TODO v2: expand to friends-of-friends (no migration needed — just
        --          update this branch to add the fof EXISTS subquery)
        (   post.visibility = 'public'
          and public.are_friends(post.author_id, viewer)
        )
      )
    );
$$;

-- ── 5. feed_posts RLS ─────────────────────────────────────────────────────────

create policy "feed_posts_select"
  on public.feed_posts for select
  using (public.feed_post_visible_to(feed_posts, auth.uid()));

create policy "feed_posts_insert"
  on public.feed_posts for insert
  with check (author_id = auth.uid());

-- Authors can update caption / expires_at / deleted_at on own posts
create policy "feed_posts_update"
  on public.feed_posts for update
  using (author_id = auth.uid());

create policy "feed_posts_delete"
  on public.feed_posts for delete
  using (author_id = auth.uid());

-- ── 6. feed_post_likes ────────────────────────────────────────────────────────

create table public.feed_post_likes (
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index feed_post_likes_user_idx
  on public.feed_post_likes(user_id);

alter table public.feed_post_likes enable row level security;
grant all on public.feed_post_likes to authenticated;

-- Subquery on feed_posts triggers feed_posts SELECT policy which uses
-- feed_post_visible_to (SECURITY DEFINER) — no recursion risk.
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

-- ── 7. feed_post_comments ─────────────────────────────────────────────────────

create table public.feed_post_comments (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references public.feed_posts(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id)   on delete cascade,
  body       text        not null
               check (length(body) > 0 and length(body) <= 500),
  edited_at  timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index feed_post_comments_post_idx
  on public.feed_post_comments(post_id, created_at);

alter table public.feed_post_comments enable row level security;
grant all on public.feed_post_comments to authenticated;

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

-- Edit own comment within 5 minutes of posting
create policy "feed_post_comments_update"
  on public.feed_post_comments for update
  using (
    user_id = auth.uid()
    and created_at > now() - interval '5 minutes'
  );

-- Comment author deletes own, OR post author deletes any comment on their post
create policy "feed_post_comments_delete"
  on public.feed_post_comments for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.feed_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- ── 8. feed_post_mentions ─────────────────────────────────────────────────────

create table public.feed_post_mentions (
  id                uuid    primary key default gen_random_uuid(),
  post_id           uuid    not null references public.feed_posts(id) on delete cascade,
  mentioned_user_id uuid    not null references public.profiles(id)   on delete cascade,
  -- user can untag themselves; caption stays but @ link no longer resolves
  untagged_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (post_id, mentioned_user_id)
);

create index feed_post_mentions_user_idx
  on public.feed_post_mentions(mentioned_user_id, created_at desc);

alter table public.feed_post_mentions enable row level security;
grant all on public.feed_post_mentions to authenticated;

create policy "feed_post_mentions_select"
  on public.feed_post_mentions for select
  using (
    exists (select 1 from public.feed_posts p where p.id = post_id)
  );

-- Only the post author (or SECURITY DEFINER trigger) inserts mentions
create policy "feed_post_mentions_insert"
  on public.feed_post_mentions for insert
  with check (
    exists (
      select 1 from public.feed_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- Only the mentioned user can set untagged_at on themselves
create policy "feed_post_mentions_update"
  on public.feed_post_mentions for update
  using (mentioned_user_id = auth.uid())
  with check (mentioned_user_id = auth.uid());

-- ── 9. Storage bucket: feed-posts ────────────────────────────────────────────
-- Path convention: <author_id>/<post_id>.jpg  and  <author_id>/<post_id>_thumb.webp
--
-- SELECT policy: exact match against storage_path / thumbnail_path in
-- feed_posts table. This delegates visibility entirely to feed_posts RLS
-- (via feed_post_visible_to SECURITY DEFINER) and avoids fragile UUID parsing.
-- Requires the indexes created above on storage_path and thumbnail_path.

insert into storage.buckets (id, name, public)
values ('feed-posts', 'feed-posts', false)
on conflict (id) do nothing;

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

-- ── 10. Trigger: parse @mentions into feed_post_mentions on post insert ───────
-- Regex matches /@([a-zA-Z0-9_]{3,30})/g — identical to client parse-mentions.ts.
-- Push notification is sent client-side after the post creation mutation returns
-- (pg_net not available in this project).

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

    -- Skip: user not found, or author mentioning themselves
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

create trigger feed_posts_mentions_trigger
  after insert on public.feed_posts
  for each row execute function public.handle_post_mentions();

-- ── 11. Trigger: link hangout-visibility posts to hangout_photos album ─────────
-- Fires after INSERT on feed_posts. If visibility='hangout', creates a
-- hangout_photos row so the photo also appears in the 3B album.
-- Then back-fills linked_hangout_photo_id on the feed_posts row.
-- SECURITY DEFINER so it can update feed_posts bypassing RLS.

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

  -- Back-fill the FK (safe: AFTER INSERT trigger, no recursion on INSERT trigger)
  update public.feed_posts
  set linked_hangout_photo_id = v_photo_id
  where id = new.id;

  return new;
end;
$$;

create trigger feed_posts_link_album_trigger
  after insert on public.feed_posts
  for each row execute function public.link_feed_post_to_hangout_album();

-- ── 12. Cleanup function stub (not scheduled here) ────────────────────────────
-- Wire this to pg_cron once available. Until then, run manually.
-- Soft-deletes expired posts first (7d grace); then hard-deletes.

create or replace function public.cleanup_expired_feed_posts()
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  -- Hard-delete posts that expired > 7 days ago and are not permanent
  delete from public.feed_posts
  where expires_at is not null
    and expires_at < now() - interval '7 days'
    and deleted_at is null;

  get diagnostics v_count = row_count;

  -- Hard-delete soft-deleted posts older than 7 days
  delete from public.feed_posts
  where deleted_at is not null
    and deleted_at < now() - interval '7 days';

  return v_count;
end;
$$;

-- ── 13. Realtime ─────────────────────────────────────────────────────────────

alter publication supabase_realtime
  add table public.feed_posts,
            public.feed_post_likes,
            public.feed_post_comments,
            public.feed_post_mentions;
