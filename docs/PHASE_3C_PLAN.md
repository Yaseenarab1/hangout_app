# Phase 3C — Story-style social feed (REVISED)

## ⚠️ This REPLACES the original Phase 3C plan

The original 3C was an event-aggregation feed ("Mike created a hangout"
cards). That feature is canceled / deferred. This new 3C is a
story-style photo feed inspired by Instagram Stories.

The old `docs/PHASE_3C_PLAN.md` should be moved to
`docs/archive/PHASE_3C_OLD_event_aggregation.md` and replaced with
this file.

## Prereq
- Phase 3.0 (realtime + push) complete and committed
- Phase 3A (chat) complete and committed — used for DM share
- Phase 3B (hangout photos) complete and committed — shares storage
  pattern + integrates with hangout-only posts
- Phase 3D + 3E (bills) status: doesn't matter, no overlap

## What we're building

A story-style social feed. Three big components:

1. **The feed (story rail + viewer)** — top-of-Home horizontal avatar
   strip; tap opens full-screen auto-advancing post viewer.
2. **Posting** — pick a photo, set visibility, optionally keep forever.
3. **Profile gallery** — permanent posts shown in a grid on user profile,
   gated by profile privacy.

Plus all the supporting infrastructure: comments, likes, mentions,
DM-share, moderation (report + block + delete), profile privacy setting.

### Scope clarification — v1 includes
- Photo posts only (NO video — defer to next phase)
- Likes, comments (text + emoji), mention parsing
- DM share (uses 3A chat as a "post" message type)
- Hangout-tagged posts that also live in the hangout's photo album
- Profile gallery for permanent posts
- 3-way profile privacy
- Report + block + delete-own

### Scope clarification — v1 EXCLUDES (defer)
- Video posts
- Repost / re-share to own feed (just DM-share for now)
- Full IG-style spot tagging on photos (just @-mentions in captions)
- Stickers, GIFs, music in posts
- True public scope (we cap at friends-of-friends — opens to true public
  when moderation infra is ready)
- Push-style "story replies" (just regular comments for v1)
- Polls / questions / quizzes inside stories
- Discovery / Explore tab
- DM-as-its-own-feature (3A handles chat already)

## Database

### `profile_visibility` enum + profile column
```sql
do $$ begin
  create type profile_visibility as enum ('everyone', 'friends_only', 'nobody');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists profile_visibility profile_visibility
    not null default 'everyone';
```

### `feed_posts` table
```sql
create table public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  width int not null,
  height int not null,
  caption text check (caption is null or length(caption) <= 2200),

  -- 'hangout' | 'friends' | 'public' (friends-of-friends for now)
  visibility text not null check (visibility in ('hangout', 'friends', 'public')),

  -- Set when visibility = 'hangout'
  hangout_id uuid references public.hangouts(id) on delete cascade,

  -- NULL = permanent (keep on profile)
  -- otherwise = ephemeral, hidden from feeds after this time
  expires_at timestamptz,

  -- If this post is also linked into a hangout_photos row (Phase 3B)
  -- so deletes cascade in both directions
  linked_hangout_photo_id uuid references public.hangout_photos(id) on delete cascade,

  created_at timestamptz not null default now(),
  -- Soft delete
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),

  constraint hangout_visibility_requires_hangout_id check (
    (visibility = 'hangout' and hangout_id is not null)
    or (visibility != 'hangout' and hangout_id is null)
  )
);

create index feed_posts_author_chrono_idx
  on public.feed_posts(author_id, created_at desc);
create index feed_posts_hangout_idx
  on public.feed_posts(hangout_id) where hangout_id is not null;
create index feed_posts_active_idx
  on public.feed_posts(created_at desc)
  where deleted_at is null and (expires_at is null or expires_at > now());
create index feed_posts_permanent_idx
  on public.feed_posts(author_id, created_at desc)
  where deleted_at is null and expires_at is null;

alter table public.feed_posts enable row level security;
```

