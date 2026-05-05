# Hangout Planner — Architecture

**Version:** 1.0 (Phase 0)

This document explains *how* we're building the app: the layers, the boundaries, and the reasoning. If you're going to bring on a co-founder or first hire, this is the document you point them to first.

---

## 1. Tech stack (and why)

| Layer | Choice | Why this, not the alternative |
|------|--------|-------------------------------|
| **Mobile framework** | Expo (managed) + React Native + TypeScript | Expo gives you OTA updates, EAS Build (cloud iOS builds), and a battle-tested toolchain. Native iOS is a better long-term experience but ~3× the build time and locks you out of cross-platform. TypeScript is non-negotiable for a real codebase — it catches half your bugs at compile time. |
| **Navigation** | Expo Router (file-based) | File-based routing matches the mental model you already have from Next.js. The alternative (React Navigation manually) is more flexible but more boilerplate. Expo Router is now the default and is built on React Navigation under the hood, so we get both worlds. |
| **State — server data** | TanStack Query (React Query) | This is the standard. It handles caching, refetching, optimistic updates, and pagination so we don't hand-roll any of it. |
| **State — client UI** | Zustand | Tiny, no boilerplate, no provider wrapping. Redux is overkill for v1. Context is fine for theme but bad for everything else (re-renders the world). |
| **Forms** | React Hook Form + Zod | RHF for performance, Zod for runtime validation. Same Zod schemas validate inputs in the UI *and* before they hit Supabase. |
| **Backend / DB** | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) | Postgres gives us a real relational schema with RLS for permission enforcement. Realtime is built in. Auth is built in. Storage is built in. Edge Functions handle anything we can't express in SQL. We only spin up our own server if we genuinely outgrow this — which won't happen until ~100k users. |
| **Push notifications** | Expo Push (wraps APNs) | One API for all platforms. Apple's APNs directly is fine but more work. |
| **Maps** | Google Maps via `react-native-maps` | You chose Google. We use Google Directions API for ETA. |
| **Places** | Google Places API (via Edge Function proxy — never call directly from client) | Required by Google ToS for billing/quota control and to avoid leaking the API key. |
| **OCR (receipts)** | Google Cloud Vision (via Edge Function) | Best accuracy/$ for printed receipts. Same proxy reasoning. |
| **Error tracking** | Sentry | Crash reports, performance traces, release tracking. Free tier is enough. |
| **Analytics** | PostHog (self-host later if needed) | Event-based, privacy-friendly defaults, feature flags built in. |
| **Secrets** | EAS Secrets + Supabase Vault | Never commit a key. Ever. |
| **Testing** | Jest + React Native Testing Library + Detox (e2e, Phase 5+) | Standard. |
| **CI** | GitHub Actions | Free for public, cheap for private. EAS handles iOS builds. |

## 2. Architectural principles

**P1. Strict layer separation.** The UI knows nothing about Supabase. The data layer knows nothing about React. Business logic (poll tallying, debt simplification) is pure functions with no I/O.

**P2. Server is the source of truth, always.** RLS policies enforce permissions in the database. The client is dumb — if the client tries to do something it shouldn't, the database refuses. We never trust the client.

**P3. Optimistic UI by default.** Mutations update the UI immediately, then reconcile with the server. If the server rejects, we roll back with a toast. This is what makes the app feel fast.

**P4. Realtime only where it matters.** Chat, votes-in-progress, location, notifications. Everything else is cached and refetched on focus. Realtime is expensive and unnecessary for, say, your friend list.

**P5. Pure business logic.** Anything that isn't trivial (vote weight tallying, debt simplification, availability overlap, ETA calculation) lives in `src/lib/` as pure, testable, dependency-free functions. We unit-test these with Jest.

**P6. Feature folders, not type folders.** We organize by feature (`src/features/polls/`) not by type (`src/components/`, `src/screens/`). When you delete a feature, you delete one folder.

**P7. No magic strings.** All Supabase table names, RLS policy names, query keys, and event names are exported constants from a single file per module.

**P8. Deny by default everywhere.** RLS deny-by-default. TypeScript `strict: true`. ESLint `no-explicit-any`. Push notification permission opt-in. Location permission opt-in.

