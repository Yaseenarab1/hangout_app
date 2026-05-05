# Hangout Planner — Phase 1 Checklist

**Version:** 1.0 (Phase 0)
**Status:** Definition of done for Phase 1 — locked.

Phase 1 is **complete** when every box below is checked. We do not move to Phase 2 until then.

The point of this list: in solo development, "done" drifts. This is the contract you make with yourself. If you find yourself wanting to call Phase 1 done while a box is unchecked, either check it honestly or push the deadline — never both.

---

## A. Project foundation

- [ ] **A1.** GitHub repo `hangout-planner` exists, private, `main` branch protected.
- [ ] **A2.** `package.json` with locked dependency versions (no `^` for runtime deps where possible).
- [ ] **A3.** `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`.
- [ ] **A4.** ESLint + Prettier configured, runs in CI.
- [ ] **A5.** Husky pre-commit hook runs `lint`, `typecheck`, and `test --changed`.
- [ ] **A6.** GitHub Actions: `.github/workflows/ci.yml` runs lint + typecheck + tests on PR.
- [ ] **A7.** `git secrets` configured; `.gitignore` excludes `.env*`, `*.p8`, `*.pem`, `secrets/`.
- [ ] **A8.** EAS configured (`eas.json`) for `development`, `preview`, `production` profiles.
- [ ] **A9.** `app.config.ts` (Expo) reads from `config/app.config.ts` for name/bundle/scheme.
- [ ] **A10.** README with setup, scripts, and link to docs.

## B. Backend

- [ ] **B1.** Supabase project `hangout-planner-dev` provisioned.
- [ ] **B2.** Migrations applied: `001_schema.sql`, `002_rls_policies.sql`, `003_triggers.sql`.
- [ ] **B3.** Storage buckets created: `avatars` (public), `post-images`, `album-photos`, `receipts` (private).
- [ ] **B4.** Storage RLS policies in place for each bucket.
- [ ] **B5.** Schema types auto-generated to `src/services/supabase/types.gen.ts`.
- [ ] **B6.** `pnpm db:types` script regenerates types after migrations.
- [ ] **B7.** RLS test suite scaffolded in `supabase/tests/rls/` with at least one test per Phase-1 table (profiles, friendships, friend_requests, blocks, notification_preferences).

## C. Design system

- [ ] **C1.** Tokens file `src/design/tokens.ts` with full light + dark palettes per `03-design-system.md`.
- [ ] **C2.** `useTheme()` hook + `ThemeProvider` switches palettes based on system + user override.
- [ ] **C3.** Theme override persists in AsyncStorage (`light` / `dark` / `system`).
- [ ] **C4.** Typography scale exported, all type styles defined.
- [ ] **C5.** All Phase-1 UI primitives implemented (`src/components/ui/`):
  - [ ] Button (4 variants × 3 sizes)
  - [ ] Input
  - [ ] Textarea
  - [ ] Switch
  - [ ] Avatar
  - [ ] Card
  - [ ] Badge
  - [ ] Toast
  - [ ] Skeleton
  - [ ] EmptyState
  - [ ] ListItem
  - [ ] SectionHeader
  - [ ] Header (top nav)
  - [ ] Sheet (bottom sheet)
  - [ ] Spinner
  - [ ] ErrorBoundary
- [ ] **C6.** Each primitive has a unit test.
- [ ] **C7.** All hit areas ≥ 44×44 verified.
- [ ] **C8.** Reduce Motion respected on all transitions.

## D. Authentication (F1)

- [ ] **D1.** Welcome screen S02.
- [ ] **D2.** Sign in with email + password — full validation.
- [ ] **D3.** Sign up with email + password + age confirmation; pwned-password check via Edge Function.
- [ ] **D4.** Sign in with Apple working end-to-end (requires real device, not Expo Go).
- [ ] **D5.** Email verification flow S05.
- [ ] **D6.** Password reset via email.
- [ ] **D7.** Session refresh handled silently; expired sessions redirect to S03 with intended destination preserved.
- [ ] **D8.** Refresh token in iOS Keychain via `expo-secure-store`.
- [ ] **D9.** Logout clears session + AsyncStorage + secure store.
- [ ] **D10.** Auth Zod schemas validate client-side and re-validate in Edge Functions.
- [ ] **D11.** Manual test: sign up → verify → sign out → sign in → password reset → sign in.

## E. Profile (part of F1)

- [ ] **E1.** Create Profile S06 — display name, username (with availability check), avatar upload, bio.
- [ ] **E2.** Username uniqueness checked via debounced query; clear error if taken.
- [ ] **E3.** Avatar upload pipeline: pick from photo library → resize to 512×512 → strip EXIF → upload to `avatars` bucket.
- [ ] **E4.** My profile screen S12 shows display name, username, bio, avatar, friend count, hangout count.
- [ ] **E5.** Edit profile sheet S13 with optimistic update + rollback on error.
- [ ] **E6.** User profile S11 viewable by any authenticated user.
- [ ] **E7.** Settings tree:
  - [ ] S14 Settings (links to subscreens)
  - [ ] S15 Notification preferences (all toggles per `notification_kind`)
  - [ ] S16 Privacy settings (default post visibility, default calendar visibility)
  - [ ] S17 Blocked users list with unblock action
  - [ ] S18 About (version, ToS link, Privacy link, OSS licenses)
  - [ ] S19 Account (change email, change password, delete account with 7-day grace)

