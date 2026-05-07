# Phase 3A — Group messaging (per-hangout chat)

## Prereq
Phase 3.0 must be complete. This sub-phase USES `useRealtimeChannel`,
`send-push`, and the `chat.tsx` stub route.

## What we're building
Per-hangout group chat. Every hangout has a chat thread that all
participants (status: invited / accepted / maybe) can read and send to.

NOT in 3A: 1:1 DMs, threading, reactions on every message, voice/video.
Those are later. This is the iMessage-style group thread for the hangout.

## Database

### `messages` table
```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) > 0 and length(body) <= 4000),
  reply_to_message_id uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_hangout_idx on public.messages(hangout_id, created_at desc);
create index messages_sender_idx on public.messages(sender_id);

alter table public.messages enable row level security;

-- Participants can read all non-deleted messages
create policy "participants read messages"
  on public.messages for select
  using (
    deleted_at is null
    and is_hangout_participant(hangout_id, auth.uid())
  );

-- Only senders can insert their own messages
create policy "participants send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and is_hangout_participant(hangout_id, auth.uid())
  );

-- Only sender can update their own messages (for editing/deletion)
create policy "senders edit own messages"
  on public.messages for update
  using (auth.uid() = sender_id);
```

### `message_reactions` table
```sql
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index message_reactions_msg_idx on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

create policy "participants read reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
      and is_hangout_participant(m.hangout_id, auth.uid())
    )
  );

create policy "participants react"
  on public.message_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m
      where m.id = message_id
      and is_hangout_participant(m.hangout_id, auth.uid())
    )
  );

create policy "participants un-react"
  on public.message_reactions for delete
  using (auth.uid() = user_id);
```

### `message_read_state` table — for unread counts and read receipts
```sql
create table public.message_read_state (
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  primary key (hangout_id, user_id)
);

alter table public.message_read_state enable row level security;

create policy "users read their own state"
  on public.message_read_state for select
  using (auth.uid() = user_id);

create policy "users upsert their own state"
  on public.message_read_state for insert
  with check (auth.uid() = user_id);

create policy "users update their own state"
  on public.message_read_state for update
  using (auth.uid() = user_id);
```

### Postgres trigger to auto-send push on new message
```sql
create or replace function public.notify_message_inserted()
returns trigger as $$
declare
  v_recipients uuid[];
  v_sender_name text;
  v_hangout_title text;
begin
  -- Get recipient list (all participants except sender)
  select array_agg(p.user_id)
  into v_recipients
  from public.hangout_participants p
  where p.hangout_id = new.hangout_id
    and p.status in ('invited', 'accepted', 'maybe')
    and p.user_id != new.sender_id;

  if v_recipients is null or array_length(v_recipients, 1) is null then
    return new;
  end if;

  select display_name into v_sender_name from public.profiles where id = new.sender_id;
  select title into v_hangout_title from public.hangouts where id = new.hangout_id;

  perform extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'userIds', v_recipients,
      'type', 'message',
      'refId', new.hangout_id,
      'title', coalesce(v_sender_name, 'Someone') || ' • ' || coalesce(v_hangout_title, 'Hangout'),
      'body', left(new.body, 200),
      'data', jsonb_build_object(
        'hangoutId', new.hangout_id,
        'messageId', new.id
      )
    )::text
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger messages_after_insert_push
  after insert on public.messages
  for each row execute function public.notify_message_inserted();
```

NOTE: requires `extensions.http_post` (pg_net or http extension).
If not available, alternative: call `send-push` from the client AFTER
insert succeeds. Pick the simpler option that works in your project. The
trigger is preferred because it can't be skipped by buggy clients.

## UI / screens

### `app/hangout/[id]/chat.tsx` — main chat screen

Replace stub. Layout:

```
┌─────────────────────────────┐
│ ← Hangout title    Members  │  <- header
├─────────────────────────────┤
│                             │
│  [oldest msgs at top]       │  <- inverted FlatList
│  Mike: Hey                  │     (newest at bottom visually)
│  ━━━━━━ Today ━━━━━━        │
│  Sarah: I'm in              │
│  You: same                  │
│                             │
├─────────────────────────────┤
│ [📷] [Type a message]  [↑]  │  <- composer
└─────────────────────────────┘
```

Use `FlatList` with `inverted` for performant chat scroll. Newest at
position 0, render in reverse.

Group consecutive messages from same sender within 2 minutes — show
avatar + name once at the top of the group, subsequent messages just
have body bubble.

Show "Today" / "Yesterday" / date separators between messages > 1 hour
apart.

### Components

- `MessageBubble` — colored bubble, own = brand violet right-aligned,
  others = neutral left-aligned. Includes reaction row below if any.
  Long-press for action menu (react, reply, copy, delete if own).
- `MessageComposer` — text input + send button. Auto-resize up to 5
  lines, then scroll. Disabled state when offline.
- `TypingIndicator` — "Mike is typing…" — uses presence channel. Optional
  for v1; can be deferred.
- `ReactionPicker` — small horizontal sheet with 6 default emojis +
  "more" button.
- `MessageActionSheet` — long-press menu: React, Reply, Copy, Delete (if
  own), Report.
- `ReplyPreview` — shown above composer when replying. Tap × to cancel.
- `DateSeparator` — "Today" / "Yesterday" / formatted date.

