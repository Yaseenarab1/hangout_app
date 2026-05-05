# Phase 1 — Delivered

This document is your hand-off for Phase 1. It tells you what's in this delivery, how to get it running, and what you should manually test before signing off the Phase 1 checklist.

---

## 1. What's in here

**Project foundation**
- `package.json`, `tsconfig.json` (strict), `babel.config.js`, `metro.config.js`
- `app.config.ts` (Expo) reading from `config/app.config.ts`
- `eas.json` for development / preview / production builds
- ESLint flat config + Prettier
- `.gitignore`, `.env.example`
- Jest configuration

**Design system**
- `src/design/tokens.ts` — full light + dark palettes, spacing, radii, elevations, motion
- `src/design/typography.ts` — 9-step type scale
- `src/design/theme.ts` — composed theme objects
- `src/hooks/useTheme.ts` — theme-aware hook that follows system or user preference

**State**
- `src/stores/theme.store.ts` — persisted theme preference
- `src/stores/session.store.ts` — in-memory session cache
- `src/stores/ui.store.ts` — toasts (callable from anywhere)

**Services**
- `src/services/supabase/client.ts` — singleton client with Keychain refresh tokens
- `src/services/supabase/tables.ts` — typed table names + query keys
- `src/services/supabase/types.gen.ts` — placeholder DB types (regenerate with `pnpm db:types`)
- `src/services/errors.ts` — Sentry init + `friendlyErrorMessage`
- `src/services/analytics.ts` — PostHog wrapper with typed event registry
- `src/services/storage.ts` — image upload pipeline with EXIF stripping

**UI primitives** — `src/components/ui/`
Button, Input, Textarea, Switch, Avatar, Card, Badge, Toast, Skeleton, EmptyState, ListItem, SectionHeader, Header, Spinner, ErrorBoundary

**Layout** — `src/components/layout/`
Screen (the standard wrapper used by every route)

**Pure logic** — `src/lib/`
`format.ts` — relative time, currency, distance, initials, color slots. With tests.

**Features** — `src/features/`
- `auth/` — schemas, service, hooks (sign-in, sign-up, verify, password reset, sign-out, Apple)
- `profile/` — schemas, service, hooks, AvatarUpload component
- `friends/` — schemas, service, hooks, FriendListItem, FriendRequestCard

**Routes** — `app/`
- `(auth)/` — welcome, sign-in, sign-up, verify, forgot-password, create-profile
- `(tabs)/` — home, friends, messages (placeholder), find-time (placeholder), profile
- `users/[id].tsx` — view another user's profile
- `friends/search.tsx`, `friends/requests.tsx`
- `profile/edit.tsx` — modal
- `profile/settings/` — index, notifications, privacy, blocked, account, about
- `+not-found.tsx`

**Backend**
- `db/001_schema.sql` — schema (from Phase 0)
- `db/002_rls_policies.sql` — RLS (from Phase 0)
- `db/003_triggers.sql` — triggers (from Phase 0)
- `db/004_storage_policies.sql` — Storage bucket policies (new)
- `supabase/functions/accept-friend-request/` — Edge Function for friendship acceptance
- `supabase/functions/delete-account/` — Edge Function for soft-delete
- `supabase/tests/rls/phase1.test.sql` — pgTAP test scaffold for Phase 1 tables
- `scripts/copy-migrations.sh` — copies `db/*.sql` to `supabase/migrations/` with timestamps

**Tests**
- `src/lib/__tests__/format.test.ts`
- `src/features/auth/schemas/__tests__/auth-schemas.test.ts`
- `src/features/profile/schemas/__tests__/profile-schemas.test.ts`

---

## 2. Getting it running

> **Prereqs:** Mac, Xcode, Node 20, pnpm, Supabase CLI. See `docs/06-setup-guide.md` for the full walkthrough.

### One-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Environment
cp .env.example .env.local
# Edit .env.local with your Supabase project URL + anon key.
# Sentry DSN and PostHog keys are optional in dev (analytics will log to console).

# 3. Backend
supabase login
supabase link --project-ref <your-project-ref>

# Copy db SQL into the migrations folder with timestamped names
./scripts/copy-migrations.sh

# Apply schema, RLS, triggers, storage policies
supabase db push