### Helper: visibility predicate
```sql
-- Returns true if `viewer` can see `post` based on visibility rules.
-- Encapsulates the visibility logic so RLS policies stay simple.
create or replace function public.feed_post_visible_to(
  post public.feed_posts,
  viewer uuid
)
returns boolean
language sql
security definer
stable
as $$
  select
    -- Author always sees own posts
    post.author_id = viewer
    or
    -- Soft-deleted posts only visible to author (already handled by line above)
    (post.deleted_at is null and (
      -- Ephemeral posts: hide after expiry from non-author viewers
      (post.expires_at is null or post.expires_at > now())
      and (
        -- hangout: viewer must be participant of the hangout
        (post.visibility = 'hangout'
          and is_hangout_participant(post.hangout_id, viewer))
        or
        -- friends: viewer must be mutual friends with author
        (post.visibility = 'friends'
          and are_mutual_friends(post.author_id, viewer))
        or
        -- public (friends-of-friends): viewer is friend OR friend-of-friend
        (post.visibility = 'public'
          and (
            are_mutual_friends(post.author_id, viewer)
            or exists (
              select 1
              from public.friendships f1
              join public.friendships f2 on (
                (f1.user_a_id = post.author_id and f2.user_b_id = viewer
                  and f1.user_b_id = f2.user_a_id)
                or
                (f1.user_b_id = post.author_id and f2.user_a_id = viewer
                  and f1.user_a_id = f2.user_b_id)
                or
                (f1.user_a_id = post.author_id and f2.user_a_id = viewer
                  and f1.user_b_id = f2.user_b_id)
                or
                (f1.user_b_id = post.author_id and f2.user_b_id = viewer
                  and f1.user_a_id = f2.user_a_id)
              )
              where f1.status = 'accepted' and f2.status = 'accepted'
            )
          )
        )
      )
    ));
$$;
```

NOTE: the friends-of-friends query is tricky. Claude Code should
review/adapt to match the actual `friendships` schema. If the schema has
a different pattern, simplify accordingly. Worst case, fall back to
"public = friends only" for v1 and add real fof later.

### RLS policies
```sql
create policy "viewers can see visible posts"
  on public.feed_posts for select
  using (public.feed_post_visible_to(feed_posts, auth.uid()));

create policy "authors insert own posts"
  on public.feed_posts for insert
  with check (author_id = auth.uid());

create policy "authors edit own posts (caption only)"
  on public.feed_posts for update
  using (author_id = auth.uid());

create policy "authors delete own posts"
  on public.feed_posts for delete
  using (author_id = auth.uid());
```

### `feed_post_likes` table
```sql
create table public.feed_post_likes (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index feed_post_likes_user_idx on public.feed_post_likes(user_id);

alter table public.feed_post_likes enable row level security;

create policy "can like if can see post"
  on public.feed_post_likes for select
  using (exists (
    select 1 from public.feed_posts p
    where p.id = post_id
    -- delegate to feed_posts SELECT policy
  ));

create policy "like if can see post"
  on public.feed_post_likes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.feed_posts p
      where p.id = post_id
    )
  );

create policy "unlike own"
  on public.feed_post_likes for delete
  using (user_id = auth.uid());
```

### `feed_post_comments` table
```sql
create table public.feed_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) > 0 and length(body) <= 500),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index feed_post_comments_post_idx
  on public.feed_post_comments(post_id, created_at);

alter table public.feed_post_comments enable row level security;

create policy "see comments if can see post"
  on public.feed_post_comments for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.feed_posts p
      where p.id = post_id
    )
  );

create policy "comment if can see post"
  on public.feed_post_comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.feed_posts p
      where p.id = post_id
    )
  );

-- Within 5 min: edit own. Always: delete own or delete on own post.
create policy "edit own comment within 5min"
  on public.feed_post_comments for update
  using (
    user_id = auth.uid()
    and created_at > now() - interval '5 minutes'
  );

create policy "delete own comment or comment on own post"
  on public.feed_post_comments for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.feed_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );
```

### `feed_post_mentions` table
Pulled out of caption text at post creation time. Stored separately for
fast lookup of "who mentioned me" + indexable.
```sql
create table public.feed_post_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  -- User can untag themselves
  untagged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, mentioned_user_id)
);

create index feed_post_mentions_user_idx
  on public.feed_post_mentions(mentioned_user_id, created_at desc);

alter table public.feed_post_mentions enable row level security;

create policy "see mentions on visible posts"
  on public.feed_post_mentions for select
  using (
    exists (
      select 1 from public.feed_posts p
      where p.id = post_id
    )
  );

-- Inserted by post creation server-side logic (edge function or trigger)
-- Users can ONLY update to set untagged_at on themselves
create policy "untag self"
  on public.feed_post_mentions for update
  using (mentioned_user_id = auth.uid())
  with check (mentioned_user_id = auth.uid());

create policy "insert by post author"
  on public.feed_post_mentions for insert
  with check (
    exists (
      select 1 from public.feed_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );
```

