# Phase 3C — Social feed

## Prereq
Phase 3.0, 3A (chat), 3B (photos), and 3D (bills) ideally complete. The
feed surfaces activity FROM these features — without them, the feed is
empty.

## What we're building
A home-screen feed showing what the user's friends have been up to.
This is the "Instagram + Strava + BeReal" feel — social proof + casual
sharing. It's READ-FIRST: the feed shows aggregated events; users don't
"post" directly here. Posts are derived from feature events.

Scope for v1:
- Aggregated event feed (hangout created, photos added, bill settled,
  poll closed)
- Like + comment on items (lightweight social interaction)
- Privacy: only friends-of-friends or hangout-participants can see your
  events
- "Highlight" share — user can manually share a hangout retrospective to
  their feed (after-the-fact)

NOT in 3C v1:
- Stories / ephemeral content
- Followers (no asymmetric graph; only mutual friendships count)
- Algorithmic ranking — purely chronological
- DMs from the feed
- Paid promotion or ads
- Discoverability beyond friend graph

## Database

### `feed_events` table — denormalized event log
Events are written as a side effect of feature actions. The feed reads
from here. This makes querying the feed a simple JOIN, not a UNION ALL of
N source tables.

```sql
create type feed_event_type as enum (
  'hangout_created',     -- "Mike created a hangout: Friday Drinks"
  'photos_added',        -- "Sarah added 5 photos to Friday Drinks"
  'bill_settled',        -- "All bills settled for Friday Drinks"
  'poll_winner',         -- "Hit the bar won the vote"
  'highlight'            -- user-manual hangout retrospective
);

create table public.feed_events (
  id uuid primary key default gen_random_uuid(),
  type feed_event_type not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  hangout_id uuid references public.hangouts(id) on delete cascade,
  -- Optional refs for type-specific payloads
  ref_id uuid,            -- photo_id, bill_id, poll_id, etc.
  payload jsonb not null default '{}',
  -- Privacy: who can see this. Computed at write time.
  -- 'public' = friends of actor
  -- 'hangout' = participants of the referenced hangout only
  -- 'private' = only actor (not used in v1, reserved)
  visibility text not null default 'hangout' check (visibility in ('public', 'hangout', 'private')),
  created_at timestamptz not null default now()
);

create index feed_events_actor_idx on public.feed_events(actor_id, created_at desc);
create index feed_events_hangout_idx on public.feed_events(hangout_id, created_at desc);
create index feed_events_chrono_idx on public.feed_events(created_at desc);

alter table public.feed_events enable row level security;

-- A user can see an event if:
--   - It's their own (always)
--   - visibility = 'public' AND they're friends with the actor
--   - visibility = 'hangout' AND they're a participant of the hangout
create policy "feed visibility"
  on public.feed_events for select
  using (
    actor_id = auth.uid()
    or (visibility = 'public' and public.are_mutual_friends(actor_id, auth.uid()))
    or (visibility = 'hangout' and is_hangout_participant(hangout_id, auth.uid()))
  );

-- Only the actor can insert events for themselves.
-- (In practice, events are inserted via triggers on source tables, but
--  we still want this safety in case of direct inserts.)
create policy "actor inserts own events"
  on public.feed_events for insert
  with check (actor_id = auth.uid());

create policy "actor deletes own events"
  on public.feed_events for delete
  using (actor_id = auth.uid());
```

### Helper: `are_mutual_friends`
```sql
create or replace function public.are_mutual_friends(a uuid, b uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.friendships
    where (
      (user_a_id = a and user_b_id = b) or
      (user_a_id = b and user_b_id = a)
    )
    and status = 'accepted'
  );
$$;
```

