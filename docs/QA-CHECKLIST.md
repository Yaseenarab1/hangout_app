# Manual QA Checklist

End-to-end scripts to run before a release. Each item is a tap-by-tap flow with the
**expected** result. Anything realtime or social needs **two accounts on two
devices** (call them **A** and **B**, friends with each other) — marked 🔲🔲.

Automated coverage lives alongside this:
- `npm test` — unit/integration (voting tally, money/splits, recommendations ranking,
  schemas, formatting).
- `npm run e2e` — Maestro happy-path smoke flows (see `.maestro/README.md`).

Use this doc for the full-flow confidence those don't cover yet.

---

## 0. Setup
- [ ] Fresh install, sign up a new account → lands on Home with "Hey <name> 👋".
- [ ] Sign out / sign in / forgot-password all work.
- [ ] A and B send + accept a friend request (see §7) before social tests.

## 1. Hangout creation (each type)
- [ ] Home → **Plan a hangout** → "What kind of hangout?" appears.
- [ ] **Generic** (`/hangout/new`): name → when (incl. "TBD") → invite → create. Opens detail.
- [ ] **Food**: pick a cuisine → pick restaurants → choose **Simple/Ranked** → invite → create.
- [ ] **Activity**: pick activity → options → Simple/Ranked → invite → create.
- [ ] **Movie**: cinema **and** streaming paths; pick 2+ titles → **voting style row appears** → create.
- [ ] **Sports**: pick sport → play/watch → 2+ venues → **voting style row appears** → create.
- [ ] Created hangout shows correct title, host = creator, you as accepted participant.

## 2. Voting (the focus of this release)
- [ ] **Simple vote**: tap an option → bar fills immediately (optimistic), persists after reload.
- [ ] Tap a different option → vote moves; tap your option again → unvote.
- [ ] **Ranked vote** (movie/sports/food/activity): rank options → winner computed by elimination.
- [ ] Ranked with a clear Condorcet-style case: lowest first-choice is eliminated and
      its votes redistribute (matches `irv.test.ts`).
- [ ] **Vote weights** (host): set a participant to **2×** → their vote moves the
      weighted bar by 2, and **the bar doesn't flicker/jump** on cast (the optimistic fix).
- [ ] Set a participant to **0×** ("Doesn't vote") → their taps don't change the tally.
- [ ] **Deadline**: set a short deadline → after it passes, voting is closed.
- [ ] **Follow-ups**: close a cuisine poll → "pick restaurants" follow-up; close an
      activity poll → "pick a venue" follow-up.
- [ ] 🔲🔲 B votes → A sees the tally update.

## 3. Recommendations — "Suggested for your group"
- [ ] Both A and B rate the **same** restaurant 4–5★ (Profile → Ratings, or after a hangout).
- [ ] In a hangout with A+B, open a food poll → **Add a choice** → a
      **"Suggested for your group"** strip shows that restaurant with "avg · N ratings".
- [ ] Tap a suggestion → it's added as a poll option (no duplicate if already added).
- [ ] Same for an **activity/venue** poll (theaters, bowling, etc.).
- [ ] Group with **no shared ratings** → the strip is absent (graceful), search still works.
- [ ] A solo creator (before inviting) still sees **their own** top-rated picks.

## 4. Bills / expense splitting
- [ ] **Itemized bill**: add items, assign each to people (equal + custom weights).
- [ ] **Tax & tip** distribute **proportionally** to each person's subtotal; totals reconcile
      (no lost/extra cents) — matches `compute-item-shares.test.ts`.
- [ ] **Receipt scan**: scan a receipt → items parsed → all fields **editable** → save.
- [ ] Bad/low-light photo or failure → friendly fallback to manual entry (not a hard error).
- [ ] **Mark as paid** → status reflects partially_paid / paid.
- [ ] **Settle up** shows the minimized set of payments (greedy simplification).
- [ ] **Standalone bill** (no hangout) with a **guest** participant → appears in Profile → Bills.
- [ ] All amounts display in dollars but are stored in cents (no float drift on repeated edits).

## 5. Ratings
- [ ] Rate a restaurant (1–5★ + note) → appears in Profile → Ratings.
- [ ] Ratings sheet surfaces **activity venues** (theaters, bowling) from past hangouts, not just restaurants.
- [ ] Rate a movie/TV title → appears in media ratings.
- [ ] Edit / delete a rating (optimistic; reverts on error).

## 6. Feed / stories (Phase 3C)
- [ ] Create a post (photo + caption); pick visibility hangout/friends/public.
- [ ] Ephemeral default (24h) vs **keep forever** is unmistakable in the UI.
- [ ] 🔲🔲 B sees A's friends-visible post; story viewer auto-advances; tap L/R = prev/next.
- [ ] Tap-and-hold pauses (no iOS context menu); swipe down dismisses; swipe up = comments.
- [ ] Backgrounding the app pauses auto-advance.
- [ ] @mention a user → they get notified and the link deep-links to the post.
- [ ] Comment (optimistic); author can edit within 5 min; report + block work.

## 7. Friends & blocks
- [ ] Search a user → send request → 🔲🔲 B accepts → both see each other as friends.
- [ ] Remove friend; block a user → their content disappears both directions.

## 8. Messaging (realtime)
- [ ] 🔲🔲 Per-hangout chat: A sends → B receives live; reactions, replies, read state.
- [ ] 🔲🔲 DM / group conversation: same.
- [ ] Unread badges increment and clear correctly.

## 9. Profile & settings
- [ ] Edit profile (name, bio, **avatar**) → avatar uploads (JPEG, not blank).
- [ ] View another user's profile; `profile_visibility` (everyone/friends_only/nobody) respected.
- [ ] Settings: account, notifications, privacy, blocked list, search location.

## 10. Regression guards (bugs we've hit before)
- [ ] Avatar upload is not blank (JPEG pipeline).
- [ ] Users see hangouts they haven't accepted (status maybe/declined still visible).
- [ ] Vote weight **0×** works (no `> 0` constraint regression).
- [ ] Sticky bottom buttons don't overlap picker content.
- [ ] Venue polls (sports/movie) show **venue** search, not restaurant search.

---

### Sign-off
- [ ] `npm test` green
- [ ] `npx tsc --noEmit` clean
- [ ] `maestro test .maestro/smoke.yaml` passes on a simulator
- [ ] §2 (voting) and §3 (recommendations) re-checked after any poll/ratings change
