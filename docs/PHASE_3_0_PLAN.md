# Phase 3.0 — Foundation: Realtime + Push Notifications

This sub-phase has no user-facing feature on its own. It builds the
plumbing every other Phase 3 sub-phase relies on. Without this, 3A-3D
will all feel laggy or broken.

## What we're building
1. **Supabase Realtime infrastructure** — subscribe to postgres changes,
   merge into TanStack Query cache.
2. **Expo Push registration + token storage**
3. **Generic edge function for sending push** — used by all other
   sub-phases via direct invocation.
4. **Notification settings screen** — quiet hours, per-event-type toggles.
5. **Notification handler** — what happens when user taps a push.

## Database

### `device_tokens` table
```sql
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create index device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

create policy "users see only their own tokens"
  on public.device_tokens for select
  using (auth.uid() = user_id);

create policy "users insert their own tokens"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

create policy "users update their own tokens"
  on public.device_tokens for update
  using (auth.uid() = user_id);

create policy "users delete their own tokens"
  on public.device_tokens for delete
  using (auth.uid() = user_id);
```

### Add to `profiles` table — notification preferences
```sql
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default jsonb_build_object(
    'messages', true,
    'photos', true,
    'bills', true,
    'feed', true,
    'hangout_invites', true,
    'quiet_hours_enabled', false,
    'quiet_hours_start', '22:00',
    'quiet_hours_end', '08:00'
  );
```

### `notification_log` table — track what we sent (for debugging + dedup)
```sql
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  ref_id uuid,
  title text not null,
  body text,
  data jsonb default '{}',
  delivered boolean not null default false,
  error text,
  sent_at timestamptz not null default now()
);

create index notification_log_user_idx on public.notification_log(user_id, sent_at desc);

alter table public.notification_log enable row level security;
create policy "users see only their own log"
  on public.notification_log for select
  using (auth.uid() = user_id);
```

## Edge Function: `send-push`

`supabase/functions/send-push/index.ts`

Inputs:
```ts
{
  userIds: string[];          // recipients
  type: 'message' | 'photo_added' | 'bill_added' | 'bill_paid'
      | 'friend_post' | 'hangout_invite' | 'poll_closed' | 'rsvp_change';
  refId: string;              // hangout_id, post_id, bill_id, etc.
  title: string;
  body: string;
  data?: Record<string, unknown>;  // extra deep-link payload
  excludeUserId?: string;     // never notify the actor (Bob shouldn't get
                              //   "Bob sent a message")
}
```

Logic:
1. Filter `userIds` by removing `excludeUserId`.
2. For each remaining user:
   a. Fetch `notification_prefs` from profiles. If type's pref is false, skip.
   b. Check quiet hours. If now is in quiet hours, queue for later (or skip
      for this iteration — note in plan, defer queueing to 3.0.5).
   c. Fetch all `device_tokens` for this user.
   d. Build Expo push message: `{ to: token, title, body, data: { type, refId, ...data }, sound: 'default', badge: 1 }`.
   e. POST to `https://exp.host/--/api/v2/push/send` (Expo's free push
      service, no auth needed for ExponentPushToken[]).
   f. Insert row in `notification_log` for each recipient.

Authorize: this function is called from OTHER edge functions or postgres
webhooks. Use service-role key for invocation. Never expose to clients
directly (clients should never trigger pushes for arbitrary users).

CORS: this function is internal-only — no CORS needed.

## Realtime architecture

### Frontend hook: `useRealtimeChannel`

`src/services/realtime/useRealtimeChannel.ts`

```ts
type Config<T> = {
  channelName: string;
  table: string;
  filter?: string;        // postgres-style filter, e.g. "hangout_id=eq.<id>"
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  enabled?: boolean;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T) => void;
  onDelete?: (row: T) => void;
};

export function useRealtimeChannel<T>(config: Config<T>): void;
```

Implementation:
- On mount: `supabase.channel(channelName).on('postgres_changes', {...}).subscribe()`
- On unmount: `supabase.removeChannel(...)` — strict cleanup, no leaks.
- Reconnect on app foreground (use `AppState` listener).
- Log to console when channel opens/closes (for debugging).

### TanStack Query merge helpers

`src/services/realtime/cache.ts`

```ts
export function appendToList<T extends { id: string }>(
  qc: QueryClient,
  key: QueryKey,
  row: T,
): void;

export function updateInList<T extends { id: string }>(
  qc: QueryClient,
  key: QueryKey,
  row: T,
): void;

export function removeFromList(
  qc: QueryClient,
  key: QueryKey,
  rowId: string,
): void;
```

These mutate the existing cached list with the realtime payload — no
refetch needed.

## Push notifications client

### `src/services/notifications/index.ts`

`registerForPushNotifications()` — runs on app start, after auth.
1. Check `Permissions.askAsync(Permissions.NOTIFICATIONS)`.
2. If granted, get token via `Notifications.getExpoPushTokenAsync()`.
3. UPSERT into `device_tokens` (deduplicated on `user_id, token`).
4. Update `last_seen_at` on every app foreground.

### Notification tap handler