### `content_reports` table — moderation queue
```sql
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  -- 'post' | 'comment' | 'user' | 'message'
  content_type text not null check (content_type in ('post', 'comment', 'user', 'message')),
  content_id uuid not null,
  reason text not null check (reason in (
    'inappropriate', 'harassment', 'spam', 'violence', 'self_harm', 'other'
  )),
  details text check (details is null or length(details) <= 1000),
  -- 'pending' | 'reviewing' | 'resolved' | 'dismissed'
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewer_id uuid references auth.users(id),
  reviewer_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index content_reports_status_idx on public.content_reports(status, created_at);

alter table public.content_reports enable row level security;

create policy "report any content"
  on public.content_reports for insert
  with check (reporter_id = auth.uid());

create policy "reporters see own reports"
  on public.content_reports for select
  using (reporter_id = auth.uid());
```

There's no admin review UI in v1 — reports just queue in the table. You
review them manually in Supabase dashboard until a moderation tool is
built.

### `user_blocks` table — if not already from Phase 1
Phase 1 had block functionality. Verify the table exists and works
bilaterally. If not, create:
```sql
-- If not already from Phase 1:
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- Update feed_post_visible_to to exclude blocked content:
-- (Re-create the function with an additional NOT EXISTS check for blocks
--  between author and viewer either direction)
```

### Storage bucket: `feed-posts`
```sql
insert into storage.buckets (id, name, public)
values ('feed-posts', 'feed-posts', false)
on conflict do nothing;
```

RLS:
```sql
-- Path: <author_id>/<post_id>.jpg and <author_id>/<post_id>_thumb.webp

create policy "see post media if can see post row"
  on storage.objects for select
  using (
    bucket_id = 'feed-posts'
    and exists (
      select 1
      from public.feed_posts p
      where p.id = (split_part(name, '/', 2)::uuid)
        -- delegate to feed_posts SELECT policy
    )
  );

create policy "upload own post media"
  on storage.objects for insert
  with check (
    bucket_id = 'feed-posts'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "delete own post media"
  on storage.objects for delete
  using (
    bucket_id = 'feed-posts'
    and auth.uid()::text = split_part(name, '/', 1)
  );
```

NOTE: parsing UUIDs out of file paths is error-prone. Verify carefully.
Test with both ephemeral and permanent posts.

### Triggers — push notifications

#### On post insert: notify mentioned users
```sql
create or replace function public.notify_post_mentions()
returns trigger as $$
declare
  v_caption text;
  v_username text;
  v_mention_record record;
  v_mentioned_id uuid;
  v_author_name text;
begin
  if new.caption is null then return new; end if;

  select display_name into v_author_name
  from public.profiles where id = new.author_id;

  -- Extract @mentions from caption
  for v_mention_record in
    select distinct lower(substring(m[1] from 1)) as username
    from regexp_matches(new.caption, '@([a-zA-Z0-9_]{3,30})', 'g') as m
  loop
    select id into v_mentioned_id
    from public.profiles
    where lower(username) = v_mention_record.username
    limit 1;

    if v_mentioned_id is null or v_mentioned_id = new.author_id then
      continue;
    end if;

    -- Insert mention row (RLS already allows this because we're the author)
    insert into public.feed_post_mentions (post_id, mentioned_user_id)
    values (new.id, v_mentioned_id)
    on conflict do nothing;

    -- Fire push (via send-push edge function)
    perform extensions.http_post(
      url := current_setting('app.settings.supabase_url')
        || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer '
          || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'userIds', jsonb_build_array(v_mentioned_id),
        'type', 'mention',
        'refId', new.id,
        'title', coalesce(v_author_name, 'Someone') || ' mentioned you',
        'body', left(new.caption, 200),
        'data', jsonb_build_object(
          'postId', new.id,
          'authorId', new.author_id
        ),
        'excludeUserId', new.author_id
      )::text
    );
  end loop;

  return new;
end;
$$ language plpgsql security definer;

create trigger feed_posts_after_insert_mentions
  after insert on public.feed_posts
  for each row execute function public.notify_post_mentions();
```

