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
- Expo Push (later phases), Sentry, PostHog
- npm (not pnpm)
- Brand color: `#8B5CF6` (violet)

## Conventions
- Feature-folder structure under `src/features/<feature>/`
  - `components/`, `hooks/`, `services/`, `schemas/`, `types.ts`, `index.ts`
- Routes live in `app/` (expo-router file-based routing)
- UI primitives live in `src/components/ui/` (Avatar, Card, Badge, Button,
  Input, Textarea, Switch, Skeleton, EmptyState, ListItem, SectionHeader,
  Header, Spinner, Toast, ErrorBoundary, SummaryRow, SelectionReviewSheet)
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
- Vote/unvote/rank actions MUST be optimistic. UI flips immediately,
  reverts on error, with toast.
- Pattern: `onMutate` → save prev, set new state. `onError` → restore prev.
  `onSettled` → invalidate to reconcile.

### Voting
- Two methods: `simple` (one tap) and `ranked` (instant runoff).
- Per-user sort: each viewer sees their own picks at top.
  - Simple: voted option floats to top with "YOUR PICK" badge.
  - Ranked: ranked options first in rank order, unranked below.
- Vote weights per participant: 0× / 0.5× / 1× / 2× / 3× — host-set only.
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

### Google Places (for restaurant + activity venue search)
- Proxied through Supabase Edge Functions (`places-search`,
  `places-autocomplete`, `places-details`) — never call Google directly
  from the client.
- Secret: `GOOGLE_PLACES_API_KEY` (already set in Supabase).
- "Places API (New)" must be enabled in Google Cloud (NOT just legacy
  "Places API"). This was a real bug — keep it enabled.
- Default search center: NYC Times Square (40.7580, -73.9855). Houston is
  the dev's actual location but tests use NYC.

### Search results state machine (for any picker)
Every search picker must handle five states explicitly:
1. Not searched yet → "Type or pick a filter to start"
2. Loading → spinner
3. Error → "Search failed, try again"
4. Empty → "No matches. Try widening filters."
5. Has results → list

Never let a query stay in "loading" forever after returning empty.

### Image uploads (avatars)
- Use `FileSystem.readAsStringAsync` → base64 → `base64-arraybuffer.decode()` → Supabase upload.
- Output JPEG, NOT WEBP (WEBP produces blank files).
- URL cache buster: `?v=Date.now()`.

### Custom data
- `user_custom_activities` and `user_custom_restaurants` are PER-USER tables
  (separate from poll options). They're the user's "saved" list across
  hangouts.

## Common bugs we've already hit (do not regress)
1. WEBP avatar uploads → blank files. Use JPEG.
2. `is_hangout_participant` excluded 'maybe' / 'declined' → users couldn't
   see hangouts they hadn't accepted yet. Include them.
3. Missing GRANTs on public schema after enabling RLS → all queries failed.
   Always GRANT to authenticated/anon as needed.
4. Vote weight constraint `> 0` → broke "Doesn't vote" (0×) option.
   Constraint is now `>= 0 AND <= 5`.
5. `bottomBar` prop on `<Screen>` does NOT exist — putting a button there
   silently drops it. Use a `<View>` at the bottom of a flex container.
6. macOS folder-replace on zip extracts deleted whole folders. Always
   merge, never replace folders.
7. Recovered `Card` component must support `onPress` — used as Pressable
   in HangoutCard etc.
8. `Badge` must support `variant="brand"` — used for "Planning" status.

## Communication style
- Direct, concise. No preamble.
- Show me the file paths before writing. List edits before doing them.
- After each meaningful change, run typecheck and report errors.
- Always commit after a working state: `git add . && git commit -m "..."`.
- If a task touches >5 files, plan first, then execute.
- Edge cases matter — enumerate them before coding when stakes are high.
