# Hangout Planner — Screen Map & User Flows

**Version:** 1.0 (Phase 0)

This document maps every screen in the app and the flows between them. It's the bridge between the PRD ("what we build") and the architecture ("how it's structured"). Designers use it to plan mockups, developers use it to plan navigation.

---

## 1. Screen inventory

Each screen has an ID (`S##`), a route (Expo Router path), and a phase when it ships. Screens marked **(modal)** open as iOS-style modal sheets.

### Phase 1 — Auth, profile, app shell

| ID | Screen | Route | Notes |
|----|--------|-------|-------|
| S01 | Splash | `/_splash` (handled by Expo) | Animated logo, fades to S02 or S07 |
| S02 | Welcome | `/(auth)/welcome` | "Sign in" / "Create account" |
| S03 | Sign in | `/(auth)/sign-in` | Email + password, Apple button |
| S04 | Sign up | `/(auth)/sign-up` | Email, password, age confirmation |
| S05 | Verify email | `/(auth)/verify` | "We sent a code to..." |
| S06 | Create profile | `/(auth)/create-profile` | Display name, username, photo, bio |
| S07 | Home | `/(tabs)/` | 3 big tiles + recent hangouts |
| S08 | Friends list | `/(tabs)/friends` | List + search + requests tab |
| S09 | Friend search (modal) | `/friends/search` | Live search by username/name |
| S10 | Friend requests | `/friends/requests` | Incoming + outgoing |
| S11 | User profile | `/users/[id]` | View any user's public profile |
| S12 | My profile | `/(tabs)/profile` | Self profile with Edit button |
| S13 | Edit profile (modal) | `/profile/edit` | |
| S14 | Settings | `/profile/settings` | Reached from profile |
| S15 | Notification preferences | `/profile/settings/notifications` | |
| S16 | Privacy settings | `/profile/settings/privacy` | |
| S17 | Blocked users | `/profile/settings/blocked` | |
| S18 | About | `/profile/settings/about` | Version, ToS, Privacy, OSS licenses |
| S19 | Account | `/profile/settings/account` | Change email/password, delete account |

### Phase 2 — Hangout planning

| ID | Screen | Route | Notes |
|----|--------|-------|-------|
| S20 | Find What To Do | `/plan/activity` | Activity picker grid |
| S21 | Create activity poll | `/plan/activity/create` | Mode, deadline, participants, weights |
| S22 | Plan Food entry | `/plan/food` | Cuisine vs. restaurant choice |
| S23 | Cuisine picker | `/plan/food/cuisine` | Grid of cuisines + custom |
| S24 | Restaurant list | `/plan/food/restaurants` | List with filters; "vote" button |
| S25 | Restaurant detail (modal) | `/plan/food/restaurants/[id]` | Full info, photos, hours |
| S26 | Plan a Day | `/plan/day` | Stop-by-stop builder |
| S27 | Add stop (modal) | `/plan/day/stops/add` | Title, time, place, notes |
| S28 | Hangout detail | `/hangout/[id]` | Tabs: Overview, Chat, Photos, Bills |
| S29 | Vote on poll | `/hangout/[id]/polls/[pollId]` | Live tally, vote |
| S30 | Add poll suggestion (modal) | `/hangout/[id]/polls/[pollId]/suggest` | Suggest-then-vote phase 1 |
| S31 | Manage participants | `/hangout/[id]/participants` | Host: invite, remove, weight |
| S32 | Hangout settings | `/hangout/[id]/settings` | Edit details, cancel hangout |

### Phase 3 — Social + photos + chat

| ID | Screen | Route | Notes |
|----|--------|-------|-------|
| S33 | Social feed | `/(tabs)/feed` | Combined with friends tab; segmented control switches |
| S34 | Create post | `/feed/new` | Photos, caption, visibility, link to hangout |
| S35 | Post detail | `/posts/[id]` | Comments, reactions |
| S36 | Photo viewer (modal) | `/photos/view` | Pinch-zoom, swipe, save |
| S37 | Hangout chat | `/hangout/[id]/chat` | Tab inside hangout detail |
| S38 | Hangout album | `/hangout/[id]/album` | Tab inside hangout detail |