`Notifications.addNotificationResponseReceivedListener` — fires when user
taps a notification while app is closed/backgrounded. Routes based on
`data.type`:
- `message` → `/hangout/<refId>/chat`
- `photo_added` → `/hangout/<refId>/photos`
- `bill_added` / `bill_paid` → `/hangout/<refId>/bills`
- `friend_post` → `/feed?postId=<refId>`
- `hangout_invite` → `/hangout/<refId>`
- `poll_closed` → `/hangout/<refId>`
- `rsvp_change` → `/hangout/<refId>/participants`

Routes that don't exist yet (chat, photos, bills) are stubs in 3.0 — they
get filled in by their respective sub-phases.

### `src/app/_layout.tsx` — wire up at root
- Call `registerForPushNotifications()` after auth.
- Set up `addNotificationResponseReceivedListener` once.
- Set up `addNotificationReceivedListener` for in-app foreground banners.
- Cleanup on unmount.

## Notification settings screen

`app/profile/settings/notifications.tsx` — already exists as placeholder.
Replace with:
- Switch per type: Messages / Photos / Bills / Feed / Invites
- Quiet hours toggle + time pickers
- "Send a test notification" button (calls send-push for self)

Reads/writes `profiles.notification_prefs`.

## Stub routes (filled in by later sub-phases)

Create empty placeholders so notifications can deep-link without crashing:

- `app/hangout/[id]/chat.tsx` — "Chat coming soon"
- `app/hangout/[id]/photos.tsx` — "Photos coming soon"
- `app/hangout/[id]/bills.tsx` — "Bills coming soon"
- `app/feed.tsx` — "Feed coming soon"

## Acceptance criteria

- [ ] User signs in on a fresh install → device token stored
- [ ] User opens app on a 2nd device → 2nd token stored, both rows visible
- [ ] Sign out → device token row deleted (cascade is fine, but verify)
- [ ] Manually invoke send-push from edge function dashboard → user gets
      push within 5s
- [ ] Tap push when app closed → routes to correct screen
- [ ] Tap push when app foregrounded → in-app banner shown, then route on tap
- [ ] Notification settings screen toggles persist
- [ ] Quiet hours block pushes (verify by setting hours to current time)
- [ ] `useRealtimeChannel` reconnects after backgrounding 5+ minutes
- [ ] `useRealtimeChannel` cleans up — no duplicate subscriptions on
      remount (check supabase logs)
- [ ] RLS test: user A subscribes to user B's private channel — gets
      nothing.

## Edge cases

- User denies notification permission → no crash, just don't write to
  `device_tokens`. Show prompt to re-enable in Settings if they hit
  notification settings screen.
- User signs out → wipe device_tokens for that user (or leave them and
  tie to user_id RLS).
- Token expires → Expo push returns `DeviceNotRegistered` → delete that
  row. Edge function should handle this in the response loop.
- Rate limits — Expo allows 600 pushes per second. We're nowhere near
  this. Don't over-engineer.
- User in airplane mode → push queues server-side. Realtime will reconnect
  on online.
- Realtime subscription dies silently → log it, optionally show a "live
  updates paused" banner if dead >30s.
- Foreground push while user is on the relevant screen → don't show
  banner (already viewing).
- User taps a notification for a hangout they were removed from →
  deep-linked screen handles the empty state gracefully ("This hangout
  is no longer available").

## File-by-file plan

### Database
- `supabase/migrations/<ts>_phase3_foundation.sql` — `device_tokens`,
  `notification_log`, profile additions, RLS, indexes.

### Edge functions
- `supabase/functions/send-push/index.ts` — generic push sender.

### Backend services
- `src/services/notifications/index.ts` — register, token mgmt, listeners.
- `src/services/notifications/types.ts` — typed notification payloads.
- `src/services/realtime/useRealtimeChannel.ts` — generic channel hook.
- `src/services/realtime/cache.ts` — TanStack merge helpers.
- `src/services/realtime/index.ts` — re-exports.

### Hooks
- `src/features/profile/hooks/useNotificationPrefs.ts` — get/set user prefs.
- `src/features/profile/hooks/useDeviceTokens.ts` — list, delete.

### Routes (stubs)
- `app/hangout/[id]/chat.tsx`
- `app/hangout/[id]/photos.tsx`
- `app/hangout/[id]/bills.tsx`
- `app/feed.tsx`

### Routes (real)
- `app/profile/settings/notifications.tsx` — replace placeholder.

### Wiring
- `src/app/_layout.tsx` — register, set up listeners, route on tap.

## Test plan

1. Apply migration. Verify tables exist.
2. Deploy `send-push` function. Test invocation from Supabase dashboard.
3. Run app on simulator AND a physical device (Expo push doesn't work on
   sim — need a real iPhone for the full test).
4. Sign in on physical device. Verify `device_tokens` has a row.
5. From Supabase dashboard, invoke `send-push` with your own user id.
   Phone gets push within 5s.
6. Tap it. App opens to correct screen.
7. Toggle "Messages" off in settings. Try sending message-type push.
   Doesn't arrive.
8. Set quiet hours to current time window. Try sending. Doesn't arrive.
9. Open chat stub route. Verify realtime channel opens (console log).
10. Background app for 5min. Foreground. Verify channel reconnects.

## Done when
- All acceptance criteria pass
- No TypeScript errors (`npx tsc --noEmit` clean)
- Pushed test notification successfully delivered
- Migration committed: `git add . && git commit -m "Phase 3.0: realtime + push foundation"`
