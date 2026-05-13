# Hangout Planner — project context

## What this is
Production iOS app for friend-group event planning, expense splitting,
scheduling, and a social feed (think Partiful + Splitwise + When2Meet).
First-time mobile dev (web background). Solo for now, will form a company
after public launch. Initial launch target: NYC.

## Stack (locked — do not change without asking)
- Expo SDK 52, React Native 0.76, TypeScript strict
- Supabase (project ref: `cruosjnuhcuewjnzhlja`, URL: `https://cruosjnuhcuewjnzhlja.supabase.co`)
- Zustand (UI state), TanStack Query (server state), React Hook Form + Zod (forms)
- Apple Sign-In + email/password auth
- Expo Push (Phase 3 onwards), Sentry, PostHog
- Supabase Realtime for live updates (Phase 3 onwards)
- npm (not pnpm)
- Brand color: `#8B5CF6` (violet)
- Google Cloud Vision API (same Google Cloud project as Places). Used for
  receipt OCR via the Vision REST endpoint. Secret: `GOOGLE_CLOUD_VISION_API_KEY`
  (separate from `GOOGLE_PLACES_API_KEY`). Enable "Cloud Vision API" in
  Google Cloud Console.

## Conventions
- Feature-folder structure under `src/features/<feature>/`
  - `components/`, `hooks/`, `services/`, `schemas/`, `types.ts`, `index.ts`
- Routes live in `app/` (expo-router file-based routing)
- UI primitives live in `src/components/ui/`
- Hooks named `useFoo` return `{ data, isLoading, ... }` from TanStack Query
  or trigger mutations
- Services in `services/foo.service.ts` — pure async functions, no React
- Theme via `useTheme()` hook — never hardcode colors except the brand violet
- All money in cents (BIGINT) — never floats
- Prefer `gen_random_uuid()` over `uuid_generate_v4()` in SQL
- All extensions go in the `extensions` schema

## Critical rules — do not break

### Layout
- Sticky bottom buttons: a `<View>` at the bottom of a `flex: 1` container,
  NOT a `bottomBar` prop on `<Screen>` (no such prop exists).
- Pickers should not own their own bottom button or summary rows — those
  belong to the parent route screen so multiple pickers can compose into
  the same layout without overlap.
- Sheet modals use `presentationStyle="pageSheet"` on iOS.

### Optimistic updates
- Mutations that affect the UI immediately (votes, message sends, reactions,
  bill marks-paid, etc.) MUST be optimistic. UI flips immediately, reverts
  on error with toast.
- Pattern: `onMutate` → save prev, set new state. `onError` → restore prev.
  `onSettled` → invalidate to reconcile.

### Realtime (Phase 3+)
- Use Supabase Realtime channel subscriptions for live data. Never poll
  for data that has a realtime channel.
- Channel naming: `hangout:<id>:messages`, `hangout:<id>:photos`,
  `hangout:<id>:bills`, `feed:<userId>`.
- Always unsubscribe on unmount. Centralize subscription logic in hooks
  (`useChannelSubscription`).
- Realtime updates should merge into TanStack Query cache, not bypass it.
  Pattern: `qc.setQueryData(key, prev => merge(prev, payload))`.
- For sensitive tables, RLS still applies to realtime — verify policies
  cover SELECT for the listening user.

### Push notifications (Phase 3+)
- Use `expo-notifications` for client. Server sends via Expo Push API
  (free tier) from Supabase edge functions.
- Each user has a `device_tokens` table row per device (multiple devices
  per user supported). Token deduped + refreshed on app open.
- Notification triggers fire from postgres triggers OR edge functions
  on specific events. Centralize in `supabase/functions/send-push/`.
- Always include `data: { type, refId }` so the app can deep-link.
- Never send a push to the user who triggered the action (no self-notify).
- Respect quiet hours: pull from user profile `metadata.quiet_hours`.
- When user taps a notification, route based on `type`:
  - `message` → `/hangout/<refId>/chat`
  - `photo_added` → `/hangout/<refId>/photos`
  - `bill_added` → `/hangout/<refId>/bills`
  - `bill_paid` → `/hangout/<refId>/bills`
  - `friend_post` → `/feed` with that post highlighted

### Voting (Phase 2 — established)
- Two methods: `simple` (one tap) and `ranked` (instant runoff).
- Per-user sort: each viewer sees their own picks at top.
- Vote weights per participant: 0× / 0.5× / 1× / 2× / 3×. Host-set only.
  DB constraint: `vote_weight >= 0 AND vote_weight <= 5`.

### Roles
- Host: full control (cancel, delete, promote/demote co-hosts).
- Co-host: edit details, invite, remove guests, add poll options. Cannot
  promote/demote/cancel/delete.
- `is_hangout_participant` SQL helper must include statuses: 'invited',
  'accepted', 'maybe', 'declined' (NOT 'removed').

### RLS
- Deny by default. Every table has policies.
- Common pattern: `using (auth.uid() = user_id OR is_hangout_participant(...))`.
- Realtime subscriptions also obey RLS — test with another user's account.

### Money / bills
- All amounts in cents, BIGINT, never floats.
- Splits computed server-side (via SQL function or edge function), never
  client-side, to prevent rounding-disagreement.
  - **3E exception:** itemized bill share totals are computed client-side
    (in `compute-item-shares.ts`) and inserted as `bill_shares.amount_cents`
    only when the user taps "Save bill." The review step is the safety net.
- Bill status enum: `pending` / `partially_paid` / `paid` / `void`.
- Greedy debt simplification: when N people owe each other, reduce to
  minimum number of payments using net-balance algorithm.

### Receipt OCR (Phase 3E+)
- All Vision API calls go through the `scan-receipt` Supabase edge function.
  Never call Vision API directly from the client — protects the API key.
