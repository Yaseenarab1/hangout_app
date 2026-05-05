# Hangout Planner — Product Requirements Document

**Version:** 1.0 (Phase 0)
**Status:** Draft — locked for Phase 1 build
**Last updated:** 2026-04-27

---

## 1. Vision

Hangout Planner is a mobile app that removes the friction from planning anything with friends. Instead of group texts that spiral into "idk, what do you want to do?" for an hour, friends open the app, vote on what to do, where to eat, and when to meet, then share the memories afterward.

The app combines four jobs that today require four separate tools (group chat for chatting, a poll app for deciding, a calendar for scheduling, Splitwise for bills, and a camera roll for photos) into one purpose-built experience.

## 2. Target user

**Primary persona:** Friend groups of 3–10 people, ages 18–32, who hang out regularly and find the planning step annoying.

**Secondary persona:** Active social organizers ("the planner friend") who want better tools to coordinate their group.

## 3. Goals and non-goals

### Goals

- **G1.** Reduce planning friction: from idea to confirmed plan in under 5 minutes.
- **G2.** Centralize the entire hangout lifecycle: plan → meet → remember.
- **G3.** Feel social and fun, not like a project management tool.
- **G4.** Be safe enough that users trust it with their location and photos.
- **G5.** Be performant enough that it never gets in the way (no loading spinners on home screen, sub-second screen transitions).

### Non-goals (v1)

- Not a discovery app (we do not compete with Yelp for finding new restaurants — we use Google Places).
- Not a calendar replacement (we read your availability, we do not own your calendar).
- Not a payment app (we track who owes whom, we do not move money — we deep-link to Venmo/Cash App).
- Not a public social network (the feed is friends-only, by design).
- Not a dating app (no matching, no strangers).

## 4. Feature specification

Each feature has a unique ID (used in the codebase as a feature flag and in the issue tracker).

### F1 — Authentication and profile

**Stories**
- As a new user, I can sign up with email/password or Apple Sign-In.
- As a returning user, I can log in.
- As a user, I can create my profile with display name, optional bio, and optional photo.
- As a user, I can edit my profile at any time.
- As a user, I can log out, which clears all local data.
- As a user, I can delete my account, which deletes my data per GDPR/CCPA.

**Acceptance criteria**
- Sign in with Apple is offered (required by Apple if any other social login is offered).
- Email verification is required before posting publicly.
- Display name is required, 2–32 characters, no profanity filter at v1 but flagged content can be reported.
- Profile photo is uploaded to Supabase Storage, max 5 MB, auto-resized to 512×512 webp.
- Logout clears AsyncStorage, SecureStore, and resets navigation stack.
- Account deletion is irreversible after a 7-day grace period and cascades correctly across the schema.

### F2 — Friends

**Stories**
- As a user, I can search for friends by username or email.
- As a user, I can send and receive friend requests.
- As a user, I can accept or decline a friend request.
- As a user, I can remove a friend.
- As a user, I can block a user (they cannot see me, message me, or invite me).

**Acceptance criteria**
- Friend requests are bidirectional and require explicit acceptance.
- Removing a friend does not delete shared hangout history.
- Blocked users are invisible in search and cannot send invites.
- Friend list shows online status (last active within 5 minutes).

### F3 — Find What To Do (activity polls)

**Stories**
- As a host, I can choose from preset activities (movies, bowling, hiking, coffee, shopping, gaming, sports, studying, museums, concerts, etc.) or add custom activities.
- As a host, I can choose poll mode: Simple Vote or Suggest-Then-Vote.
- As a host, I can select which friends receive the poll.
- As a host, I can assign vote weights (1× to 3×) to specific friends.
- As an invitee, I can see the poll, suggest activities (in Suggest-Then-Vote mode), and vote.
- As any participant, I can see the winning activity.
- As a host, after voting ends, the app suggests using Find Time to schedule.

**Acceptance criteria**
- Poll has a deadline (15 min, 1 hr, 6 hr, 24 hr, or custom).
- Suggest-Then-Vote has two phases with separate deadlines.
- Vote weights are visible only to the host (avoids social awkwardness).
- Tied votes: host breaks the tie, or app picks a random winner if host doesn't act within 1 hour.
- Real-time vote count visible to all participants.