## 3. Folder structure

```
hangout-planner/
├── app/                           # Expo Router file-based routes
│   ├── (auth)/                    # Unauthenticated routes (login, signup)
│   ├── (tabs)/                    # Authenticated tab navigator
│   │   ├── index.tsx              # Home
│   │   ├── friends.tsx            # Social feed
│   │   ├── messages.tsx
│   │   ├── find-time.tsx
│   │   └── profile.tsx
│   ├── hangout/[id]/              # Hangout details (dynamic route)
│   ├── _layout.tsx                # Root layout
│   └── +not-found.tsx
│
├── src/
│   ├── features/                  # Feature folders (P6)
│   │   ├── auth/
│   │   │   ├── components/        # Auth-specific UI
│   │   │   ├── hooks/             # useSignIn, useSignUp, useSession
│   │   │   ├── services/          # auth.service.ts (talks to Supabase)
│   │   │   ├── schemas/           # Zod schemas
│   │   │   ├── types.ts
│   │   │   └── index.ts           # Public API of this feature
│   │   ├── friends/
│   │   ├── hangouts/
│   │   ├── polls/
│   │   ├── food/
│   │   ├── itinerary/
│   │   ├── messaging/
│   │   ├── feed/
│   │   ├── albums/
│   │   ├── bills/
│   │   ├── location/
│   │   ├── findtime/
│   │   └── notifications/
│   │
│   ├── components/                # GENUINELY shared, app-wide UI primitives
│   │   ├── ui/                    # Button, Input, Card, Avatar, etc.
│   │   ├── layout/                # Screen, Container, SafeView
│   │   └── feedback/              # Toast, EmptyState, ErrorBoundary, Skeleton
│   │
│   ├── lib/                       # Pure, dependency-free business logic (P5)
│   │   ├── voting.ts              # Weighted vote tallying
│   │   ├── debt.ts                # Debt simplification algorithm
│   │   ├── availability.ts        # Time overlap calculation
│   │   ├── format.ts              # Date, currency, distance formatters
│   │   └── __tests__/             # Unit tests live next to the code
│   │
│   ├── services/                  # External service clients
│   │   ├── supabase/
│   │   │   ├── client.ts          # The single Supabase client instance
│   │   │   ├── tables.ts          # Const table names
│   │   │   └── types.gen.ts       # Auto-generated from schema
│   │   ├── analytics.ts           # PostHog wrapper
│   │   ├── errors.ts              # Sentry wrapper
│   │   ├── notifications.ts       # Expo Push wrapper
│   │   └── places.ts              # Calls our Edge Function proxy
│   │
│   ├── stores/                    # Zustand stores (client-only state)
│   │   ├── theme.store.ts
│   │   ├── session.store.ts       # Cached session (server is still SoT)
│   │   └── ui.store.ts            # Modals, toasts, etc.
│   │
│   ├── design/                    # Design system
│   │   ├── tokens.ts              # Colors, spacing, radii, shadows
│   │   ├── typography.ts
│   │   ├── theme.ts               # Light + dark theme objects
│   │   └── icons.ts
│   │
│   ├── hooks/                     # GENUINELY shared hooks (not feature-specific)
│   │   ├── useTheme.ts
│   │   ├── useDebounce.ts
│   │   └── useAppState.ts
│   │
│   ├── types/                     # App-wide types
│   │   ├── database.ts            # Re-exports from supabase/types.gen.ts
│   │   └── api.ts
│   │
│   └── config/
│       ├── app.config.ts          # APP_NAME, BUNDLE_ID — single source of truth
│       ├── env.ts                 # Validated env vars (Zod)
│       └── feature-flags.ts
│
├── supabase/                      # Backend infra-as-code
│   ├── migrations/                # SQL migrations (timestamped)
│   ├── functions/                 # Edge Functions (Deno)
│   │   ├── places-search/
│   │   ├── places-details/
│   │   ├── ocr-receipt/
│   │   └── send-notification/
│   ├── seed.sql                   # Local dev seed data
│   └── config.toml
│
├── assets/                        # Images, fonts, icons (committed)
├── docs/                          # All the docs from Phase 0
├── scripts/                       # Dev scripts (codegen, etc.)
├── .github/workflows/             # CI
├── app.config.ts                  # Expo config
├── eas.json                       # EAS Build config
├── tsconfig.json
├── package.json
└── README.md
```

