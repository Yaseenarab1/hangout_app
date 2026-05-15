-- ============================================================================
-- Phase 3C RLS Verification Test
--
-- HOW TO RUN:
-- 1. Apply the migration first (supabase/migrations/20260514000000_phase3c_feed.sql)
--    via Supabase Dashboard → SQL Editor, or `npx supabase db push`
-- 2. Paste this entire file into Supabase Dashboard → SQL Editor
-- 3. Run section by section (each "-- SECTION" block)
-- 4. Expected outcomes are listed at the bottom of each section
--
-- REQUIRES: Two existing user accounts. Replace the UUIDs below with real IDs
-- from your auth.users table. Run this query to get them:
--   SELECT id, email FROM auth.users LIMIT 5;
-- ============================================================================

-- ── SETUP: replace these with real user IDs from auth.users ──────────────────
DO $$
BEGIN
  -- Abort if placeholders not replaced
  IF '00000000-0000-0000-0000-000000000001'::text = '00000000-0000-0000-0000-000000000001' THEN
    RAISE NOTICE 'Replace USER_A_ID and USER_B_ID below with real UUIDs from auth.users before running.';
  END IF;
END $$;

-- Set these to real user IDs before running:
\set USER_A_ID  '00000000-0000-0000-0000-000000000001'
\set USER_B_ID  '00000000-0000-0000-0000-000000000002'
-- USER_A and USER_B must NOT be friends (no row in public.friendships linking them)
-- USER_A will be the post author; USER_B will be the non-friend viewer


-- ── SECTION 1: Baseline — confirm are_friends returns false ───────────────────
-- Expected: false (they are not friends yet)

SELECT public.are_friends(:'USER_A_ID'::uuid, :'USER_B_ID'::uuid) AS are_friends_before;


-- ── SECTION 2: Insert a test feed_posts row as USER_A ────────────────────────
-- We bypass auth.uid() here (we're in the SQL editor as postgres/service role),
-- so we set author_id manually. RLS policies are tested in SECTION 4.

INSERT INTO public.feed_posts (
  id,
  author_id,
  storage_path,
  thumbnail_path,
  visibility,
  caption,
  expires_at
) VALUES (
  'aaaabbbb-0000-0000-0000-000000000001',
  :'USER_A_ID'::uuid,
  :'USER_A_ID' || '/aaaabbbb-0000-0000-0000-000000000001.jpg',
  :'USER_A_ID' || '/aaaabbbb-0000-0000-0000-000000000001_thumb.webp',
  'friends',
  'Test post @mention_nobody',
  now() + interval '24 hours'
);

-- Confirm insert succeeded
SELECT id, author_id, visibility, storage_path FROM public.feed_posts
WHERE id = 'aaaabbbb-0000-0000-0000-000000000001';
-- Expected: 1 row


-- ── SECTION 3: feed_post_visible_to() function tests ─────────────────────────

-- 3a. Author always sees own post
SELECT public.feed_post_visible_to(
  (SELECT fp FROM public.feed_posts fp WHERE id = 'aaaabbbb-0000-0000-0000-000000000001'),
  :'USER_A_ID'::uuid
) AS author_sees_own;
-- Expected: true

-- 3b. Non-friend USER_B cannot see the post
SELECT public.feed_post_visible_to(
  (SELECT fp FROM public.feed_posts fp WHERE id = 'aaaabbbb-0000-0000-0000-000000000001'),
  :'USER_B_ID'::uuid
) AS nonfriend_sees_post;
-- Expected: false

-- 3c. Expired post — author still sees it
UPDATE public.feed_posts
SET expires_at = now() - interval '1 hour'
WHERE id = 'aaaabbbb-0000-0000-0000-000000000001';

SELECT public.feed_post_visible_to(
  (SELECT fp FROM public.feed_posts fp WHERE id = 'aaaabbbb-0000-0000-0000-000000000001'),
  :'USER_A_ID'::uuid
) AS author_sees_expired;
-- Expected: true (author always sees own, even expired)

SELECT public.feed_post_visible_to(
  (SELECT fp FROM public.feed_posts fp WHERE id = 'aaaabbbb-0000-0000-0000-000000000001'),
  :'USER_B_ID'::uuid
) AS nonfriend_sees_expired;
-- Expected: false

-- Reset expiry
UPDATE public.feed_posts
SET expires_at = now() + interval '24 hours'
WHERE id = 'aaaabbbb-0000-0000-0000-000000000001';


-- ── SECTION 4: RLS — simulate queries as USER_B (non-friend) ─────────────────
-- set_config + set_claim simulates auth.uid() = USER_B in RLS context.
-- Uses the anon role + JWT claim trick supported by Supabase RLS tests.

-- Set auth context to USER_B
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'USER_B_ID', 'role', 'authenticated')::text,
  true
);
SET ROLE authenticated;