### F4 — Plan Food

**Stories**
- As a host, I can start with cuisine voting (Italian, Mexican, Chinese, etc.) or skip straight to restaurant voting.
- After cuisine wins, the app shows nearby restaurants matching that cuisine via Google Places.
- As any participant, I can filter restaurants by price, distance, rating, cuisine, open-now.
- As any participant, I can suggest a custom restaurant by searching Google Places or entering a name and address.
- As a host, I can run weighted voting on restaurants.
- As any participant, I can see the winning restaurant with full details (address, hours, rating, photos, phone, website).

**Acceptance criteria**
- Restaurant data is fetched live from Google Places (NEVER cached longer than 30 days per Google ToS).
- Default search radius is 5 miles, adjustable.
- "Open now" filter respects user's local time zone.
- Each restaurant card has tap-to-call, tap-to-navigate, tap-to-website.

### F5 — Plan a Day (itinerary)

**Stories**
- As a host, I can build a multi-stop day with activities + food stops.
- As a host, I can assign times and locations to each stop.
- As a host, I can add notes per stop.
- As a host, I can publish the itinerary.
- As an invitee, I can RSVP yes/no/maybe.
- As a non-invitee friend, I can request to join a published itinerary.

**Acceptance criteria**
- Itinerary supports 2–10 stops.
- Each stop has activity name, location (Google Places or freeform), start time, optional end time, optional notes.
- Conflicts (e.g., overlapping times) are flagged but not blocked.
- Published itinerary generates a shareable deep link.

### F6 — Group messaging

**Stories**
- As a hangout participant, I can send text messages to the group.
- As a hangout participant, I see who said what with timestamps.
- As a hangout participant, I receive push notifications for new messages.
- As a hangout participant, I can mute notifications for a hangout.

**Acceptance criteria**
- Messages are delivered in real-time via Supabase Realtime.
- Messages persist server-side (with end-to-end encryption deferred to v2 — see Risk Register R7).
- Read receipts at v1: optional, per-user setting.
- Message history is paginated (50 per page).
- 1-on-1 DMs in v2 (Phase 3+ stretch).

### F7 — Social feed

**Stories**
- As a user, I can post photos and text about a hangout I attended.
- As a user, I can choose post privacy: all friends, selected friends, or only-this-hangout.
- As a friend, I can like and comment on posts.
- As an author, I can delete my post or comments.
- As a user, I can report a post.

**Acceptance criteria**
- Feed is chronological with no algorithmic ranking at v1 (transparency builds trust).
- Posts support 1–10 images.
- Reactions: like, love, laugh, wow (4 options, keep it simple).
- Comments are flat (no threading) at v1.

### F8 — Shared photo albums

**Stories**
- As a hangout participant, I can upload photos to the hangout's shared album.
- As a participant, I can see who uploaded each photo.
- As a participant, I can save photos to my device.
- As an uploader, I can delete photos I uploaded.
- As the host, I can delete any photo in my hangout's album.

**Acceptance criteria**
- Photos are stored in Supabase Storage with hangout-scoped access.
- Original + thumbnail variants are generated.
- Album is auto-created when the hangout is created.
- EXIF data (including GPS) is stripped on upload for privacy.

### F9 — Bill tracker with smart settlement

**Stories**
- As a participant, I can take a photo of a receipt and have line items extracted via OCR.
- As a participant, I can manually add bills (description, amount, who paid, who owes).
- As a participant, I can split equally or custom-assign amounts.
- As any participant, I can see the running tab and net balances.
- As any participant, I can see the minimum-transaction settlement plan ("Sara owes Ali $10, Tom owes Ali $5" instead of a tangled web).
- As any participant, I can mark a debt as paid.