# Create the Storage buckets in the Supabase dashboard:
#   - avatars         (public)
#   - post-images     (private)
#   - album-photos    (private)
#   - receipts        (private)
# (We can't create buckets via SQL; the dashboard or CLI is required.)

# Deploy Edge Functions
supabase functions deploy accept-friend-request
supabase functions deploy delete-account

# Generate types from your live schema (replaces the placeholder)
SUPABASE_PROJECT_ID=<your-project-ref> pnpm db:types
```

### Run

```bash
pnpm start
# press 'i' for iOS simulator
```

For Apple Sign-In, you'll need a development build (it doesn't work in Expo Go):

```bash
pnpm build:dev
# follow the EAS prompts; takes ~10 min the first time
```

---

## 3. What to manually test

Walk through these flows on a real device (or simulator for everything except Apple Sign-In and push). Tick them off in `docs/09-phase-1-checklist.md` as you go.

### A. Onboarding

1. Open the app fresh. Welcome screen appears.
2. Tap "Continue with email" → sign-up form.
3. Enter an email + strong password + confirm + age toggle.
4. Submit → "Check your email" screen.
5. Get the code from your email. Enter it. → Lands on Create Profile.
6. Pick an avatar from the photo library. Type display name + username (watch the "Available" check). Add a bio.
7. Continue → Home tab.

### B. Theme

1. Profile tab → Settings → Appearance → cycle System / Light / Dark.
2. Force iOS dark mode in Control Center while in System mode — colors should swap.

### C. Friends

1. Friends tab → tap the search icon (top right).
2. Search for another test user. Tap "Add" → "Pending" appears.
3. From the other account, accept the request.
4. Your friends list shows the new friend.
5. Tap the friend → their profile → "Remove friend" works.
6. Block a user from their profile. Confirm they no longer appear in search.
7. Settings → Blocked users → unblock.

### D. Profile editing

1. Profile tab → Edit profile (modal).
2. Change display name + bio. Save. Toast appears.
3. Reopen — changes persisted.
4. Change avatar — uploads, replaces immediately.

### E. Settings

1. Notifications → toggle a few. Reopen — persisted (optimistic + server confirmed).
2. Privacy → switch defaults. Reopen — persisted.
3. Account → Reset password → email arrives.
4. Account → Delete account → type DELETE → confirm → signed out, profile flagged deleted.

### F. Auth edge cases

1. Sign in with wrong password → friendly toast.
2. Try to sign up with an already-used email → friendly toast.
3. Force-quit during sign-up → reopen, lands appropriately based on session state.

### G. RLS sanity check

Run `pnpm db:test` to verify RLS policies actually deny unauthorized access. All 8 Phase 1 tests must pass.

---

## 4. What's NOT in Phase 1 (intentionally)

- Hangouts, polls, food planning — Phase 2
- Group chat, social feed, photo albums — Phase 3
- Bills, location sharing, Find Time — Phase 4
- Push notifications wiring — Phase 5 (the preferences UI is here, but registering an Expo Push token is Phase 5)
- Accessibility hardening pass — Phase 5
- App icon and splash screen final art — Phase 6
- TestFlight / App Store submission — Phase 6

---

## 5. Known TODOs in the code

Search for `TODO` or `Phase 2+` comments. The notable ones:

- `src/services/supabase/types.gen.ts` is a placeholder for Phase 1 tables only. Run `pnpm db:types` after applying migrations to regenerate the full set.
- Storage policies for `post-images`, `album-photos`, `receipts` are owner-only placeholders. Phase 3/4 will replace them with hangout-aware policies.
- The `delete-account` cron job (hard-delete after 7-day grace) is Phase 5.
- The "set new password" deep link from password reset is Phase 5 polish.

---

## 6. Phase 1 → Phase 2 handoff

When you reply **"ready for Phase 2"**, I deliver:

- Hangouts feature (create, view, edit, cancel, participants)
- Polls (activity + cuisine + restaurant) with simple-vote and suggest-then-vote modes
- Weighted voting with per-participant weight
- Plan a Day (multi-stop itinerary)
- Google Places integration (cuisine → restaurants) via Edge Function proxy
- Hangout detail screen with overview tab
- All the schemas, services, hooks, screens, and tests for Phase 2

Approximate size: 50–70 new files.

---

**Have fun shipping.**