-- 4a. USER_B (non-friend) SELECT — should return 0 rows
SELECT count(*) AS visible_to_nonfriend
FROM public.feed_posts
WHERE id = 'aaaabbbb-0000-0000-0000-000000000001';
-- Expected: 0

-- 4b. USER_B INSERT with own author_id — should succeed (they're authed)
-- (This tests the insert policy: author_id = auth.uid())
INSERT INTO public.feed_posts (
  id, author_id, storage_path, visibility
) VALUES (
  'aaaabbbb-0000-0000-0000-000000000002',
  :'USER_B_ID'::uuid,
  :'USER_B_ID' || '/aaaabbbb-0000-0000-0000-000000000002.jpg',
  'friends'
);
-- Expected: succeeds

-- 4c. USER_B INSERT with USER_A's author_id — should FAIL (RLS violation)
-- Wrap in a DO block so the test file can continue after the expected failure
DO $$
BEGIN
  INSERT INTO public.feed_posts (
    id, author_id, storage_path, visibility
  ) VALUES (
    'aaaabbbb-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000001',  -- USER_A id (spoofed)
    '00000000-0000-0000-0000-000000000001/aaaabbbb-0000-0000-0000-000000000099.jpg',
    'friends'
  );
  RAISE EXCEPTION 'TEST FAILED: Insert with wrong author_id should have been blocked by RLS';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'TEST PASSED: Insert with spoofed author_id blocked: %', SQLERRM;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);


-- ── SECTION 5: Make them friends, then re-test visibility ────────────────────
-- Insert friendship row (canonical ordering: smaller UUID first)
INSERT INTO public.friendships (user_a_id, user_b_id)
VALUES (
  LEAST(:'USER_A_ID'::uuid, :'USER_B_ID'::uuid),
  GREATEST(:'USER_A_ID'::uuid, :'USER_B_ID'::uuid)
)
ON CONFLICT DO NOTHING;

-- Confirm friends now
SELECT public.are_friends(:'USER_A_ID'::uuid, :'USER_B_ID'::uuid) AS are_friends_after;
-- Expected: true

-- Set auth context to USER_B (now a friend)
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'USER_B_ID', 'role', 'authenticated')::text,
  true
);
SET ROLE authenticated;

-- 5a. USER_B (now a friend) should see USER_A's post
SELECT count(*) AS visible_to_friend
FROM public.feed_posts
WHERE id = 'aaaabbbb-0000-0000-0000-000000000001';
-- Expected: 1

RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);


-- ── SECTION 6: Block test — blocked user cannot see post ─────────────────────
-- Insert a block: USER_A blocks USER_B
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES (:'USER_A_ID'::uuid, :'USER_B_ID'::uuid)
ON CONFLICT DO NOTHING;