### Hooks
- `useMessages(hangoutId)` — paginated, descending. Returns
  `{ messages, fetchOlder, isLoading }`. Realtime: appendToList on insert.
- `useSendMessage(hangoutId)` — mutation. Optimistic: add to cache with
  `pending: true` flag. On success, swap with real row. On error, mark
  `failed: true` so UI can show retry button.
- `useReactToMessage(messageId)` — toggle reaction.
- `useUpdateReadState(hangoutId)` — call on screen focus.
- `useUnreadCount(hangoutId)` — derived: messages with `created_at >
  read_state.last_read_at && sender_id != me`. Used in hangout list to
  show unread badges.

## Hangout detail integration

The hangout detail screen needs a "Chat" entry point. Add a tab bar
inside the detail screen (or a button on it) that takes user to
`/hangout/[id]/chat`.

Show unread count badge on the chat tab/button.

## Acceptance criteria

- [ ] Open a hangout chat → see all messages in order (oldest top, newest bottom)
- [ ] Send a message → appears immediately in your view (optimistic)
- [ ] Send fails (kill wifi) → message shows red ! icon, tap to retry
- [ ] User B opens same hangout chat → sees user A's message arrive in real time
- [ ] User B is on home screen with hangout list visible → unread badge
      increments when A sends a message
- [ ] User B has app closed → push notification arrives within 10s
- [ ] Tap notification → lands in chat with that hangout, message visible
- [ ] Long-press a message → action sheet
- [ ] React with emoji → appears under message in real time for everyone
- [ ] Reply to a message → quoted preview shown above composer; sent message
      includes reply context
- [ ] Delete own message → soft-delete, shows "Message deleted" placeholder
- [ ] Edit own message → "(edited)" suffix appears
- [ ] Non-participant cannot read messages (RLS verified)
- [ ] Removed participant cannot send (RLS verified)
- [ ] User on chat screen → no push delivered (foreground suppression)

## Edge cases

- User sends 100 messages quickly → all queue, all send, no duplicates
- User opens chat after 500 messages exist → pagination kicks in (load 50,
  scroll to top loads next 50)
- Message sent with 0 body → blocked client + DB constraint
- Message body 4001 chars → blocked client + DB constraint
- Message sender deleted account → show "Deleted user" instead of name
- User edits message → realtime UPDATE event reflects change
- Network drops mid-send → message marked failed; retry on tap
- Two people send at exact same instant → both appear, ordered by
  `created_at`
- App backgrounded → realtime channel closes; on foreground, reopens AND
  refetches latest messages (in case we missed any)
- Empty chat (new hangout) → friendly empty state ("Say hi to the group")
- User scrolling old messages while new ones arrive → don't auto-scroll
  (would yank them away from history). Show a "↓ N new messages" pill
  that scrolls to bottom on tap.
- Replied-to message was deleted → show "Original message deleted" in
  preview
- Notification settings: messages OFF → no pushes
- Quiet hours active → no push, but realtime still updates the in-app UI

## File-by-file plan

### Database
- `supabase/migrations/<ts>_phase3a_messaging.sql` — all tables, RLS,
  indexes, trigger.

### Backend
- (Optional) Update `send-push` to handle `type='message'` deep-link
  format. Already wired in 3.0.

### Feature folder
- `src/features/messaging/types.ts`
- `src/features/messaging/schemas/index.ts`
- `src/features/messaging/services/messages.service.ts`
- `src/features/messaging/hooks/useMessages.ts`
- `src/features/messaging/hooks/useSendMessage.ts`
- `src/features/messaging/hooks/useReactToMessage.ts`
- `src/features/messaging/hooks/useUpdateReadState.ts`
- `src/features/messaging/hooks/useUnreadCount.ts`
- `src/features/messaging/components/MessageBubble.tsx`
- `src/features/messaging/components/MessageComposer.tsx`
- `src/features/messaging/components/ReactionPicker.tsx`
- `src/features/messaging/components/MessageActionSheet.tsx`
- `src/features/messaging/components/ReplyPreview.tsx`
- `src/features/messaging/components/DateSeparator.tsx`
- `src/features/messaging/components/UnreadBadge.tsx`
- `src/features/messaging/index.ts`

### Routes
- `app/hangout/[id]/chat.tsx` — replace stub with real screen.

### Wiring
- Hangout detail screen → add Chat entry point with unread badge.
- Hangout list card → unread badge if there are unread messages.

## Test plan

1. Migration applied, RLS verified.
2. Two devices (or simulator + physical) signed in as different users.
3. Both joined same hangout.
4. User A on chat screen, user B on home → A sends → B sees badge in 2s.
5. B opens chat → message visible immediately, unread cleared.
6. B replies → A sees in real time.
7. A long-presses → reactions menu → picks 🔥 → both see reaction badge.
8. A force-quits app → B sends → push arrives on A's lock screen in <10s.
9. A taps push → app opens to chat with B's message visible.
10. A scrolls up to old messages → pagination works.
11. A turns off wifi → sends "test" → red ! icon → wifi back → tap retry → sends.
12. RLS test: log in as a non-participant, query messages directly → empty.

## Done when
- All acceptance criteria pass
- `npx tsc --noEmit` clean
- Tested with two real devices end-to-end
- Migration committed: `git commit -m "Phase 3A: group messaging"`