**Acceptance criteria**
- OCR uses Google Cloud Vision; user can correct extracted items before saving.
- Settlement uses a debt-simplification algorithm (greedy creditor-debtor matching) to minimize transactions.
- Currency is per-hangout (default to user's locale, override per hangout).
- Bills cascade-delete when hangout is deleted (with confirmation).

### F10 — Live location sharing

**Stories**
- As a hangout participant, I can opt in to share my live location with the group for a chosen duration (15 min / 1 hr / 2 hr / until hangout ends / custom up to 8 hrs).
- As a participant, I can see all sharing friends on a map with their distance and ETA.
- As a sharer, I can stop sharing at any time.
- The app auto-stops sharing when the timer expires.

**Acceptance criteria**
- Location updates every 30 seconds while app is foreground; every 2 minutes while background.
- Background location requires a separate iOS permission with clear justification.
- ETA is calculated based on driving time via Google Maps Directions API.
- A persistent banner shows "You are sharing location — tap to stop" while active.
- Hard stop: app cannot share location for more than 8 hours without re-confirmation.

### F11 — Find Time (scheduling)

**Stories**
- As a user, I can mark my available days/times.
- As a host, I can create a Find Time poll with proposed time windows.
- As an invitee, I can mark which proposed times work for me.
- As a host, I can see overlap and pick the winning time.
- As a user, I can set my "social calendar" privacy (visible to all friends / select friends / private).
- As a friend, I can browse a friend's social calendar (if visible) and propose a hangout at a free time.

**Acceptance criteria**
- Availability is stored in 30-minute blocks.
- Time zones are handled correctly (everyone sees their own local time).
- Find Time polls auto-suggest the time with the most overlap.

### F12 — Notifications

**Triggers (all push-notifiable, all opt-out per category):**
- New friend request
- Friend request accepted
- New hangout invite
- Poll created (you were invited)
- Poll deadline approaching (15 min before close)
- Voting opened (Suggest-Then-Vote mode)
- Voting closed / winner announced
- Final plan / itinerary published
- Upcoming hangout reminder (1 hr before)
- New group message (with mute-per-hangout option)
- New post from friend
- Comment on your post
- Bill added (you owe / you're owed)
- Payment marked received
- Friend started sharing location with you

### F13 — Settings & account management

- Notification preferences per category
- Theme (light / dark / system)
- Privacy defaults (post visibility, calendar visibility)
- Blocked users list
- Data export (GDPR Art. 20)
- Account deletion (GDPR Art. 17, CCPA)
- About / Terms / Privacy Policy / Open-source licenses

## 5. Phased delivery

| Phase | Features | Why this order |
|-------|----------|----------------|
| **0** | Foundation docs, schema, design system | You can't build a house without blueprints |
| **1** | F1, F2, app shell, navigation, settings skeleton | No app works without auth and friends |
| **2** | F3, F4, F5, hangout core | The headline value prop — planning |
| **3** | F6, F7, F8 | Social layer — engagement and retention |
| **4** | F9, F10, F11 | Power features — bills, location, scheduling |
| **5** | F12, polish, performance, accessibility | Ship-quality |
| **6** | App Store release | Submission |

Each phase has its own definition-of-done, listed in `docs/12-phase-checklists.md` (created at the start of each phase).

## 6. Success metrics (post-launch)

- **Activation:** 60% of sign-ups complete a profile + add ≥1 friend within 24 hours.
- **Core action:** 40% of weekly actives create or vote in a poll each week.
- **Retention:** 30% of users active in week 4.
- **Group size:** Median hangout has 4 participants.
- **NPS:** ≥40 by month 6.

## 7. Out of scope (deliberately deferred)

- End-to-end encryption for messages (v2 — see R7)
- Web app (mobile-first; web later if pulled)
- Android (cross-platform-capable but iOS-first launch)
- Public events / event discovery (would change the product into something else)
- Stories/ephemeral content (resist scope creep)
- Direct payment integration (legal/compliance scope is enormous)
- AI-suggested activities (interesting but unfocused for v1)

## 8. Open questions to resolve before launch

These do not block Phase 1 build but must be answered before App Store submission:

- **Q1.** Final app name and bundle ID (currently `com.hangoutplanner.app`).
- **Q2.** Legal entity for App Store listing (individual now, transferable to LLC later).
- **Q3.** Privacy Policy and ToS — boilerplate now, lawyer review before public launch.
- **Q4.** Support email address (e.g., `support@yourcompany.com`).
- **Q5.** Pricing model — free, freemium, paid? (Recommendation: free at launch, freemium later.)