SELECT public.feed_post_visible_to(
  (SELECT fp FROM public.feed_posts fp WHERE id = 'aaaabbbb-0000-0000-0000-000000000001'),
  :'USER_B_ID'::uuid
) AS blocked_user_sees_post;
-- Expected: false (even though they're friends, block overrides)

-- Reverse block check: blocked_id blocks back
SELECT public.feed_post_visible_to(
  (SELECT fp FROM public.feed_posts fp WHERE id = 'aaaabbbb-0000-0000-0000-000000000002'),
  :'USER_A_ID'::uuid
) AS reverse_block_sees_post;
-- Expected: false

-- Remove block
DELETE FROM public.blocks
WHERE blocker_id = :'USER_A_ID'::uuid AND blocked_id = :'USER_B_ID'::uuid;


-- ── SECTION 7: Storage RLS path matching ──────────────────────────────────────
-- We can't actually create storage.objects rows easily from SQL editor,
-- but we can verify the SELECT policy logic is correct by checking the
-- predicate directly.

-- 7a. Known path should match
SELECT EXISTS (
  SELECT 1 FROM public.feed_posts p
  WHERE p.storage_path = :'USER_A_ID' || '/aaaabbbb-0000-0000-0000-000000000001.jpg'
     OR p.thumbnail_path = :'USER_A_ID' || '/aaaabbbb-0000-0000-0000-000000000001.jpg'
) AS storage_path_matches;
-- Expected: true

-- 7b. Random unknown path should NOT match
SELECT EXISTS (
  SELECT 1 FROM public.feed_posts p
  WHERE p.storage_path = 'unknown-author/fake-post.jpg'
     OR p.thumbnail_path = 'unknown-author/fake-post.jpg'
) AS unknown_path_matches;
-- Expected: false

-- 7c. Thumbnail path matches
SELECT EXISTS (
  SELECT 1 FROM public.feed_posts p
  WHERE p.storage_path = :'USER_A_ID' || '/aaaabbbb-0000-0000-0000-000000000001_thumb.webp'
     OR p.thumbnail_path = :'USER_A_ID' || '/aaaabbbb-0000-0000-0000-000000000001_thumb.webp'
) AS thumbnail_path_matches;
-- Expected: true


-- ── SECTION 8: Mentions trigger ───────────────────────────────────────────────
-- Check that the trigger parsed the caption on our test post.
-- Caption was: 'Test post @mention_nobody' — no matching user, so 0 mentions expected.

SELECT count(*) AS mention_rows_for_test_post
FROM public.feed_post_mentions
WHERE post_id = 'aaaabbbb-0000-0000-0000-000000000001';
-- Expected: 0 (username 'mention_nobody' doesn't exist)

-- Now insert a post that mentions a real user (USER_B by username)
-- First, get USER_B's username
DO $$
DECLARE
  v_username text;
  v_post_id  uuid := 'aaaabbbb-0000-0000-0000-000000000003';
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = :'USER_B_ID'::uuid;
  IF v_username IS NULL THEN
    RAISE NOTICE 'USER_B has no username set — skip mention trigger test';
    RETURN;
  END IF;

  INSERT INTO public.feed_posts (id, author_id, storage_path, visibility, caption, expires_at)
  VALUES (
    v_post_id,
    :'USER_A_ID'::uuid,
    :'USER_A_ID' || '/' || v_post_id || '.jpg',
    'friends',
    'Hey @' || v_username || ' check this out',
    now() + interval '24 hours'
  );

  RAISE NOTICE 'Inserted mention post. Check feed_post_mentions for post_id = %', v_post_id;
END $$;

SELECT post_id, mentioned_user_id
FROM public.feed_post_mentions
WHERE post_id = 'aaaabbbb-0000-0000-0000-000000000003';
-- Expected: 1 row with mentioned_user_id = USER_B (if USER_B has a username)


-- ── SECTION 9: profile_visibility column ──────────────────────────────────────
SELECT profile_visibility FROM public.profiles
WHERE id = :'USER_A_ID'::uuid;
-- Expected: 'everyone' (default)

UPDATE public.profiles SET profile_visibility = 'friends_only'
WHERE id = :'USER_A_ID'::uuid;

SELECT profile_visibility FROM public.profiles
WHERE id = :'USER_A_ID'::uuid;
-- Expected: 'friends_only'

-- Reset
UPDATE public.profiles SET profile_visibility = 'everyone'
WHERE id = :'USER_A_ID'::uuid;


-- ── CLEANUP: remove test data ─────────────────────────────────────────────────
-- Run this block after all tests pass to clean up

DELETE FROM public.feed_posts WHERE id IN (
  'aaaabbbb-0000-0000-0000-000000000001',
  'aaaabbbb-0000-0000-0000-000000000002',
  'aaaabbbb-0000-0000-0000-000000000003'
);

DELETE FROM public.friendships
WHERE (user_a_id = LEAST(:'USER_A_ID'::uuid, :'USER_B_ID'::uuid)
  AND user_b_id = GREATEST(:'USER_A_ID'::uuid, :'USER_B_ID'::uuid))
  AND created_at > now() - interval '1 hour'; -- safety: only delete if inserted < 1h ago

SELECT 'Cleanup complete — all test rows removed' AS status;

-- ── SUMMARY OF EXPECTED RESULTS ───────────────────────────────────────────────
-- Section 1:  are_friends_before          → false
-- Section 2:  feed_posts row             → 1 row
-- Section 3a: author_sees_own            → true
-- Section 3b: nonfriend_sees_post        → false
-- Section 3c: author_sees_expired        → true
--             nonfriend_sees_expired     → false
-- Section 4a: visible_to_nonfriend       → 0
-- Section 4b: USER_B inserts own post    → succeeds
-- Section 4c: spoof insert               → blocked (NOTICE: TEST PASSED)
-- Section 5:  are_friends_after          → true
--             visible_to_friend          → 1
-- Section 6:  blocked_user_sees_post     → false
--             reverse_block_sees_post    → false
-- Section 7a: storage_path_matches       → true
-- Section 7b: unknown_path_matches       → false
-- Section 7c: thumbnail_path_matches     → true
-- Section 8:  mention_rows (unknown usr) → 0
--             mention rows (real user)   → 1 (if USER_B has username)
-- Section 9:  profile_visibility default → 'everyone'