## 4. Data flow (a single request, end to end)

Example: user votes on a poll option.

```
[ Vote button tapped ]
        │
        ▼
[ usePoll.vote() hook ]              ← in src/features/polls/hooks/
        │
        ▼
[ TanStack Query mutation ]
        │
        ├─► Optimistic update (UI shows vote immediately)
        │
        ▼
[ pollsService.castVote() ]          ← in src/features/polls/services/
        │
        ▼
[ supabase.from('votes').insert() ]
        │
        ▼
[ Postgres RLS policy check ]        ← server enforces "user is in this poll"
        │
        ├─► Deny → mutation rolls back, toast shown
        │
        ▼
[ Insert succeeds ]
        │
        ▼
[ Realtime broadcast ]               ← other participants see update
        │
        ▼
[ TanStack Query invalidates poll ]  ← all open poll views refresh
```

The key insight: **the security check is in the database, not the app.** A malicious client cannot bypass it.

## 5. Realtime channels

Realtime subscriptions are expensive (each one is a websocket). We use them only where the value justifies the cost:

| Channel | Subscribed when | Closed when |
|---------|----------------|-------------|
| `hangout:{id}:messages` | User opens chat | User leaves chat screen |
| `hangout:{id}:poll` | User views poll with active voting | Voting closes or user leaves |
| `hangout:{id}:locations` | User views location map | User leaves map or sharing ends |
| `user:{id}:notifications` | App is foregrounded | App is backgrounded (push takes over) |

## 6. Caching strategy

- **TanStack Query** caches all server data with sensible `staleTime` defaults:
  - User profile: 5 min
  - Friends list: 1 min
  - Hangouts list: 30 sec
  - Restaurants from Google Places: NEVER cached client-side beyond the screen lifetime (Google ToS)
- **AsyncStorage** persists only auth tokens (via Supabase client) and theme preference.
- **SecureStore** (Keychain on iOS) holds the refresh token.
- **No long-term offline mode in v1.** App needs network. Phase 5 adds optimistic offline writes for chat/posts.

## 7. Error handling philosophy

Three layers:

1. **Boundary layer** — `ErrorBoundary` component wraps each tab. Fatal renders show a "Something went wrong, try again" screen. Sentry captures the stack.
2. **Mutation layer** — TanStack Query mutations have `onError` handlers that roll back optimistic updates and show a toast.
3. **Validation layer** — Zod validates all inputs *before* they leave the client. The same Zod schema validates them again on the server (Edge Functions).

We never show raw error messages to users. We log the full error to Sentry and show a friendly message ("Couldn't save that. Try again?").

## 8. Performance budget

- **Cold start to login screen:** < 2 seconds on iPhone 12.
- **Tab switch:** < 100 ms.
- **List scrolling:** 60 fps for lists up to 1000 items (FlashList, not FlatList).
- **Image loading:** thumbnails first, full-res on demand.
- **Bundle size:** Hermes engine, no unused dependencies.

## 9. Why we chose Supabase (the longer answer)

You will be tempted to switch backends at some point. Here's why we don't:

- **Postgres is forever.** If we outgrow Supabase's hosted offering, we self-host the same Postgres. Zero rewrite.
- **RLS is the right model for this app.** Permissions are inherently relational ("can this user see this hangout?"). NoSQL would force us to denormalize and check permissions in app code, which is a security disaster waiting to happen.
- **Realtime is built in.** Doing this on Firebase requires Firestore, which is NoSQL — back to the previous problem.
- **One vendor for auth + db + storage + realtime + functions.** Less integration code, less to break.

## 10. Architecture Decision Records

Non-obvious decisions are recorded in `docs/adr/`. The first three:

- **ADR-001:** Use Supabase over Firebase (this section).
- **ADR-002:** Use Expo Router over React Navigation directly.
- **ADR-003:** Proxy all third-party APIs through Edge Functions (never call from client).

We add new ADRs as we make new non-obvious decisions. Format: short, dated, rationale + alternatives considered.