- Vision mode: `TEXT_DETECTION` (NOT `DOCUMENT_TEXT_DETECTION`).
  TEXT_DETECTION returns position-tagged blocks better suited for receipt parsing.
- OCR results are always editable. After parse, the user reviews and fixes
  items before assigning. Treat OCR as a first draft, never as ground truth.
- If OCR fails (timeout, low confidence, no items detected) → fall back to
  manual entry flow with a friendly toast, not a hard error.
- Don't store receipt images more than 30 days unless user keeps it as the
  bill receipt. Cleanup via scheduled function (future work).

### Item-level bills (Phase 3E+)
- A `bill` can be in two modes: `whole` (legacy, Phase 3D) or `itemized` (3E).
- Itemized bills have a `bill_items` table. Each item is assigned to one or
  more participants via `bill_item_assignments`.
- Tax and tip get distributed PROPORTIONALLY to each person's item subtotal —
  never split equally. If Mike's items = $40 and Sarah's = $20, and tax = $6,
  Mike pays $4 tax, Sarah pays $2.
- Rounding: distribute remainder cents to the person with the largest subtotal
  first. No cents lost.

### Standalone bills (Phase 3E+)
- Bills can exist without a hangout (`bills.hangout_id` now nullable).
- Standalone bills support GUEST participants (non-users) via
  `bill_guest_participants`. Guests have a name only — no auth, no notifications,
  no cross-bill balance tracking.
- Standalone bills appear in Profile → Bills. Not in any hangout's bill list.
- RLS: only the bill creator and any user participants can see standalone bills.
  Guests don't have accounts, so they can't see anything.

### FAB pattern (Phase 3E+)
- Floating action button bottom-right, above tab bar (z-index above scroll).
- Brand violet `#8B5CF6`, plus icon, 56×56, shadow.
- Tap opens a bottom action sheet (NOT a route push) using native `Modal`
  with `presentationStyle="pageSheet"`.
- Sheet options are an array — easy to extend later.

### Photos / images
- Avatar uploads: JPEG (NOT WEBP), `FileSystem.readAsStringAsync` →
  base64 → `base64-arraybuffer.decode()` → Supabase upload. URL cache
  buster: `?v=Date.now()`.
- Hangout photos: same pipeline. Strip EXIF before upload (privacy).
  Generate thumbnail (200×200 webp) server-side via edge function on
  storage trigger. Store both URLs in DB.
- Storage buckets: `avatars` (public read), `hangout-photos`
  (RLS-gated — only participants).

### Google Places (Phase 2 — established)
- Proxied through Supabase Edge Functions (`places-search`,
  `places-autocomplete`, `places-details`, `places-photo`).
- Secret: `GOOGLE_PLACES_API_KEY`.
- "Places API (New)" must be enabled in Google Cloud (NOT just legacy
  "Places API").
- Default search center: NYC Times Square (40.7580, -73.9855).

### Search results state machine (any picker / search list)
Every search picker must handle five states explicitly:
1. Not searched yet
2. Loading
3. Error
4. Empty
5. Has results

Never let a query stay in "loading" forever after returning empty.

### Custom data (Phase 2 — established)
- `user_custom_activities` and `user_custom_restaurants` are PER-USER
  tables (separate from poll options).

## Common bugs we've already hit (do not regress)
1. WEBP avatar uploads → blank files. Use JPEG.
2. `is_hangout_participant` excluded 'maybe' / 'declined' → users couldn't
   see hangouts they hadn't accepted yet. Include them.
3. Missing GRANTs on public schema after enabling RLS → all queries failed.
4. Vote weight constraint `> 0` → broke "Doesn't vote" (0×) option.
   Constraint is now `>= 0 AND <= 5`.
5. `bottomBar` prop on `<Screen>` does NOT exist.
6. macOS folder-replace on zip extracts deleted whole folders.
7. Recovered `Card` component must support `onPress`.
8. `Badge` must support `variant="brand"`.
9. (3E) OCR misses last line (totals/tax) when receipt is tall — instruct
   user to capture in good light, flat on table.
10. (3E) Tax/tip parsing: receipts vary wildly. Surface as separate editable
    fields; never auto-apply silently. Cash receipts often have NO tip line.
11. (3E) Receipt photos in low light → low OCR accuracy. Show lighting tip.
12. (3E) Currency: USD only in v1. If OCR detects non-$ symbol, warn but allow
    proceeding so user can correct numbers.

## Communication style
- Direct, concise. No preamble.
- Show me file paths before writing. List edits before doing them.
- After each meaningful change, run `npx tsc --noEmit` and report errors.
- Always commit after a working state: `git add . && git commit -m "..."`.
- If a task touches >5 files, plan first, then execute.
- Edge cases matter — enumerate them before coding when stakes are high.
- The user is a first-time mobile dev. Brief tradeoff explanations are
  welcome; lecturing is not.
- Casual tone is fine.
- If genuinely ambiguous, ASK before guessing.
- (3E) Receipt scanning is a delightful feature — explain it briefly in-app.
  Small-print on scan screen: "Snap your receipt and we'll pull out each item.
  You can edit anything before splitting."
- (3E) Show clear progress states: "Reading receipt…" / "Found 8 items" /
  "Couldn't read this one — try retaking or enter items manually."

## Phase 3 sub-phases (in order)
- 3.0 — Foundation: realtime + push notifications + per-hangout chat sub-tab
- 3A — Group messaging (per-hangout chat)
- 3B — Shared photo albums (per-hangout)
- 3D — Bills / expense splitting (complete)
- **3E — Receipt OCR + item-level splitting + standalone bills (active)**
- 3C — Social feed (consumes posts from all the above)

Each sub-phase has its own plan doc in `docs/`. Read the active sub-phase
plan in full before starting.
