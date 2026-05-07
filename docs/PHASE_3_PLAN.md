# Phase 3 — Social layer (messaging, feed, photo albums)

## Project state at start of this phase

Phases 0–2D are done. The app supports:
- Auth (Apple + email/password), profiles, friends, blocking
- Hangouts: create / invite / RSVP / co-host roles / cancel / delete
- Activity polls: simple + ranked voting, vote weights, per-user sort
- Food polls: cuisine → restaurant flow, filters, weighted voting
- Follow-up flows (cuisine wins → pick restaurant; activity wins → pick venue)
- Optimistic vote updates throughout
- Place detail sheet with photo carousel, hours, maps/call/web links
- Places photo proxy edge function
- Custom search location (AsyncStorage + profile metadata)
- Tab structure: Home / Hangouts / Friends / Profile
- New hangout bottom sheet with 4 entry points

Phase 3 adds the social and memory layer: chat inside hangouts, a social
feed for posts, and shared photo albums per hangout.

---

## F6 — Group messaging (PHASE 3A — do first)

### What it is

Real-time per-hangout text chat. Every hangout has one group thread.
Messages persist server-side. Push notifications per message (mutable).

### Why first

Chat is the most-used social feature. Once it works, photo sharing and
feed posts feel natural ("share this to the chat" → "share this to the
feed"). It also unblocks the push notification infrastructure (F12) for
the rest of Phase 3.

### Schema (new tables)

```sql
-- messages
create table messages (
  id            uuid primary key default gen_random_uuid(),
  hangout_id    uuid references hangouts(id) on delete cascade not null,
  sender_id     uuid references profiles(id) on delete set null,
  body          text not null check (char_length(body) between 1 and 2000),
  created_at    timestamptz default now() not null
);

-- read receipts (optional at v1 — can ship as stub)
create table message_reads (
  message_id    uuid references messages(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade,
  read_at       timestamptz default now() not null,
  primary key (message_id, user_id)
);
```

RLS: `is_hangout_participant(hangout_id)` for read + insert on `messages`.

### Architecture

- Supabase Realtime channel per hangout: `realtime:messages:hangout_id=eq.<id>`
- On mount: subscribe, load last 50 messages via REST
- On new message: append optimistically, confirm via Realtime event
- Pagination: load older messages on scroll-to-top (cursor-based, `created_at < cursor`)
- TanStack Query manages the cache; Realtime appends to it

### Feature-folder: `src/features/messages/`

```
messages/
  types.ts
  schemas.ts
  services/
    messages.service.ts   -- sendMessage, fetchMessages, markRead
  hooks/
    useMessages.ts        -- useMessages(hangoutId), useSendMessage()
  components/
    MessageList.tsx       -- FlatList inverted, real-time subscription
    MessageBubble.tsx     -- sender avatar, body, timestamp
    MessageInput.tsx      -- TextInput + send button
  index.ts
```

### Route

`app/hangout/[id]/chat.tsx` — new screen, reachable from hangout detail

### Wire into hangout detail

Add a "Chat" button/row in the hangout detail header or actions section.
Tab bar `messages` route is already hidden (`href: null`) — keep it hidden;
chat is per-hangout, not a global inbox.

### File-by-file plan (3A)

| # | File | Action |
|---|------|--------|
| 1 | `supabase/migrations/xxx_messages.sql` | New tables + RLS |
| 2 | `src/features/messages/types.ts` | Message, MessageRead types |
| 3 | `src/features/messages/services/messages.service.ts` | fetchMessages, sendMessage |
| 4 | `src/features/messages/hooks/useMessages.ts` | useMessages, useSendMessage |
| 5 | `src/features/messages/components/MessageBubble.tsx` | Single message row |
| 6 | `src/features/messages/components/MessageInput.tsx` | Input + send |
| 7 | `src/features/messages/components/MessageList.tsx` | FlatList + Realtime sub |
| 8 | `src/features/messages/index.ts` | Exports |
| 9 | `app/hangout/[id]/chat.tsx` | Full chat screen |
| 10 | Wire into hangout detail screen | Chat entry point |

### Edge cases

- Send fails → toast "Failed to send", message reverts (optimistic undo)
- Offline → disable send button, show "You're offline"
- Long message (>2000 chars) → client-side char count, disable send over limit
- New user joins hangout → sees full history
- Sender deleted account → show "Deleted user" with ghost avatar
- Hangout cancelled → chat still readable, but send is disabled
- Scroll to bottom button: if user is >200px from bottom, show FAB

---

## F8 — Shared photo albums (PHASE 3B — do second)

### What it is

Each hangout has a photo album. Participants upload photos; everyone in
the hangout can view, save to camera roll, and delete their own uploads.
Host can delete any photo.

### Why second

Photo albums are self-contained (no chat dependency). Uploading a photo
to a hangout is a natural next step after sending messages.

### Schema (new tables)

```sql
create table hangout_photos (
  id            uuid primary key default gen_random_uuid(),
  hangout_id    uuid references hangouts(id) on delete cascade not null,
  uploader_id   uuid references profiles(id) on delete set null,
  storage_path  text not null,        -- e.g. hangout-photos/<hangout_id>/<photo_id>.jpg
  thumbnail_path text,                -- <photo_id>_thumb.jpg
  width         int,
  height        int,
  caption       text check (char_length(caption) <= 200),
  created_at    timestamptz default now() not null
);
```

Storage bucket: `hangout-photos` (private, authenticated reads via RLS).

RLS: read = `is_hangout_participant(hangout_id)`. Insert = same.
Delete = `uploader_id = auth.uid() OR is_hangout_host(hangout_id)`.

### Architecture

- Upload: `expo-image-picker` → resize to max 1920px long edge → JPEG →
  upload to `hangout-photos/<hangout_id>/<uuid>.jpg`
- Thumbnail: resize to 400px long edge → upload as `<uuid>_thumb.jpg`
- EXIF strip: `expo-image-manipulator` strips metadata automatically
  (no explicit EXIF library needed — manipulate() returns clean JPEG)
- Display: masonry or uniform grid of thumbnails, tap → full-screen viewer

### Feature-folder: `src/features/photos/`

```
photos/
  types.ts
  services/
    photos.service.ts     -- uploadPhoto, fetchPhotos, deletePhoto
  hooks/
    usePhotos.ts          -- useHangoutPhotos, useUploadPhoto, useDeletePhoto
  components/
    PhotoGrid.tsx         -- uniform grid with thumbnail images
    PhotoViewer.tsx       -- full-screen modal, swipe between photos
    PhotoUploadButton.tsx -- camera icon FAB
  index.ts
```

### Route

`app/hangout/[id]/photos.tsx` — tab or button in hangout detail

### File-by-file plan (3B)

| # | File | Action |
|---|------|--------|
| 1 | `supabase/migrations/xxx_hangout_photos.sql` | Table + RLS + bucket policy |
| 2 | `src/features/photos/types.ts` | HangoutPhoto type |
| 3 | `src/features/photos/services/photos.service.ts` | upload, fetch, delete |
| 4 | `src/features/photos/hooks/usePhotos.ts` | useHangoutPhotos, useUploadPhoto, useDeletePhoto |
| 5 | `src/features/photos/components/PhotoGrid.tsx` | Grid layout |
| 6 | `src/features/photos/components/PhotoViewer.tsx` | Full-screen viewer + swipe |
| 7 | `src/features/photos/components/PhotoUploadButton.tsx` | FAB with picker |
| 8 | `src/features/photos/index.ts` | Exports |
| 9 | `app/hangout/[id]/photos.tsx` | Photo album screen |
| 10 | Wire into hangout detail | "Photos" entry point |

### Edge cases

- Pick photo > 10 MB → warn + reject before upload, not after
- Upload fails mid-way → show error toast, photo not added to grid
- User deletes photo while others are viewing → graceful 404 (show broken
  placeholder, no crash)
- No photos yet → empty state "No photos yet. Add the first one."
- Storage quota → handle 413 from Supabase with friendly message
- Multiple simultaneous uploads → queue them, show progress per photo
- iOS permission not granted → prompt with expo-image-picker's built-in
  permission flow

---

## F7 — Social feed (PHASE 3C — do last)

### What it is

Friends-only activity feed. Users post about hangouts with photos and
text. Friends can like (4 reactions) and comment. Chronological, no algo.

### Why last

Feed depends on photo infrastructure (F8) for image uploads. It also
benefits from having chat and photo album patterns established.

### Schema (new tables)

```sql
create table posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references profiles(id) on delete cascade not null,
  hangout_id    uuid references hangouts(id) on delete set null,
  body          text check (char_length(body) <= 1000),
  visibility    text not null default 'friends'
                  check (visibility in ('friends', 'hangout', 'selected')),
  created_at    timestamptz default now() not null,
  constraint    posts_has_content check (body is not null or
                (select count(*) from post_photos where post_id = id) > 0)
);

create table post_photos (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references posts(id) on delete cascade not null,
  storage_path  text not null,
  display_order smallint not null default 0
);

create table post_reactions (
  post_id       uuid references posts(id) on delete cascade,
  user_id       uuid references profiles(id) on delete cascade,
  reaction      text not null check (reaction in ('like','love','laugh','wow')),
  created_at    timestamptz default now() not null,
  primary key (post_id, user_id)
);

create table post_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references posts(id) on delete cascade not null,
  author_id     uuid references profiles(id) on delete cascade not null,
  body          text not null check (char_length(body) between 1 and 500),
  created_at    timestamptz default now() not null
);
```

RLS: posts visible if `author_id in (user's friends)` or `hangout_id`
participant. Comments/reactions follow post visibility.

### Feature-folder: `src/features/feed/`

```
feed/
  types.ts
  services/
    feed.service.ts
  hooks/
    useFeed.ts            -- useFeed(), useCreatePost(), useReact(), useComment()
  components/
    FeedPost.tsx          -- single post card (photos, body, reactions, comments)
    ReactionBar.tsx       -- 4 reaction buttons with counts
    CommentSheet.tsx      -- bottom sheet with comment list + input
    CreatePostSheet.tsx   -- compose new post (attach photos, write body)
  index.ts
```

### Route

`app/(tabs)/feed.tsx` — new tab OR embedded in Home tab (TBD — see note)

> **Note:** The tab bar already has 4 slots (Home / Hangouts / Friends /
> Profile). Adding a Feed tab would make 5. Options:
> (a) Replace Home with Feed (Home content moves to a sub-section of Feed)
> (b) Add 5th tab — works on iOS with smaller icons, slightly cramped
> (c) Feed lives inside the Home tab as a scrollable section below quick actions
> Ask the user before implementing.

### File-by-file plan (3C)

| # | File | Action |
|---|------|--------|
| 1 | `supabase/migrations/xxx_posts.sql` | Tables + RLS |
| 2 | `src/features/feed/types.ts` | Post, Reaction, Comment types |
| 3 | `src/features/feed/services/feed.service.ts` | fetchFeed, createPost, react, comment |
| 4 | `src/features/feed/hooks/useFeed.ts` | Queries + mutations |
| 5 | `src/features/feed/components/ReactionBar.tsx` | 4-button row |
| 6 | `src/features/feed/components/CommentSheet.tsx` | Comments bottom sheet |
| 7 | `src/features/feed/components/FeedPost.tsx` | Full post card |
| 8 | `src/features/feed/components/CreatePostSheet.tsx` | Compose modal |
| 9 | `src/features/feed/index.ts` | Exports |
| 10 | Feed screen + tab wiring (TBD) | Depends on tab decision |

### Edge cases

- Post with no content (no body, no photos) → disabled submit button
- 10-photo limit → enforce in picker, show count badge
- Reaction toggle: tap again to unreact (same reaction = toggle off)
- Change reaction: tap different reaction = replaces previous
- Delete post: confirm dialog → cascade deletes photos + comments + reactions
- Visibility = 'selected': requires a friend picker (defer to v1.1 if complex)
- Infinite scroll: cursor-based on `created_at`
- Report post: flag-only at v1, manual moderation queue

---

## Acceptance criteria (full Phase 3)

### 3A (chat)
- [ ] Messages appear in real-time without refresh
- [ ] Sending a message is optimistic (appears immediately)
- [ ] Failed send shows toast + reverts
- [ ] Scroll to bottom on new message if user is near bottom
- [ ] "Scroll to bottom" FAB when far from bottom
- [ ] Pagination: older messages load on scroll to top

### 3B (photos)
- [ ] Upload photo → appears in grid without refresh
- [ ] EXIF data stripped (location metadata removed)
- [ ] Failed upload → toast, no broken entry in grid
- [ ] Host can delete any photo; uploader can delete their own
- [ ] Tap thumbnail → full-screen viewer with swipe between photos
- [ ] Save to camera roll button in viewer

### 3C (feed)
- [ ] Feed shows posts from friends in reverse-chron order
- [ ] React to a post (optimistic)
- [ ] Comment on a post
- [ ] Create post with photos and/or text
- [ ] Delete own post
- [ ] Report post (flag only)

---

## What's NOT in Phase 3

- Push notifications (Phase 5)
- 1-on-1 DMs (v2 stretch)
- Read receipts (stub only)
- AI captions / smart albums
- End-to-end encryption
- Find Time (F11) — Phase 4
- Bill tracker (F9) — Phase 4
- Live location (F10) — Phase 4
- Suggest-Then-Vote mode in polls — can backfill in 3A downtime

---

## How to start Phase 3A (messaging)

1. Read this file + `CLAUDE.md`
2. Confirm you understand Supabase Realtime subscription pattern
3. Start with migration (file 1), then work top-to-bottom in the table above
4. After each file: `npx tsc --noEmit`
5. After 3A works end-to-end: commit, then start 3B
