# Hangout Planner — Security & Privacy Model

**Version:** 1.0 (Phase 0)

This document is **the** security reference. Every engineer who touches this codebase must read it. Every code review checks against it.

---

## 1. Threat model

### Adversaries we defend against

| Adversary | Capability | Defense |
|-----------|------------|---------|
| **Curious user** | Has a valid account, tries to see data they shouldn't | RLS — server refuses |
| **Malicious user** | Crafts API requests, decompiles app | RLS + Edge Function validation; no client trust |
| **Stolen device** | Has physical access to a logged-in phone | Biometric re-auth for sensitive actions; Keychain refresh tokens |
| **Network attacker (MITM)** | Sees/modifies traffic | TLS 1.2+ everywhere; cert pinning in Phase 5 |
| **Compromised third-party (Google, Supabase)** | Service breach | Minimize data sent; no PII in logs; encrypt at rest |
| **Malicious developer (us, in the future)** | Inserts code that exfiltrates | Code review, ADRs, audit logs on prod |

### Adversaries we explicitly do NOT defend against in v1

- **State-level adversary with full network and endpoint capability.** We're a friend-planning app, not Signal.
- **Server-side compromise of Supabase that grants raw DB access.** Supabase's own controls are our compensating control. (We will encrypt sensitive fields client-side in v2, when we add E2E messaging.)

## 2. Authentication

- **Provider:** Supabase Auth.
- **Methods:** Apple Sign-In + Email/Password. Apple-required if any social offered.
- **Password requirements:** min 10 chars, must include 1 letter and 1 number, breached-password check via `pwned-passwords` API in Edge Function before signup.
- **Email verification:** required before user can post publicly, send friend requests, or share location.
- **Session tokens:** Supabase JWT. Refresh tokens stored in iOS **Keychain** via `expo-secure-store`.
- **Session expiry:** access token 1 hr, refresh token 30 days.
- **Logout:** clears `expo-secure-store`, AsyncStorage, and revokes refresh token on server.
- **Account recovery:** email reset link, 1-hour expiry, single-use.
- **Brute force protection:** Supabase Auth has rate limits; we add an Edge Function in front of sensitive paths (delete account, change password) with stricter limits.

## 3. Authorization (RLS — the core of our model)

**The principle:** the database knows who can see what. The app does not.

- Every table has RLS enabled (`002_rls_policies.sql`).
- Every policy is `to authenticated`. We do not allow anonymous reads (no `to anon` policies in v1).
- Every policy is **deny by default** — we only grant access where a positive predicate matches.
- Helper functions (`is_hangout_participant`, `is_hangout_host`, `are_friends`) keep policies readable and centralize the logic.
- Service-role operations (sending notifications, running cron jobs) happen exclusively in Edge Functions with the service-role key. The service key is **never** in the mobile app bundle.

### What this prevents
- A malicious client cannot read another user's messages even with the user's auth token.
- A malicious client cannot insert a vote on a poll they're not invited to.
- A malicious client cannot read a private post even by guessing the post ID.

### What this does NOT prevent
- A user posting a photo of someone else without consent. (Social problem; we have report + block.)
- A user screenshotting and re-sharing. (No platform stops this.)

## 4. Data classification

| Class | Examples | Handling |
|-------|----------|----------|
| **Public** | Username, display name, avatar, public bio | Visible to any authenticated user |
| **Friend-visible** | Default posts, default availability | Visible per RLS predicates |
| **Group-visible** | Hangout details, chat, album, bills | Visible only to participants |
| **Self-only** | Email, push token, blocked list, private availability | Only the user themselves |
| **Sensitive** | Location pings, payment metadata | Self-only + group-visible while sharing; deleted aggressively |
| **Secret** | Auth tokens, API keys | Never logged, never sent to clients except their own session |

## 5. Secrets management

| Secret | Where it lives | NEVER |
|--------|---------------|-------|
| Supabase URL + anon key | Mobile app bundle (these are designed to be public when paired with RLS) | — |
| Supabase service-role key | EAS Secrets + Supabase Vault | In the mobile app, in Git, in logs |
| Google Places API key | Edge Function env var | In the mobile app — proxy via Edge Function |
| Google Cloud Vision key | Edge Function env var | In the mobile app |
| Apple App-specific shared secret | EAS Secrets | In Git |
| Sentry DSN | Mobile app bundle (designed-public) | — |
| PostHog project key | Mobile app bundle (designed-public) | — |

**Rule:** before any commit, run `git secrets --scan` (configured pre-commit hook). Real secrets blocked.

## 6. Storage security

Supabase Storage buckets:

| Bucket | Visibility | RLS |
|--------|-----------|-----|
| `avatars` | Public-read | Owner-only write/delete |
| `post-images` | Auth-required-read with object policy mirroring posts RLS | Author-only write |
| `album-photos` | Auth-required-read; participants only | Participant-only write |
| `receipts` | Auth-required-read; bill participants only | Bill creator write |

Image upload pipeline:
1. Client requests a signed upload URL via Edge Function (validates user can upload to that path).
2. Client uploads directly to Storage.
3. Edge Function trigger: strip EXIF metadata (especially GPS), generate thumbnail, mark as ready.
4. Original is overwritten by the EXIF-stripped version. No GPS leaks via shared photos.

## 7. Input validation

**Two-layer validation:**

1. **Client (Zod schemas in `src/features/*/schemas/`)** — for UX. Rejects bad input before it leaves the device.
2. **Server (same Zod schemas in Edge Functions; Postgres CHECK constraints)** — for security. Rejects bad input even if a malicious client bypasses (1).

