# Hangout Planner — Risk Register

**Version:** 1.0 (Phase 0)

A living document. We update this throughout the project. Each risk has a probability (Low/Med/High), impact (Low/Med/High), and a mitigation plan.

---

## R1 — App Store rejection on first submission

**Probability:** High (it's normal — most apps get rejected once)
**Impact:** Medium (delays launch by 1–2 weeks)

**Why:** Apple is strict about social apps, location justification, and content moderation.

**Mitigation:**
- Build per Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) from day one (referenced in Phase 6 checklist).
- Required from launch (per guideline 1.2 Social):
  - Method to flag/report objectionable content (we have `reports` table).
  - Mechanism to block abusive users (we have `blocks` table).
  - Published process to respond to reports within 24 hours.
  - Terms of Use that prohibit objectionable content.
- Privacy manifest (`PrivacyInfo.xcprivacy`) declares all data collection precisely.
- Sign in with Apple offered (required since we have Apple Sign-In).
- Justify location use in plain English in `NSLocationWhenInUseUsageDescription`: "Hangout Planner uses your location only when you choose to share it with friends in a hangout."
- Test on a TestFlight build for 1–2 weeks before App Store submission.

---

## R2 — Google Places Terms of Service violation

**Probability:** Medium
**Impact:** High (could lose the food feature entirely)

**What's restricted:**
- Cannot cache restaurant data > 30 days client-side.
- Must display "Powered by Google" attribution where Places data is shown.
- Cannot mix Places data with data from competing services on same screen.
- Cannot use Places data to build a competing maps service.

**Mitigation:**
- All Places data fetched fresh per-screen via Edge Function proxy.
- Required Google attribution rendered on every screen showing Places data.
- Edge Function logs requests for ToS audit if challenged.
- Lawyer review before launch.

---

## R3 — Apple rejects "Sign in with Apple" implementation

**Probability:** Low
**Impact:** Medium

Apple specifically tests this and rejects sloppy implementations.

**Mitigation:**
- Use `expo-apple-authentication` exactly as documented.
- Apple button is at least as prominent as Email button.
- Apple sign-in works without requiring email verification (Apple already verified).
- Test that "Hide my email" relay addresses work end-to-end.

---

## R4 — Receipt OCR accuracy below user expectations

**Probability:** High
**Impact:** Medium (feature feels broken; users abandon)

OCR on real-world receipts is ~85% per-line. Users expect ~99%.

**Mitigation:**
- Design the OCR review screen (S41) as a first-class editing flow, not a confirmation page.
- Pre-emptively show "Verify each line — OCR isn't perfect" copy.
- Track per-user OCR-edit rate; if >30%, the OCR isn't doing more than make work.
- A/B test in Phase 4: OCR + review vs. straight manual entry. Whichever gets more bills logged, win.

---

## R5 — Push notification opt-in rate too low

**Probability:** High (industry average is ~50% on iOS)
**Impact:** Medium (without push, retention drops sharply)

**Mitigation:**
- Don't ask for push at app launch. Ask in context — first time it would matter (e.g., "Get notified when your friends vote").
- Use a soft-prompt screen explaining the value before the iOS prompt.
- After denial, show a banner explaining how to re-enable in Settings.
- Track opt-in rate; iterate copy until ≥65%.

---

## R6 — User upload of objectionable content

**Probability:** High at scale
**Impact:** Critical (bans, App Store removal, brand damage)

**Mitigation:**
- `reports` table + reviewable queue in admin tool (Phase 5).
- 24-hour SLA on reports — published in ToS.
- Auto-blur + warn for any image flagged ≥3 times pending review.
- Consider Cloudflare's image moderation API for known CSAM/violence (Phase 5).
- ToS prohibits content; violations result in account ban.
- Per Apple guideline 1.2, we publish how to report and how we act.

---

## R7 — Messages stored unencrypted on the server

**Probability:** Medium (it is, by design, in v1)
**Impact:** High if breached

**Why we accepted:** E2E messaging is a 6-week project on its own (key management, group keys, multi-device, key recovery). It does not block v1.

**Mitigation v1:**
- TLS in transit. AES-256 encryption at rest (Supabase default).
- Soft-delete after 5 minutes for retraction.
- Privacy Policy explicitly states: "Messages are not end-to-end encrypted in this version."
- Plan v2 implementation using Signal Protocol or libsignal.

---

## R8 — Background location drains battery / gets denied permission

**Probability:** Medium
**Impact:** Medium (location feature unusable for some users)

**Mitigation:**
- Default mode is **foreground-only.** Background is opt-in second tier.
- Update interval: 30s foreground, 2min background. Don't poll faster than needed.
- Auto-stop at expires_at, respect screen-off.
- If battery <15%, app pauses location updates and notifies user.

---

## R9 — Supabase outage takes the whole app down

**Probability:** Low (Supabase has 99.9% SLA on Pro+)
**Impact:** High (app does not function)