(Adjust schema to match your existing friendships table — the project
already has a friends feature; the helper just needs to wrap that
schema's logic.)

### `feed_event_likes` and `feed_event_comments` tables
```sql
create table public.feed_event_likes (
  event_id uuid not null references public.feed_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.feed_event_likes enable row level security;

-- Like visibility = ability to see the event
create policy "see likes if can see event"
  on public.feed_event_likes for select
  using (
    exists (
      select 1 from public.feed_events e
      where e.id = event_id
      -- Trust the SELECT policy on feed_events to determine visibility
    )
  );

create policy "like if can see event"
  on public.feed_event_likes for insert
  with check (auth.uid() = user_id);

create policy "unlike own"
  on public.feed_event_likes for delete
  using (auth.uid() = user_id);

create table public.feed_event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.feed_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) > 0 and length(body) <= 500),
  created_at timestamptz not null default now()
);

create index feed_event_comments_event_idx on public.feed_event_comments(event_id, created_at);

alter table public.feed_event_comments enable row level security;

create policy "see comments if can see event"
  on public.feed_event_comments for select
  using (
    exists (
      select 1 from public.feed_events e
      where e.id = event_id
    )
  );

create policy "comment if can see event"
  on public.feed_event_comments for insert
  with check (auth.uid() = user_id);

create policy "edit own comments"
  on public.feed_event_comments for update
  using (auth.uid() = user_id);

create policy "delete own comments"
  on public.feed_event_comments for delete
  using (auth.uid() = user_id);
```

## Triggers — auto-create feed events

When source tables change, insert into `feed_events`. Examples:

### Hangout created
```sql
create or replace function public.feed_event_hangout_created()
returns trigger as $$
begin
  insert into public.feed_events (type, actor_id, hangout_id, visibility)
  values ('hangout_created', new.host_id, new.id, 'public');
  return new;
end;
$$ language plpgsql security definer;

create trigger hangouts_feed_after_insert
  after insert on public.hangouts
  for each row execute function public.feed_event_hangout_created();
```

### Photos added (rollup; once per uploader per hangout per 60s)
Reuse the same coalescing logic from 3B's notification trigger. On
"first photo of a burst," insert ONE feed_event with `payload: { count: <n> }`
and update if more come in.

Cleaner v1: just create a `feed_event` per upload session (defined as the
group inserted in one client request). Client passes a `session_id` and
the trigger groups by `(uploader_id, session_id)`.

For first pass: trigger inserts ONE feed_event per uploader per minute
per hangout. Don't over-engineer.

### Bill settled (only when ALL shares of a hangout's bills are settled)
Trigger on `bill_shares` UPDATE. Check if any unsettled shares remain in
the hangout. If none, insert `bill_settled` event. (Edge case: voided
bills don't count as "unsettled.")

### Poll winner (when a poll closes with a winner)
Trigger on `polls` UPDATE: if `phase` changes to `'closed'` and
`winning_option_id` is not null, insert `poll_winner` event with
`payload: { option_label, option_emoji }`.

### Manual highlights
Inserted directly by the user via a UI action. payload includes
`{ caption, photo_ids[] }`. Visibility = 'public' (visible to friends).

## Notifications for feed events

When a friend's hangout/photo/etc. event is created, push to friends
who:
- Have feed notifications enabled
- Are in the actor's friend list

Aggregate — don't push for every single event. Bundle: "3 friends posted
today" sent at 6pm if user hasn't opened the app. Defer this to v1.5;
v1 sends individual pushes per event with rate limit (max 1 per friend
per hour).

## UI / screens

### `app/feed.tsx` — replace stub

Layout:
```
┌─────────────────────────────┐
│ Feed                        │
├─────────────────────────────┤
│ Mike created Friday Drinks  │  <- card
│ 2h ago                      │
│ 🍻 6 going  📅 Fri 7pm      │
│ ❤ 3   💬 1                  │
│ ─────────                   │
│ Sarah added 12 photos       │  <- card with photo strip
│ to Beach Day  • 5h ago      │
│ [photo strip preview]       │
│ ❤ 8   💬 4                  │
│ ─────────                   │
│ All bills settled           │
│ for Italy Trip • Yesterday  │
│ Total: $1,247 • 5 people    │
│ ❤ 12                        │
└─────────────────────────────┘
```

Pull-to-refresh. Realtime: new events prepend to top with a "↓ N new"
pill if user has scrolled.

### Card variants (one per event type)
- `HangoutCreatedCard` — title, when, who, RSVP shortcut
- `PhotosAddedCard` — strip of up to 5 thumbs, "Tap to view album"
- `BillSettledCard` — total amount, # people, summary
- `PollWinnerCard` — winning option label + emoji, like trophy
- `HighlightCard` — user-authored: caption + photo grid

All cards share:
- Header: actor avatar, name, time, optional hangout title
- Footer: ❤ button with count, 💬 button with count, expand-to-comments

### Comments view
Tap a card to expand → comments below. Realtime updates. Send via
composer at the bottom (similar to chat composer but simpler).

### Like animation
Tap heart → fills purple, count +1 immediately (optimistic). Tap again to
unlike.

### Components
- `FeedList` — main FlatList with mixed card types
- `FeedCardWrapper` — common header/footer
- `HangoutCreatedCard`
- `PhotosAddedCard`
- `BillSettledCard`
- `PollWinnerCard`
- `HighlightCard`
- `FeedCommentsSheet` — bottom sheet showing comments
- `FeedComposer` — only used inside comments sheet
- `LikeButton` — animated heart

### Hooks
- `useFeed()` — paginated, descending, realtime prepend
- `useToggleLike(eventId)` — mutation
- `useFeedComments(eventId)` — list comments
- `useAddComment(eventId)` — mutation
- `useDeleteComment(commentId)`
- `useCreateHighlight()` — mutation for manual posts

### Highlight composer screen
`app/feed/new-highlight.tsx`
- Pick a hangout (must be one user is participant of)
- Optional caption (500 chars)
- Pick photos from the hangout's album (or upload new — leverage 3B
  uploader)
- Save → creates `highlight` feed event, pushes to friends

## Acceptance criteria

- [ ] Feed loads in <1s, shows recent events from friends + own hangouts
- [ ] Pull-to-refresh works
- [ ] New events arrive in real time with a pill: "↓ 1 new" → tap scrolls to top
- [ ] Tap a card → either expands comments OR navigates to source
      (hangout / photo album / bill — pick best UX per card type)
- [ ] Like a card → optimistic, syncs to other users instantly
- [ ] Comment on a card → optimistic, others see in real time
- [ ] Privacy: stranger doesn't see your hangout events
- [ ] Privacy: hangout-only events only visible to participants (NOT
      friends not in the hangout)
- [ ] Notifications: friend creates hangout → push (subject to prefs)
- [ ] Highlights: user can manually post a hangout retrospective
- [ ] Empty feed (new user, no friends, no hangouts) → empty state with
      CTA to add friends or create a hangout

## Edge cases

- New user, 0 friends → empty feed, friendly empty state
- User adds 50 friends at once → feed populates retroactively (ALL old
  events become visible). This is correct: friendship grants visibility
  to historical 'public' events.
- Friend unfriends user → friend's 'public' events disappear from feed.
  RLS handles this automatically.
- User leaves hangout (declines) → 'hangout' visibility events for that
  hangout disappear from their feed. Their own past events stay.
- Hangout deleted → cascade deletes feed_events (and likes/comments
  attached to them). Acceptable.
- User deletes own hangout → all 'public' events about it removed from
  friends' feeds.
- Spam: user manually creates 100 highlights → rate limit at the route
  level (max 5 per hour per user).
- Like spam: same user toggles like 100 times in a second → debounce on
  client. Server doesn't need rate limit (idempotent due to PK).
- Comment with @mention — out of scope for v1; v2 feature.
- Long comment (501 chars) → blocked client + DB.
- Profanity filter — out of scope; defer to community moderation.
- Realtime channel disconnects → fall back to refresh on next foreground.
- Pagination + realtime: new events prepend, pagination is for OLDER
  events. Cursor-based: `created_at < <cursor>`.
- Two friends post simultaneously → both events appear, ordered by
  created_at.
- Event from a friend you blocked → blocked friends can't see your events
  AND vice versa. Update `are_mutual_friends` to return false if either
  side has blocked the other.

## File-by-file plan

### Database
- `supabase/migrations/<ts>_phase3c_feed.sql` — feed_events,
  feed_event_likes, feed_event_comments, are_mutual_friends helper, RLS,
  triggers on hangouts/photos/bills/polls.

### Feature folder
- `src/features/feed/types.ts`
- `src/features/feed/services/feed.service.ts`
- `src/features/feed/hooks/useFeed.ts`
- `src/features/feed/hooks/useToggleLike.ts`
- `src/features/feed/hooks/useFeedComments.ts`
- `src/features/feed/hooks/useAddComment.ts`
- `src/features/feed/hooks/useCreateHighlight.ts`
- `src/features/feed/components/FeedList.tsx`
- `src/features/feed/components/FeedCardWrapper.tsx`
- `src/features/feed/components/cards/HangoutCreatedCard.tsx`
- `src/features/feed/components/cards/PhotosAddedCard.tsx`
- `src/features/feed/components/cards/BillSettledCard.tsx`
- `src/features/feed/components/cards/PollWinnerCard.tsx`
- `src/features/feed/components/cards/HighlightCard.tsx`
- `src/features/feed/components/FeedCommentsSheet.tsx`
- `src/features/feed/components/LikeButton.tsx`
- `src/features/feed/index.ts`

### Routes
- `app/feed.tsx` — replace stub with main feed
- `app/feed/new-highlight.tsx` — manual highlight composer

### Wiring
- Bottom tab bar: add Feed tab (or wire wherever Phase 2D's nav restructure put it)
- Push notifications for feed events: use existing `send-push` from 3.0

## Test plan

1. Migration applied. Helper function works (`select are_mutual_friends('a', 'b')`).
2. Two users, friends.
3. User A creates a hangout → User B sees it on feed within seconds.
4. User A adds 3 photos → User B sees "User A added photos" card, tap shows preview.
5. User B likes → User A's view updates with new like count in real time.
6. User B comments → User A's view shows comment.
7. User A creates a 3rd user as friend, hangout-only → 3rd user joins, sees
   hangout events, but NOT public-only events from B (until they're friends).
8. RLS test: log in as a stranger, query feed_events → empty.
9. Block test: A blocks B → A's feed loses B's events; B's feed loses A's events.
10. Highlight: A goes to feed, taps "+", picks an old hangout, writes a
    caption, picks 3 photos → publishes → B sees it on top of feed.
11. Pagination: scroll down past 30 events → loads next 30.
12. Realtime prepend: while B scrolling, A creates a hangout → "↓ 1 new" pill.

## Done when
- All acceptance criteria pass
- `npx tsc --noEmit` clean
- Two-friend feed test passes end-to-end
- Migration committed: `git commit -m "Phase 3C: social feed"`