Examples we always validate:
- String length bounds (CHECK constraints in DB)
- Email format (Zod + Postgres regex on auth.users)
- Username format (regex `^[a-zA-Z0-9_]{3,30}$`)
- Currency amounts (BIGINT cents, not floats)
- Time ranges (CHECK `end > start`)
- Geo coordinates (PostGIS `geography` type)

## 8. PII and privacy

### Data we collect

| Field | Why | Retention |
|-------|-----|-----------|
| Email | Auth, recovery | Lifetime of account |
| Display name, username, bio, avatar | Profile | Lifetime |
| Push token | Notifications | Updated on app open; cleared on opt-out |
| Friends list | App function | Lifetime |
| Hangouts, posts, messages, photos | App content | Lifetime + 30 days post-deletion |
| Location pings | Live sharing only | Wiped within 24 hours of session end |
| Receipt OCR data | Bill creation | Same as bill (deleted with hangout) |
| Analytics events | Product improvement | 90 days |
| Crash reports | Stability | 90 days |

### Data we do NOT collect (deliberate)

- Phone number (in v1)
- Address book / contacts (we offer username search instead)
- Background location when not sharing
- Microphone, calendar (system), photo library outside chosen photos
- Browsing/usage outside the app

### User rights (GDPR/CCPA)

- **Access (Art. 15):** in-app data export from S19, delivers JSON of all user-owned rows.
- **Rectification (Art. 16):** profile editing.
- **Erasure (Art. 17):** account deletion with 7-day grace, then full cascade.
- **Portability (Art. 20):** the export is machine-readable JSON.
- **Object (Art. 21):** opt out of analytics in S15.
- **Children:** age gate at signup; under-18 messaging is on the roadmap but v1 is 18+ only per ToS.

## 9. Location privacy (specific care)

Location is the most sensitive data this app handles. Specific rules:

- **Foreground-only by default.** Background updates require a separate, second-tier permission with clear in-app explainer.
- **Time-bounded.** Every session has an expires_at; 8-hour hard cap.
- **No history.** Only the most recent ping is stored (`location_pings` PK is `session_id`). When session ends, ping is deleted.
- **Visible-while-active.** A persistent banner shows that sharing is on. Cannot be dismissed.
- **Apple privacy manifest.** Location usage is declared in `PrivacyInfo.xcprivacy` with reason `7D9E.1` (Friend connection — apps that allow you to communicate with friends and family).

## 10. Photo privacy

- **EXIF stripped on upload.** GPS metadata never leaves the user's device — or rather, never leaves Storage; the strip happens server-side in Edge Function trigger.
- **No facial recognition.** We do not run any analysis on photos. Captions and tags are user-typed.
- **Hangout albums are participant-only.** RLS enforces this. Even URL-guessing won't bypass it.

## 11. Messaging

- **Server-readable in v1.** End-to-end encryption is a v2 feature (R7 in risk register).
- **Soft delete after 5 minutes.** Users can retract for typos. After 5 minutes, deletes are soft (shows "[Message deleted]").
- **No metadata leaks via push.** Push notification payload contains only `hangout_id` and a generic title — body fetched fresh after tap.

## 12. Audit logging

In Phase 5 we add audit logging for:
- Account deletion
- Permission changes (host promoting co-host)
- Bill mutations
- Block / unblock

Audit logs go to a separate `audit_log` table with append-only RLS (no updates, no deletes from app).

## 13. Dependency security

- **Dependabot** enabled on the GitHub repo (auto-PRs for security updates).
- **`npm audit`** in CI; fails on high+ CVEs.
- **License check** in CI: only MIT/Apache-2.0/BSD allowed; GPL/AGPL blocked (license incompatibility for App Store closed-source).
- **No native modules with known telemetry** (we audit each `expo-*` and `react-native-*` package's privacy practices).

## 14. App Store privacy declarations

For App Store Connect's Privacy Questionnaire, here are the answers we'll give (subject to update before submission):

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|-----------|-----------|-----------------|---------------------|---------|
| Contact info — Email | Yes | Yes | No | App functionality, account |
| User content — Photos | Yes | Yes | No | App functionality |
| User content — Other (messages, posts) | Yes | Yes | No | App functionality |
| Identifiers — User ID | Yes | Yes | No | App functionality |
| Usage data — Product interaction | Yes | Yes | No | Analytics |
| Diagnostics — Crash data | Yes | No | No | App functionality |
| Location — Precise location | Yes | Yes | No | App functionality (only when user shares) |

Tracking: **No** (we do not link identifiers to third-party data for advertising).

## 15. Incident response

If a data breach is suspected:

1. **Immediate:** Rotate the Supabase service-role key. Pause Edge Functions if needed.
2. **Within 1 hour:** Identify scope — which tables, which users.
3. **Within 24 hours:** Assess severity. Engage legal if PII compromised.
4. **Within 72 hours (GDPR Art. 33):** Notify supervisory authority if required.
5. **Communication:** Plain-language email to affected users with what happened, what we did, what they should do.

We will set up a `security@hangoutplanner.app` mailbox before launch for vulnerability reports.

## 16. Code review checklist (security)

For every PR:

- [ ] Are new tables RLS-enabled with explicit policies?
- [ ] Are new Edge Function inputs Zod-validated server-side?
- [ ] Does any user-generated string get rendered into HTML/SQL/etc. without escaping?
- [ ] Does this PR add a third-party dependency? License + recent activity check done?
- [ ] Does this PR introduce any client-side check that's not also enforced server-side? (If yes, stop.)
- [ ] Are any new env vars secrets? If yes, are they in EAS Secrets, not code?
- [ ] Is any PII added to Sentry/PostHog event payloads? If yes, redact.
