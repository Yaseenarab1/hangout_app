-- ============================================================================
-- RLS test suite for Phase 1 tables
-- ============================================================================
-- Run with: `pnpm db:test`  (which calls `supabase test db`)
--
-- These tests use pgTAP to verify that RLS policies actually deny the requests
-- they're meant to deny. We follow this pattern for every table in Phase 1+.
--
-- The pattern:
--   1. Create test users via auth.admin
--   2. SET LOCAL role / claims to simulate that user
--   3. Try the operation
--   4. Assert it succeeds or fails as expected
-- ============================================================================

begin;

select plan(8);

-- Create test users -----------------------------------------------------------
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@test.com')
on conflict (id) do nothing;

-- Wait for the on_auth_user_created trigger to populate profiles
-- (in real test we'd wait or insert profiles directly)

-- Test 1: A user can only update their own profile -----------------------------
set local role authenticated;
set local request.jwt.claim.sub to '11111111-1111-1111-1111-111111111111';

select throws_ok(
  $$ update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222' $$,
  null,
  null,
  'Alice cannot update Bob''s profile'
);

-- Test 2: A user can update their own profile ---------------------------------
select lives_ok(
  $$ update public.profiles set bio = 'My new bio' where id = '11111111-1111-1111-1111-111111111111' $$,
  'Alice can update her own profile'
);

-- Test 3: A blocked user cannot see the blocker's profile ---------------------
-- Bob blocks Alice
set local request.jwt.claim.sub to '22222222-2222-2222-2222-222222222222';
insert into public.blocks (blocker_id, blocked_id)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');

-- Now Alice should not see Bob's profile
set local request.jwt.claim.sub to '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$ select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (0::bigint) $$,
  'Alice cannot see Bob after Bob blocks her'
);

-- Test 4: Direct insert into friendships is blocked ---------------------------
select throws_ok(
  $$ insert into public.friendships (user_a_id, user_b_id)
     values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333') $$,
  null,
  null,
  'Direct friendship insert is denied (must go through Edge Function)'
);

-- Test 5: A user cannot insert a friend request as someone else ---------------
select throws_ok(
  $$ insert into public.friend_requests (sender_id, recipient_id)
     values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  null,
  null,
  'Cannot send a friend request as another user'
);

-- Test 6: A user can send their own friend request ----------------------------
select lives_ok(
  $$ insert into public.friend_requests (sender_id, recipient_id)
     values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333') $$,
  'A user can send a friend request from their own account'
);

-- Test 7: Recipient can accept a friend request -------------------------------
set local request.jwt.claim.sub to '33333333-3333-3333-3333-333333333333';
select lives_ok(
  $$ update public.friend_requests
       set status = 'accepted'
     where sender_id = '11111111-1111-1111-1111-111111111111'
       and recipient_id = '33333333-3333-3333-3333-333333333333' $$,
  'Recipient can update friend_request to accepted'
);

-- Test 8: notification_preferences are self-only ------------------------------
set local request.jwt.claim.sub to '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$ select count(*) from public.notification_preferences
     where user_id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (0::bigint) $$,
  'Alice cannot read Bob''s notification preferences'
);

select * from finish();
rollback;