### Phase 4 — Bills, location, find time

| ID | Screen | Route | Notes |
|----|--------|-------|-------|
| S39 | Bill list | `/hangout/[id]/bills` | All bills + net balances + "settle up" |
| S40 | Add bill | `/hangout/[id]/bills/new` | Manual or photo-then-OCR |
| S41 | OCR review | `/hangout/[id]/bills/new/review` | Confirm extracted line items |
| S42 | Settlement summary | `/hangout/[id]/bills/settle` | "Sara owes Ali $10" |
| S43 | Live location map | `/hangout/[id]/locations` | Map with all sharing friends |
| S44 | Start sharing (modal) | `/hangout/[id]/locations/start` | Duration picker |
| S45 | Find Time | `/(tabs)/find-time` | Calendar + list of polls |
| S46 | My availability | `/find-time/availability` | Mark available blocks |
| S47 | Friends' calendars | `/find-time/friends` | Browse friends' shared availability |
| S48 | Create time poll | `/find-time/polls/create` | Propose slots |
| S49 | Vote time poll | `/find-time/polls/[id]` | Yes / No / Maybe per slot |

### Phase 5 — Polish

| ID | Screen | Route | Notes |
|----|--------|-------|-------|
| S50 | Notifications inbox | `/(tabs)/messages` (combined) | All notifications + DMs |
| S51 | Onboarding tour | shown after S06 | 3 swipeable cards |
| S52 | Empty states | inline in lists | "No hangouts yet — plan one!" |
| S53 | Error states | inline | "Couldn't load. Retry?" |
| S54 | Offline banner | global | "You're offline — some features limited" |

## 2. Bottom navigation

5 tabs, fixed:

| Tab | Icon | Screen | Badge |
|-----|------|--------|-------|
| Home | `home` | S07 | — |
| Friends/Feed | `users` | S08 / S33 | unread feed count |
| Messages | `message-circle` | S50 | unread message count |
| Find Time | `calendar` | S45 | pending invites count |
| Profile | `user` | S12 | — |

The Friends/Feed tab uses a top segmented control to switch between **Friends** (people management) and **Feed** (social posts). This avoids a 6th tab while keeping both accessible.

## 3. Critical user flows

### Flow A — First-time user (sign up to first hangout)

```
S01 Splash
  → S02 Welcome
  → tap "Create account"
  → S04 Sign up (email + password + age)
  → S05 Verify email (enter code)
  → S06 Create profile (display name, username, photo, bio)
  → S51 Onboarding tour (3 cards)
  → S07 Home
  → S08 Friends list (empty state: "Add your first friend")
  → S09 Friend search → send request
  → friend accepts → notification
  → S07 Home → tap "Find What To Do"
  → S20 Activity picker
  → S21 Create poll → pick friends → set deadline
  → S29 Vote on own poll
  → friends vote → poll closes → winner shown
  → toast: "Use Find Time to schedule"
  → S46 mark availability
  → S48 create time poll
```

### Flow B — Suggest-Then-Vote poll

```
S07 Home → "Find What To Do"
  → S20 → tap "Custom — let friends suggest"
  → S21 Create with mode=suggest_then_vote
       set suggest deadline (1 hr) + vote deadline (3 hr)
       pick participants + weights
  → poll lives in `phase=suggesting`
  → friends notified
  → friends open S30 Add suggestion (multiple)
  → host can also add
  → at suggest_deadline:
       trigger Edge Function flips phase → 'voting'
       notification "Voting opened"
  → S29 Vote
  → at vote_deadline:
       Edge Function tallies weighted votes
       sets winning_option_id, phase='closed'
       notification "Winner: <option>"
```

