# CLAUDE.md — addendum for Phase 3C (REVISED)

This addendum REPLACES the original Phase 3C plan (event aggregation
feed). The new 3C is a story-style social feed with photo posts.

**Action for Claude Code:** merge these additions into the existing
`CLAUDE.md` in the project root. The old "3C — Social feed" section in
CLAUDE.md (event aggregation) is OBSOLETE — replace it with the rules
below.

---

## Phase 3C additions to "Critical rules"

### Feed posts
- A "post" is a single photo with optional caption. Visibility set at
  creation: `hangout` / `friends` / `public`. Public scope for v1 is
  friends-of-friends (NOT true-public — moderation infra isn't ready).
- Visibility set at creation persists forever. If user later unfriends
  a viewer, the viewer keeps access to existing posts that were visible
  to them at creation time. Snapshot the audience at post time when
  feasible; otherwise rely on the friendship state AT POST TIME being
  encoded in the visibility model.
- Posts have an `expires_at` field. Default = `created_at + 24 hours`.
  If user opts to "keep on profile," `expires_at` is NULL (never expires).
- Expired posts don't appear in feed/stories but stay in DB for 7 days
  for analytics + accidental-delete recovery, then hard-deleted by a
  scheduled function.

### Story rail (Home top)
- Top of Home screen. Horizontal scroll. Each author gets ONE circle
  (with avatar) showing if they have unexpired posts; tap opens the
  full-screen viewer for that author's posts.
- Story rail auto-collapses when user scrolls Home content (same as IG).
- "Your story" is always first in the rail when you have active posts
  OR when you tap the "+" to create one.

### Story viewer
- Full-screen modal, auto-advance every 5 seconds per post.
- Tap left/right halves to go previous/next within the author's posts.
- Tap-and-hold to pause auto-advance.
- Swipe down to dismiss. Swipe up to open comments / actions.
- Swipe LEFT (when on last post of an author) → next author's stories.
- Swipe RIGHT (when on first post of an author) → previous author's stories.
- Progress bar segments at top, one per post in the author's set.

### Profile privacy
- New column on `profiles`: `profile_visibility` enum:
  `everyone` / `friends_only` / `nobody`.
- `everyone` = anyone who can find your profile sees it (default for v1
  given friends-of-friends scope).
- `friends_only` = only your mutual friends see profile content.
- `nobody` = profile is invisible except to yourself. Others see a
  minimal "private profile" placeholder when they try to view.
- Profile photo grid (the "kept forever" posts) respects this setting.

### Mentions
- `@username` in a caption is a mention.
- Mentioned users get a push notification ("Mike mentioned you in a post").
- Mentioned users see the post in a "Mentions" tab on their notification
  drawer.
- They can untag themselves → the mention is broken (caption stays but
  the @ link no longer resolves to their profile).
- Mention parser: regex `/@([a-zA-Z0-9_]{3,30})/g` against `username` on
  profiles. Case-insensitive match.

### Comments
- Text + emoji only (no photos, no GIFs, no stickers for v1).
- Max 500 chars.
- Visibility scope = same as post visibility. Can't comment on a post
  you can't see (RLS enforces).
- Comment author can edit (within 5 min of post) or delete own.
- Post author can delete any comment on their own post.

### Sharing
- v1: DM only (uses 3A chat). Sends the post as a special message type
  that renders the post inline in the chat.
- Recipient must already have visibility (no privilege escalation by
  sharing). If you DM a friends-only post to someone who isn't your
  friend, they see a "Private post" placeholder instead of the content.
- NOT in v1: repost (creating a copy). Defer to next phase.

### Moderation
- Every post + every comment has a Report action.
- Reports go to `content_reports` table for manual review.
- Block a user → they can't see your posts, you can't see theirs.
  Bilateral; uses existing block infrastructure if present from Phase 1.
- Post author can delete own post at any time.

### Storage
- Photo posts: use existing `hangout-photos` bucket pattern but in a
  new bucket: `feed-posts`. Path: `<user_id>/<post_id>.jpg`.
- Same EXIF-strip + client-side resize pattern as Phase 3B.
- Permanent posts (kept on profile) move to or duplicate into a
  separate bucket `feed-posts-permanent` so the cleanup job for
  ephemeral posts doesn't accidentally nuke them. **Decision: same
  bucket, just don't delete files whose post row has `expires_at IS NULL`.**

### Realtime
- New posts and new comments use the realtime infrastructure from 3.0.
- Channel naming:
  - `feed:user:<userId>` — that user's feed updates
  - `post:<postId>:comments` — live comments on a single post
- Likes use optimistic updates, no realtime needed (eventually consistent
  is fine for a counter).

### Hangout integration
- A post with `visibility='hangout'` AND `hangout_id` set ALSO appears
  in the hangout's photo album (Phase 3B).
- Cross-link: when posting from the hangout's chat/details screen, the
  visibility is pre-set to 'hangout' for that hangout.
- Deletion of a hangout-tagged post deletes from BOTH places.
- Deletion of a photo from the hangout album that originated as a feed
  post → also deletes the feed post.

## Phase 3C additions to "Common bugs"
- Story auto-advance doesn't fire if app loses focus → use
  `AppState` listener to pause/resume.
- Tap-and-hold on iOS triggers context menu if not careful → use
  `onPressIn` / `onPressOut` for pause-hold.
- Push notifications for mentions: include the post id in payload so
  tapping opens directly to the post.
- Story viewer + comments sheet stacking → comments sheet must be a
  separate Modal, not overlaid in the same view.
- Username matching for mentions: case-insensitive but stored as-typed.
- Story viewer memory: prefetch the NEXT post's image but unload posts
  > 2 ahead/behind to keep memory bounded.

## Communication style
- Story viewer is the "wow" UX — get it smooth. 60fps gestures, instant
  transitions, no jank.
- Be explicit in small print about what "keep forever" means and what
  the visibility levels do. Users mess this up in Instagram all the
  time; we can do better with clear labels.