## F. Friends (F2)

- [ ] **F1.** Friends list S08 — shows accepted friends with online dot.
- [ ] **F2.** Search S09 — debounced search over `username` + `display_name` (uses `pg_trgm` index).
- [ ] **F3.** Send friend request from any user profile.
- [ ] **F4.** Friend Requests S10 — incoming + outgoing tabs.
- [ ] **F5.** Accept request → friendship created via Edge Function (RLS denies direct insert) → both users notified.
- [ ] **F6.** Decline request.
- [ ] **F7.** Cancel sent request.
- [ ] **F8.** Remove friend (with confirmation).
- [ ] **F9.** Block user from their profile.
- [ ] **F10.** Blocked users invisible in search.
- [ ] **F11.** RLS-enforced: a blocked user attempting to send a request gets a 403-equivalent.

## G. App shell

- [ ] **G1.** 5-tab bottom navigation per `04-screens-and-flows.md` §2.
- [ ] **G2.** Tab badges for unread feed, unread messages, pending invites.
- [ ] **G3.** Home S07 with 3 hero tiles ("Find What To Do", "Plan Food", "Plan a Day") — disabled in Phase 1, enabled in Phase 2.
- [ ] **G4.** Recent hangouts list on S07 (empty state for new users).
- [ ] **G5.** Deep linking handler: `hangoutplanner://` + universal link from `hangoutplanner.app` (route patterns in `04-screens-and-flows.md` §4).
- [ ] **G6.** Splash → auth check → Welcome or Home routing.

## H. State, data layer, services

- [ ] **H1.** Supabase client singleton in `src/services/supabase/client.ts`.
- [ ] **H2.** TanStack Query wired with default `staleTime` per `02-architecture.md` §6.
- [ ] **H3.** Zustand stores for `theme`, `session`, `ui` (toasts/modals).
- [ ] **H4.** Sentry initialized; breadcrumbs include screen name.
- [ ] **H5.** PostHog initialized; events fired for: `signup_completed`, `friend_added`, `profile_completed`.
- [ ] **H6.** Error boundary at root + per-tab.
- [ ] **H7.** Toast system reachable from any component.
- [ ] **H8.** All mutations have optimistic update + rollback on error.

## I. Tests

- [ ] **I1.** Unit tests for any business logic in `src/lib/` (Phase 1 has minimal — just `format.ts`).
- [ ] **I2.** RLS tests covering: a non-friend cannot read another's profile when blocked; a non-recipient cannot accept a friend request; a non-self cannot edit a profile.
- [ ] **I3.** Component tests (RNTL) for Button, Input, Avatar, ListItem.
- [ ] **I4.** Integration test (Detox or manual): sign up flow end-to-end.
- [ ] **I5.** Coverage: core auth + friends paths.

## J. Performance

- [ ] **J1.** Cold start to Welcome < 2s on iPhone 12.
- [ ] **J2.** Tab switch < 100ms.
- [ ] **J3.** Friends list scrolls 60fps with 200 mocked friends.
- [ ] **J4.** Hermes enabled.
- [ ] **J5.** No console warnings/errors in release build.

## K. Accessibility

- [ ] **K1.** All interactive elements have `accessibilityLabel`.
- [ ] **K2.** All icons in buttons have `accessibilityHint` or text alternative.
- [ ] **K3.** Form errors announced via `accessibilityLiveRegion`.
- [ ] **K4.** Dynamic Type tested up to xxxLarge.
- [ ] **K5.** VoiceOver pass-through: full sign-up + add-a-friend flow tested with VoiceOver on.
- [ ] **K6.** Color contrast lint passes for all token pairings.

## L. Delivery

- [ ] **L1.** EAS Internal build runs on simulator and physical device.
- [ ] **L2.** App icon and splash screen designed (placeholder OK in Phase 1; real before Phase 6).
- [ ] **L3.** Privacy manifest (`PrivacyInfo.xcprivacy`) declares all data collection accurately for Phase 1 features.
- [ ] **L4.** First demo build pushed to a private TestFlight (optional in Phase 1; required by Phase 2).

## M. Documentation

- [ ] **M1.** README updated for current state.
- [ ] **M2.** Any new ADRs added to `docs/adr/`.
- [ ] **M3.** This checklist signed off (you can write your initials and a date at the bottom).

---

## Sign-off

I have personally tested every flow in this checklist on a physical iPhone running the latest iOS, and confirm Phase 1 is shippable.

```
Signed: ___________________
Date:   ___________________
```