**Mitigation:**
- Status page subscription for Supabase incidents.
- Graceful degradation: if API is down, show cached data + "Reconnecting..." banner.
- Critical actions (sign up, log in) have a clear "service unavailable" message, not silent failure.
- For v2: explore PostgreSQL self-hosting on Fly.io as a fallback.

---

## R10 — Apple changes RN/Expo policies and breaks builds

**Probability:** Medium
**Impact:** Variable

History: Apple has tightened privacy manifest requirements multiple times in the last 2 years.

**Mitigation:**
- Subscribe to Expo's changelog and Apple Developer News.
- Pin Expo SDK version in `package.json`; upgrade deliberately, not automatically.
- Test on iOS Beta (developer.apple.com) before public iOS releases ship.

---

## R11 — User account takeover via password reset

**Probability:** Low
**Impact:** Critical

**Mitigation:**
- Password reset links are single-use, 1-hour expiry.
- Reset emails warn about phishing.
- Account-level recovery requires email + (in v2) phone verification.
- Detect suspicious sign-ins (new device + new IP) → require email confirmation.

---

## R12 — RLS policy bug exposes data

**Probability:** Medium (this is the most likely class of security bug in our model)
**Impact:** Critical

**Mitigation:**
- Every table has a corresponding test in `supabase/tests/rls/` that verifies expected access patterns.
- Tests run in CI on every PR.
- Code review checklist explicitly requires RLS test coverage.
- Penetration test before public launch (Phase 6).

---

## R13 — User shares hangout link with non-invited friends

**Probability:** Medium (it's a feature, not a bug, in some flows)
**Impact:** Low — unless private content is exposed

**Mitigation:**
- Hangout invite tokens are single-use and require sign-in.
- "Public itinerary share" has its own flow that strips private fields (no chat, no bills, no album).
- Photos and bills always require accepted-participant status.

---

## R14 — Edge Function cold-start latency

**Probability:** Medium
**Impact:** Low (UX feels slow for first request)

Supabase Edge Functions can have ~500ms cold start.

**Mitigation:**
- Heavy operations (OCR, search) tolerate 500ms.
- Light operations stay in Postgres functions (no cold start).
- For Phase 5: warming pings every 5 min on critical functions.

---

## R15 — Founder burnout / scope creep

**Probability:** High (every solo founder)
**Impact:** Critical

**Mitigation:**
- Phase plan is locked. New features go in a backlog, not the current phase.
- Cut features rather than slip dates.
- Maintain a "won't build in v1" list (in PRD §7) and refer to it when tempted.
- Ship Phase 1 to TestFlight even if rough — momentum > polish in early stages.

---

## R16 — Legal / compliance gaps

**Probability:** Medium
**Impact:** High

Missing items as of Phase 0:
- Terms of Service
- Privacy Policy
- Cookie Policy (web only — N/A v1)
- Data Processing Agreement template (for any future B2B)
- COPPA compliance if minors slip in (we age-gate at 18+ in v1)

**Mitigation:**
- Use boilerplate (e.g., Termly, iubenda) until launch.
- Lawyer review before TestFlight goes public-public, not internal beta.
- Budget $1,500–3,000 for legal review.

---

## R17 — Photo storage costs balloon

**Probability:** Medium (photos are the heaviest data we store)
**Impact:** Medium

Average user might store 100+ photos/month. At 10k MAU, that's 1M photos/month, ~3 TB/year.

**Mitigation:**
- Aggressive thumbnail generation (already in design).
- Original photos lazy-loaded; thumbnails by default.
- Storage tier: hot for 90 days, archive after.
- For v2: client-side compression before upload (target 1 MB max).

---

## R18 — Founder accidentally commits a secret

**Probability:** Medium (it happens to everyone once)
**Impact:** High depending on the secret

**Mitigation:**
- `git secrets` pre-commit hook configured in setup.
- `.gitignore` includes `.env*`, `*.pem`, `*.key`, `secrets/`, `*.p8`.
- Team rule: rotate any leaked secret within 1 hour.
- GitHub Push Protection enabled.

---

## R19 — Product is too complex; users churn during onboarding

**Probability:** Medium
**Impact:** High

Many features = many places to drop off.

**Mitigation:**
- Onboarding tour shows 3 things only.
- Home screen has 3 big tiles, not 10.
- "Find What To Do" is the hero feature; everything else is discovered later.
- Track funnel: install → sign up → profile → first friend → first poll. Optimize each step.

---

## R20 — Trademark / name conflict

**Probability:** Low (we'll do clearance before naming)
**Impact:** Medium (forced rebrand is painful but survivable)

**Mitigation:**
- Before final naming: USPTO TESS search, App Store search, domain availability check, trademark attorney review for $200–500.
- Do this before ordering business cards or running paid ads.

---

## How we use this register

- Reviewed at the start of each phase.
- New risks added as discovered.
- Resolved risks moved to a "Resolved" section with what was done.
- Top 5 risks called out in any investor / board update.