#### On comment insert: notify post author + previously commented users
```sql
create or replace function public.notify_comment_inserted()
returns trigger as $$
declare
  v_post record;
  v_recipients uuid[];
  v_commenter_name text;
begin
  select * into v_post from public.feed_posts where id = new.post_id;
  if v_post.author_id = new.user_id then return new; end if;

  -- Notify post author + anyone else who has commented (thread mode)
  select array_agg(distinct user_id)
  into v_recipients
  from (
    select v_post.author_id as user_id
    union
    select user_id from public.feed_post_comments
    where post_id = new.post_id and user_id != new.user_id
  ) sub
  where user_id != new.user_id;

  if v_recipients is null then return new; end if;

  select display_name into v_commenter_name
  from public.profiles where id = new.user_id;

  perform extensions.http_post(
    url := current_setting('app.settings.supabase_url')
      || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer '
        || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'userIds', v_recipients,
      'type', 'feed_comment',
      'refId', new.post_id,
      'title', coalesce(v_commenter_name, 'Someone') || ' commented',
      'body', left(new.body, 200),
      'data', jsonb_build_object('postId', new.post_id)
    )::text
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger feed_comments_after_insert_push
  after insert on public.feed_post_comments
  for each row execute function public.notify_comment_inserted();
```

#### Hangout-tagged post → also create hangout_photos row
```sql
create or replace function public.link_post_to_hangout_album()
returns trigger as $$
declare
  v_photo_id uuid;
begin
  if new.visibility = 'hangout' and new.hangout_id is not null then
    insert into public.hangout_photos (
      hangout_id, uploader_id, storage_path, thumbnail_path,
      width, height, size_bytes, mime_type, caption
    )
    values (
      new.hangout_id, new.author_id, new.storage_path, new.thumbnail_path,
      new.width, new.height, 0, 'image/jpeg', new.caption
    )
    returning id into v_photo_id;

    update public.feed_posts
    set linked_hangout_photo_id = v_photo_id
    where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger feed_posts_link_to_album
  after insert on public.feed_posts
  for each row execute function public.link_post_to_hangout_album();
```

### Cleanup scheduled function
After 7 days past expiry, hard-delete the post + storage object. Defer
implementation: just document that pg_cron should run this nightly.
Stub the function so Claude Code creates it but doesn't schedule it.

## Edge functions

### `share-post-to-chat` — DM-share a post into 3A chat
`supabase/functions/share-post-to-chat/index.ts`

Input:
```ts
{
  postId: string;
  recipientUserIds: string[]; // friends to DM the post to
}
```

Logic:
1. Verify caller can see the post (RLS via SELECT).
2. For each recipient: find or create a 1:1 chat thread.
   - In v1, 3A chat is hangout-only. To support DM share, we either:
     (a) Create a 1:1 hangout for the DM (weird), or
     (b) Add `hangouts.kind` enum with 'direct_message' to bypass
         participant-list requirements (cleaner)
   - **Default: (b)**. Add `kind` column to `hangouts`:
     ```sql
     alter table public.hangouts
       add column if not exists kind text not null default 'event'
       check (kind in ('event', 'direct_message'));
     ```
     Direct-message hangouts don't appear in the main hangout list;
     they're surfaced in a "DMs" view in chat.
3. Insert a message with `type='shared_post'` and `metadata={ postId }`.
4. Return list of `{ recipientId, threadId, messageId }`.

This bridge edge function is the trickiest part of 3C. Claude Code
should think about it carefully — it intersects with 3A's data model
which the user is unlikely to want to retrofit. Honest tradeoff:

- If retrofitting hangouts to support DMs feels too invasive → fall back
  to "Share = copy link" for v1 and defer DM share to 3A.v2.
- If it's a clean 1-column add → proceed.

Claude Code should ASK before implementing. Default: ask, fall back to
copy-link share if user says skip.

## UI / screens

### Home screen update — story rail at the top

`app/(tabs)/index.tsx` (or whatever Home is) — modifications:

```
┌─────────────────────────────┐
│ Hangout Planner       [+]   │  <- "+" creates new post
├─────────────────────────────┤
│ ●●●●●●●                     │  <- story rail
│ ◯ ◯ ◯ ◯ ◯                   │     horizontal scroll
│ You Mike Sarah Alex Tom      │     names below avatars
├─────────────────────────────┤
│                             │
│ [existing Home content]     │  <- scrolls; rail collapses
│                             │
│                             │
│                          [+] │  <- existing 2D FAB stays
└─────────────────────────────┘
```