### Flow C — Plan a Day end-to-end

```
S07 → "Plan a Day"
  → S26 Itinerary builder
  → S27 Add stop (×N) — each can pick from Google Places
  → publish itinerary
  → automatic invite notification to participants
  → participants RSVP from S28 (Overview tab)
  → on the day:
       1 hr before: hangout_reminder notification
       at start: status auto-flips to 'in_progress'
       optional: auto-prompt to share location (S44)
  → during: chat (S37), photos (S38), bills (S40)
  → after: marked 'completed', prompt to post on feed (S34)
```

### Flow D — Bill split with OCR

```
S28 Hangout → Bills tab → S39
  → tap "Add bill" → S40
  → choose "Photo of receipt"
  → camera → capture
  → upload to Supabase Storage (private bucket)
  → Edge Function calls Google Vision
  → OCR returns line items
  → S41 Review (user can edit/remove items)
  → choose payer (default: self)
  → assign each line item to participants
  → save → bill_splits inserted
  → debtors notified
  → settlement recalculated → S42 shows updated net balances
  → debtors can mark "Paid" from S39
```

### Flow E — Location sharing

```
S28 Hangout (in_progress) → "I'm on the way" CTA → S44 modal
  → pick duration (15min / 1hr / 2hr / until ends)
  → permission prompt if first time
  → location_session created with expires_at
  → background task starts pinging
  → S43 map shows all sharing friends with ETAs
  → persistent banner: "Sharing location — tap to stop"
  → user taps banner OR timer expires OR app revoked
  → location_session.ended_at set
  → other participants' map updates in realtime
```

### Flow F — Account deletion

```
S14 Settings → S19 Account → "Delete account"
  → confirmation modal: types "DELETE" to confirm
  → soft-delete: profile.deleted_at set
  → 7-day grace period: user can sign in to restore
  → after 7 days: cron job
       - delete auth.users row (cascades via FK)
       - delete storage objects in user's prefix
       - export retained data per legal hold (none in v1)
  → user's posts deleted, messages anonymized to "[Deleted user]"
```

## 4. Deep linking

Deep links use `hangoutplanner://` scheme + universal links from `https://hangoutplanner.app/`.

| Pattern | Action |
|---------|--------|
| `/hangout/{id}` | Open hangout detail (auth required) |
| `/hangout/{id}/poll/{pollId}` | Open poll vote screen |
| `/invite/{token}` | Accept hangout invite (handles unauthed → sign in → redirect) |
| `/u/{username}` | View user profile |
| `/post/{id}` | Open post detail |

## 5. Empty states (Phase 5)

Every list screen has a designed empty state. Examples:

- **No friends yet:** Illustration + "Plans are better together. Add your first friend." + button "Find friends"
- **No hangouts:** "Nothing planned yet. What sounds fun?" + 3 buttons (the 3 home tiles)
- **No bills:** "No bills logged. Snap a receipt to split it." + button
- **No messages:** "Quiet for now. Say hi 👋" + composer focused

## 6. Error & edge cases

| Case | UX |
|------|-----|
| No network | Banner at top of screen + read-only mode |
| Slow network | Skeletons after 200ms, "Slow connection" toast after 5s |
| Server error | Toast + Sentry capture + retry button |
| RLS denial | Treated as "not found" — never expose existence |
| Expired session | Redirect to S03, preserve intended destination |
| Permission denied (camera/location/notifications) | Explainer screen with "Open Settings" button |

## 7. Notifications routing (when tapped)

| Notification kind | Opens |
|------|-------|
| friend_request_received | S10 |
| friend_request_accepted | S11 (their profile) |
| hangout_invited | S28 (hangout detail) |
| poll_created | S29 |
| poll_closed | S29 (now showing winner) |
| message_received | S37 |
| post_created_by_friend | S35 |
| bill_added | S39 |
| location_shared_with_you | S43 |
| hangout_reminder | S28 |
