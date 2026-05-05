# Hangout Planner — Founder's Technical Brief

**Version:** 1.0 (Phase 0)
**Audience:** You. Use this for investor conversations, technical co-founder pitches, and your own planning.

---

## 1. The architecture in one paragraph

Hangout Planner is an iOS app built in React Native (via Expo) backed by Supabase. The mobile app handles UI and optimistic updates; Supabase Postgres is the source of truth, with row-level security policies enforcing every permission decision. Real-time features (chat, votes, location) use Supabase's realtime channels; everything else is cached client-side via TanStack Query. Third-party integrations (Google Places, Google Vision OCR, Expo Push) are proxied through Supabase Edge Functions so API keys never live on the device. This stack is single-vendor, scales to ~100k MAU without architecture changes, and lets a small team ship quickly.

## 2. Cost projections

These are realistic estimates, not marketing numbers. All in USD/month.

### At 100 users (closed beta)

| Service | Cost |
|---------|------|
| Supabase Free tier | $0 |
| Expo / EAS Free tier | $0 |
| Google Cloud (Places + Vision + Maps) | <$5 (within $200 free credit) |
| Sentry, PostHog free tiers | $0 |
| Apple Developer Program | $99/year ≈ $8/mo |
| Domain name | $12/year ≈ $1/mo |
| **Total** | **~$15/mo** |

### At 10,000 MAU

| Service | Cost |
|---------|------|
| Supabase Pro ($25 base + usage) | ~$60 |
| EAS Production ($29 base) | $29 |
| Google Cloud (Places ~50k requests, Vision ~5k, Maps ~50k) | ~$80 |
| Sentry Team plan | $26 |
| PostHog (still free at this scale) | $0 |
| Apple, domain, misc | ~$10 |
| **Total** | **~$200/mo** |

Per-user cost: **$0.02/MAU**. This is sustainable on freemium or ad-supported, very sustainable on paid.

### At 100,000 MAU

| Service | Cost |
|---------|------|
| Supabase Team ($599) + scaled compute/db | ~$1,500 |
| EAS Enterprise (custom) | ~$200 |
| Google Cloud (Places ~500k, Vision ~50k, Maps ~500k) | ~$700 |
| Sentry Business | ~$150 |
| PostHog (paid) | ~$300 |
| Misc | ~$100 |
| **Total** | **~$3,000/mo** |

Per-user cost: **$0.03/MAU**. Still sustainable. At this point you'd hire your first SRE.

### When you'd need to re-architect

Around **500k–1M MAU**. Signs:
- Postgres queries get expensive on hot tables (messages, posts).
- Realtime channel limits hit on group chat at scale.
- You start needing read replicas, caching layers (Redis), and a CDN for media.

The good news: every component is replaceable independently. Supabase is built on standard tech (Postgres, GoTrue, PostgREST, etc.) — you migrate piece by piece, not as a rewrite.

## 3. What this stack lets us do quickly

- **Feature flags** out of the box (PostHog).
- **A/B tests** (PostHog).
- **Push notifications** (Expo Push, one API).
- **Realtime everything** (Supabase Realtime).
- **OTA updates** for JS-only changes (Expo Updates) — push fixes without App Store review.
- **Cross-platform later** (React Native → Android in ~2 weeks of work, not a rewrite).

## 4. What this stack makes hard

- **Native-feeling iOS animations** beyond what React Native + Reanimated 3 can do. We use Reanimated 3 + React Native Skia where needed; for v1 it's enough. If we ever want SwiftUI-level polish, we'd write specific screens in native.
- **Background processes** (e.g., always-on geofence). iOS limits these regardless of framework, but RN adds friction.
- **Apple's newest SDKs day-one.** RN typically lags iOS releases by 2–6 months.

None of these block a great v1.

## 5. Engineering velocity assumptions

For a single competent full-stack developer working full-time, with no surprises:

| Phase | Estimated calendar weeks |
|-------|--------------------------|
| 0 (this) | 1 (done — these docs) |
| 1 — Auth + shell | 3 |
| 2 — Hangouts + polls | 5 |
| 3 — Social + chat + photos | 4 |
| 4 — Bills + location + Find Time | 5 |
| 5 — Polish + accessibility + perf | 3 |
| 6 — App Store submission + review | 2 (incl. Apple's review wait) |
| **Total** | **~23 weeks (~6 months)** |

If you have a co-developer who is competent in TS + RN, halve to ~12 weeks. Hiring before launch is usually the wrong call (more onboarding cost than help) unless they're a co-founder.

## 6. Hiring signals (when you do hire)

When the time comes to hire your first engineer:

- TypeScript fluency (not optional).
- React Native experience preferred but not required if they're a strong web React + native iOS developer.
- Postgres + RLS familiarity is a green flag (rare; most React devs don't know SQL well).
- Has shipped at least one app to the App Store. The submission process is its own skill.
- Cares about accessibility and performance. Ask: "How do you measure if a screen is fast?" — bad answers are common.

## 7. What investors will ask, and the answer

**"Why does this win against incumbents?"**
There is no single incumbent. We're consolidating four products (Partiful, Splitwise, When2Meet, group chat) into one purpose-built tool for friend groups. The wedge is the planning poll — others let you message about plans; we let you decide on plans.

**"How do you defend against a Big Tech feature copy?"**
Network effects via friend graph. Once a friend group is on Hangout Planner, switching cost is high (re-adding friends, losing history). Speed and product polish in the early years build the moat.

**"Why now?"**
- BeReal/Locket proved Gen Z wants social apps that are not algorithmic and not public.
- Splitwise has 50M users and is universally complained about. Vulnerability to a better experience.
- Apple's privacy push (App Tracking Transparency) hurt ad-driven incumbents and helps a paid/freemium model.

**"Can this team build it?"**
[Your answer.] The technical foundation (this document) shows we know what to build and how.

**"What does v2 look like?"**
- End-to-end encrypted messaging (R7).
- Android.
- AI-suggested activities based on friend group history.
- Public/discoverable hosted events (host a meetup, find one near you).
- Premium tier ($4/mo): unlimited photo storage, advanced bill features, calendar integrations.

**"What's the moat as you scale?"**
Friend graph + social history + photos. Same as why people don't leave Instagram or iMessage.

## 8. Strategic decisions we've made (so you can defend them)

- **iOS first, not cross-platform launch.** iOS users adopt new social apps faster, have higher willingness to pay, and concentrate in our target demographic. Android comes after PMF.
- **No public discovery.** We are not building a place to find new people. The product is for existing friend groups. This is a feature, not a limitation — it's why people will share photos here that they wouldn't share on Instagram.
- **No ads in v1, possibly ever.** Ads + friend data is a brand risk we don't need. Premium tier is the long-term model.
- **No payment processing.** Splitwise didn't do payments for years. We deep-link to Venmo/Cash App. This avoids regulatory + compliance scope that would dwarf the rest of the app.
- **Free at launch.** Charging too early kills growth. Free for v1; introduce premium when we have ≥30% week-4 retention.

## 9. Risks (summary — full register in `08-risk-register.md`)

The top three to internalize:

1. **Apple App Store rejection** for any of: location justification, social network without proper moderation, deceptive metadata. Mitigation: clear privacy manifest, Trust & Safety from day one, plain-language App Store listing.
2. **Google Places ToS restrictions.** Restaurant data cannot be cached >30 days, cannot be displayed without Google attribution, cannot be combined with non-Google data in ways that look like a competing product. Mitigation: strict adherence; legal review before launch.
3. **OCR accuracy ceiling.** Receipt OCR will be ~85% accurate. Manual correction UX is critical or users will abandon the bill feature. Mitigation: design the correction UX as a first-class flow, not an afterthought.

## 10. Decisions we're explicitly deferring

- App name (working title only)
- Logo (placeholder only)
- Domain (we'll buy when we name it)
- LLC/incorporation
- Privacy Policy / ToS lawyer review
- Pricing model
- Marketing site
- Press / launch strategy
- App Store Optimization (keywords, screenshots, video)

These all happen between Phase 5 and Phase 6.