- Story rail collapses (animates to 0 height) when user scrolls Home
  content beyond a threshold (~50px).
- "+" in top-right corner: opens story creation flow.
- The existing FAB (from 2D, for bill splitting) stays in bottom-right.
- Each story circle: avatar with colored ring (gradient indicates
  unread). Tap → open story viewer for that author.

### Story creation flow

`app/post/new.tsx` — NEW screen

```
┌─────────────────────────────┐
│ ← New post                  │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │                     │    │
│  │  📷 Take a photo    │    │
│  │                     │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ Upload from album   │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

After photo selected → composer screen:

```
┌─────────────────────────────┐
│ ← New post           Share  │
├─────────────────────────────┤
│  [photo preview, full width]│
│                             │
├─────────────────────────────┤
│ Caption                     │
│ [Write something... @ for   │
│  mentions]                  │
├─────────────────────────────┤
│ Visibility       Friends ▼  │
│ Keep on profile  No  ⇄ Yes  │
├─────────────────────────────┤
│ This post will disappear in │
│ 24 hours unless you keep it │
│ on your profile.            │
└─────────────────────────────┘
```

Tap "Visibility" → bottom sheet with three options + small-print
explainer for each:
- **Just this hangout** (if posted from a hangout) — only people in
  this hangout will see it
- **Friends** — people who are your friends
- **Public (friends + friends of friends)** — anyone connected to you
  through a friend can see

Tap "Share" → upload + create post. Returns to wherever they came from.

### Story viewer

`src/features/feed/components/StoryViewer.tsx` — modal component

```
┌─────────────────────────────┐
│ ━━━━━ ▮━━━━━ ━━━━━ ━━━━━    │  <- progress bars (one per post)
│ Mike • 2h ago        ×      │
├─────────────────────────────┤
│                             │
│                             │
│       [post photo]          │
│                             │
│                             │
│                             │
├─────────────────────────────┤
│ 🍕 Great pizza at @italianjoe│  <- caption
│                             │
│ ❤ 12   💬 3   ↗ Share       │
└─────────────────────────────┘
```

Gestures:
- Tap left third → previous post (same author)
- Tap right third → next post (same author)
- Tap-and-hold → pause auto-advance
- Swipe down → dismiss
- Swipe up → opens comments sheet
- Swipe left edge → next author's stories
- Swipe right edge → previous author's stories

Auto-advance: 5 seconds per post. Progress bar fills smoothly.

### Comments sheet

`src/features/feed/components/CommentsSheet.tsx` — separate modal that
opens on swipe-up from story viewer.

```
┌─────────────────────────────┐
│ Comments                  ✕ │
├─────────────────────────────┤
│ Sarah 2h ago                │
│   Looks great!              │
│ ❤ 1                         │
│ ─────────────               │
│ Alex 1h ago                 │
│   We should go!             │
│ ─────────────               │
│ ...                         │
├─────────────────────────────┤
│ [Write a comment...]   Send │
└─────────────────────────────┘
```

Realtime: new comments appear instantly. Optimistic on send.

### Profile gallery

`app/profile/[userId].tsx` (or wherever profile is) — modifications:

If `profile_visibility` doesn't allow viewing → show minimal placeholder.

Otherwise, below profile info:

```
┌─────────────────────────────┐
│ [profile info, friend count]│
├─────────────────────────────┤
│ Kept posts                  │
│ ┌───┬───┬───┐               │  3-column grid
│ │   │   │   │               │  square crops
│ ├───┼───┼───┤               │  tap → full-screen viewer
│ │   │   │   │               │     (viewer mode = single-post
│ └───┴───┴───┘               │      profile-style, NOT
└─────────────────────────────┘     auto-advancing stories)
```

### Profile privacy setting

`app/profile/settings/privacy.tsx` — modify the existing privacy
settings screen (or create if doesn't exist). Add:

```
┌─────────────────────────────┐
│ ← Privacy                   │
├─────────────────────────────┤
│ Who can view your profile   │
│  ○ Everyone (recommended)   │
│  ● Friends only             │
│  ○ Nobody                   │
├─────────────────────────────┤
│ "Nobody" makes your profile │
│ invisible to others. You    │
│ can still receive friend    │
│ requests and messages.      │
└─────────────────────────────┘
```

Saves to `profiles.profile_visibility`.

## Components

### New components
- `src/features/feed/components/StoryRail.tsx` — horizontal avatar strip on Home
- `src/features/feed/components/StoryAvatar.tsx` — circle with ring + name
- `src/features/feed/components/StoryViewer.tsx` — full-screen viewer with gestures
- `src/features/feed/components/StoryProgressBar.tsx` — top progress bars
- `src/features/feed/components/PostComposer.tsx` — creation screen body
- `src/features/feed/components/VisibilityPicker.tsx` — bottom sheet picker
- `src/features/feed/components/MentionInput.tsx` — text input with @ autocomplete
- `src/features/feed/components/CommentsSheet.tsx` — comments modal
- `src/features/feed/components/CommentRow.tsx` — single comment + actions
- `src/features/feed/components/LikeButton.tsx` — animated heart
- `src/features/feed/components/ShareSheet.tsx` — DM-share bottom sheet
- `src/features/feed/components/PostActionMenu.tsx` — long-press menu (delete, report)
- `src/features/feed/components/ProfileGallery.tsx` — 3-col grid for profile
- `src/features/feed/components/ProfileGalleryViewer.tsx` — single-post viewer for profile (no auto-advance)
- `src/features/feed/components/HomePlusButton.tsx` — top-right "+" on Home

### Updated components
- Profile screen → render `<ProfileGallery>` if visibility allows
- Home screen → render `<StoryRail>` at top + `<HomePlusButton>` in header

## Hooks
- `useStoryRail()` — list of active authors with current-user-relevant posts
- `useAuthorStories(authorId)` — list of unexpired posts for one author
- `usePost(postId)` — single post details
- `useCreatePost()` — mutation
- `useDeletePost(postId)` — mutation
- `useTogglePostLike(postId)` — optimistic
- `usePostComments(postId)` — realtime list
- `useAddComment(postId)` — optimistic
- `useDeleteComment(commentId)`
- `useSharePostToChat(postId)` — DM share via edge function
- `useReportContent()` — generic report mutation
- `useUntagSelf(postId)` — set untagged_at
- `useProfileGallery(userId)` — permanent posts for a user
- `useProfileVisibility()` — get/set on profiles

## Routes
- `app/post/new.tsx` — new post entry
- `app/post/new-composer.tsx` — after photo picked
- `app/post/[postId].tsx` — direct link to a single post (from notifications)
- `app/profile/settings/privacy.tsx` — update existing or new

## Upload pipeline (client-side)

Same pattern as Phase 3B:
1. Pick photo via `expo-image-picker`
2. Read EXIF (for any tagged time)
3. Strip EXIF + resize via `expo-image-manipulator` (max 1600px, JPEG 80%)
4. Generate thumbnail (400×400 cover crop, WebP 75%)
5. Upload main + thumb to `feed-posts/<author_id>/<post_id>.jpg`
   and `_thumb.webp`
6. Insert `feed_posts` row with both paths + caption + visibility + expires_at
7. Trigger fires → mentions parsed → linked to hangout_photos if hangout-only

## Acceptance criteria

### Posting
- [ ] Tap "+" on Home → choose photo → composer screen
- [ ] Write caption with @mention → mention shows in caption styled
- [ ] Pick visibility → bottom sheet with 3 options + explanations
- [ ] Toggle "keep on profile" → expires_at becomes null
- [ ] Hit Share → photo uploads, post appears in own story rail
- [ ] Hangout-visibility post also appears in that hangout's album

### Feed
- [ ] Story rail on Home shows authors with active (unexpired) posts
- [ ] Each circle has avatar + unread ring if I haven't seen all their posts
- [ ] Tap author → story viewer opens to their first unseen post
- [ ] Auto-advance 5s per post
- [ ] Tap left/right halves → prev/next within author
- [ ] Tap-and-hold → pauses
- [ ] Swipe down → dismisses
- [ ] Swipe up → comments sheet
- [ ] After last post of author, swipe-next → next author
- [ ] After last author, swipe-next → close viewer

### Engagement
- [ ] Like → optimistic, count updates instantly
- [ ] Comment → optimistic, appears in sheet, others see realtime
- [ ] DM share → opens recipient picker → sends to chat
- [ ] @mention → recipient gets push within 10s
- [ ] Tap mention notification → opens that post directly

### Profile
- [ ] My profile shows my permanent posts in 3-col grid
- [ ] Tap a profile post → single-post viewer (no auto-advance, swipe to next/prev permanent posts)
- [ ] Setting profile to "friends only" → strangers see placeholder
- [ ] Setting to "nobody" → even friends see placeholder
- [ ] My own view of my profile always shows everything

### Moderation
- [ ] Long-press own post → Delete option
- [ ] Long-press another user's post → Report option
- [ ] Delete post → removed from feed + storage + (if hangout) hangout album
- [ ] Block user → their posts vanish from my feed
- [ ] Blocked user → my posts vanish from their feed

### Privacy edge cases
- [ ] Hangout post: removed from hangout → keeps access to posts visible at post time
- [ ] Friends post: viewer unfriends author → post vanishes from viewer's feed
- [ ] Friends-of-friends post: relationship breaks → post may vanish; expected
- [ ] DM-share to non-friend → recipient sees "Private post" placeholder

## Edge cases

### Posting
- User picks 50 photos → only first is used (no multi-photo posts in v1)
- HEIC photo from iPhone → expo-image-manipulator converts
- Photo > 25MB → resize handles it
- Caption with no mention but contains @ symbol literally → not mention, no notification
- Caption with @nonexistent_user → no mention row created, no push
- Caption with @yourself → ignored (no self-mention)
- User loses network mid-upload → retry button, no orphan rows (upload first, insert row only on success)
- Hangout-visibility but user removed from hangout before share → block submission

### Story viewer
- Story rail empty (no friends posting) → "Stories from your friends will appear here"
- Author has 1 post → viewer opens, plays once, dismisses or goes to next author
- Author has 10 posts → all play in sequence
- Image fails to load → show skeleton with "Tap to retry"
- Network drops during viewing → continue with current post, queue next
- User taps "..." actions on own story → Delete + Edit caption (5min)
- User taps "..." on other's story → Report + Block
- Post expires while user is viewing it → continue showing this session,
  refresh removes it next session

### Mentions
- @user with capital letters in caption → matches lowercase username
- @user_with_underscores → valid
- @user with emoji adjacent → matches up to non-word char
- 10 mentions in one caption → all get notified
- User untags self → notification stays in their list as historical
- User untagged then re-mentioned in edited caption → new mention row

### Comments
- 100 comments on one post → paginate (load 30, scroll for more)
- Comment author deletes their account → comments stay with "Deleted user"
- Post author deletes any comment → permanent

### Profile privacy
- "Nobody" + receive friend request → request still arrives
- "Friends only" + non-friend tries to view profile URL → placeholder
- "Nobody" + own view → see everything
- Friend then unfriend → privacy snapshot at post time; old posts may
  remain visible per visibility rules

### Cross-feature
- Delete a hangout → hangout-visibility posts on that hangout cascade-deleted (per hangout_id FK)
- Delete linked hangout photo → also delete feed post (via linked_hangout_photo_id FK)
- Delete feed post → also delete hangout photo (via linked_hangout_photo_id) if exists
- Hangout-only post created when hangout has 50 participants — push fires to all 49 others (existing infra handles batch)

### Storage
- Bucket RLS uses path parsing — verify thoroughly. Test with permanent
  post (expires_at = null) and ephemeral post.
- Cleanup of expired posts: defer, document, don't implement scheduling in 3C

## File-by-file plan

### Database
- `supabase/migrations/<ts>_phase3c_feed.sql` — all tables, RLS, helpers, triggers, storage bucket
- Verify: `friendships` schema reference works for the visibility helper
- Verify: `user_blocks` exists from Phase 1; if not, include it in this migration

### Edge functions
- `supabase/functions/share-post-to-chat/index.ts` — DM share bridge
  (ONLY if user agrees to hangouts.kind=direct_message; ask first)

### Feature folder
- `src/features/feed/types.ts`
- `src/features/feed/schemas/index.ts`
- `src/features/feed/services/feed.service.ts`
- `src/features/feed/services/upload.service.ts`
- `src/features/feed/hooks/useStoryRail.ts`
- `src/features/feed/hooks/useAuthorStories.ts`
- `src/features/feed/hooks/usePost.ts`
- `src/features/feed/hooks/useCreatePost.ts`
- `src/features/feed/hooks/useDeletePost.ts`
- `src/features/feed/hooks/useTogglePostLike.ts`
- `src/features/feed/hooks/usePostComments.ts`
- `src/features/feed/hooks/useAddComment.ts`
- `src/features/feed/hooks/useDeleteComment.ts`
- `src/features/feed/hooks/useSharePostToChat.ts`
- `src/features/feed/hooks/useReportContent.ts`
- `src/features/feed/hooks/useUntagSelf.ts`
- `src/features/feed/hooks/useProfileGallery.ts`
- `src/features/feed/hooks/useProfileVisibility.ts`
- `src/features/feed/utils/parse-mentions.ts`
- `src/features/feed/utils/parse-mentions.test.ts`
- `src/features/feed/components/*` (all UI components listed earlier)
- `src/features/feed/index.ts`

### Routes
- `app/post/new.tsx`
- `app/post/new-composer.tsx`
- `app/post/[postId].tsx`
- `app/profile/settings/privacy.tsx` (update existing)

### Wiring
- Home screen → add `<StoryRail>` + `<HomePlusButton>`
- Profile screen → add `<ProfileGallery>` (subject to visibility)
- Notification handler (from 3.0) → route 'mention' and 'feed_comment' to post

## Test plan

1. **Migration applied.** Tables, RLS, helpers, triggers, bucket exist.
2. **Two users, mutual friends.** A and B.
3. **A posts a photo** with friends visibility. B sees it in story rail.
4. **B taps A's story** → viewer opens. Auto-advance works.
5. **B taps-and-hold** → pauses.
6. **B swipes down** → closes.
7. **B swipes up** on the story → comments sheet opens.
8. **B comments "nice!"** → A sees in real time. A's phone gets push.
9. **B likes the post** → count updates instantly for both.
10. **A posts second photo** mentioning @B (B's username) → B gets
    mention push. Push deep-links to that post.
11. **A creates hangout, adds B + C.** A posts hangout-only photo →
    appears in B + C's feed, NOT in another friend D's feed.
12. **Hangout photo album** also shows this photo (linked).
13. **A toggles "keep on profile"** when posting → photo expires_at is null.
14. **24 hours pass (or manually set expires_at to past)** → photo
    vanishes from feed but stays in DB and on A's profile gallery.
15. **A sets profile_visibility to "friends_only"** → stranger S sees
    placeholder; friend B sees full gallery.
16. **A sets to "nobody"** → B also sees placeholder.
17. **B blocks A** → A's posts vanish from B's feed.
18. **A reports B's post** → row in content_reports.
19. **RLS test:** stranger queries `feed_posts` table directly → only
    sees posts they should.
20. **Mention regex unit tests pass.**

## Done when
- All acceptance criteria pass
- `npx tsc --noEmit` clean
- All unit tests pass (mention parser)
- Two-device end-to-end test passes
- Migration committed
- The OLD `docs/PHASE_3C_PLAN.md` is moved to `docs/archive/` with note
  saying it was replaced

## Notes for Claude Code

- This is the BIGGEST feature in Phase 3. Take it slow. Get the data
  model right BEFORE building UI. Once the migration ships, schema is
  hard to change.

- Storage path parsing for RLS is fragile. Test it twice with both
  ephemeral and permanent posts. Get a SQL admin's worth of confidence
  before touching production.

- The friends-of-friends visibility query in
  `feed_post_visible_to` is the trickiest SQL. Adapt to actual
  `friendships` schema. If it's a perf concern, fall back to
  "public = friends only" — this is a v1 acceptable simplification.

- The DM share via edge function intersects with 3A chat data model.
  ASK USER before retrofitting hangouts.kind. Default fallback: skip
  DM share, just show "Copy link to share" for v1.

- The story viewer gestures are the most-likely-to-feel-bad UX. Polish
  them — 60fps, no jank. Use `react-native-gesture-handler` properly,
  use `react-native-reanimated` for the progress bar animation.

- The mention parser regex is in the trigger. Match it EXACTLY in the
  client-side `parse-mentions.ts` so they agree on what's a mention.
  `/@([a-zA-Z0-9_]{3,30})/g`.

- For "keep on profile" UX: emphasize this is the choice. Make it clear
  that ephemeral is the default. Users will accidentally save things
  forever if it's the default.

- Don't break Phase 2 or 3.0-3B. Especially: the hangout photo album
  must continue to work. The new link via `linked_hangout_photo_id`
  is additive, not a replacement.

- If something genuinely ambiguous: ASK. Especially for:
  - DM share via hangouts.kind retrofit
  - Friends-of-friends query simplification
  - Profile screen layout if it's currently very different from
    what this plan assumes

- After EACH meaningful piece (migration / utility / edge fn / UI screen):
  `npx tsc --noEmit` clean, commit with meaningful message.
