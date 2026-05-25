-- DB audit fixes: security, performance, correctness
-- Issues identified during 2026-05-24 audit:
--   1. bill-receipts storage SELECT policy too permissive (any authed user)
--   2. vote_weight check constraint too narrow (0.5–3.0 instead of 0–5)
--   3. Missing index on friendships(user_b_id) for are_friends() OR query
--   4. Missing partial index on friend_requests(sender_id/recipient_id) for request queries

-- ─── 1. Fix bill-receipts storage SELECT policy ─────────────────────────────
-- Old: "participants read receipts" — using (bucket_id = 'bill-receipts' AND auth.uid() IS NOT NULL)
-- Any signed-in user could read any bill receipt by guessing the path.
--
-- New: scope SELECT to bill creator or participant via is_bill_accessible().
-- Path format in the bucket: <bill_id>/<filename>
-- split_part(name, '/', 1)::uuid gives the bill_id.

DO $$
BEGIN
  -- Drop the old permissive policy
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'participants read receipts'
  ) THEN
    DROP POLICY "participants read receipts" ON storage.objects;
  END IF;

  -- Create the scoped policy (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'bill participants read receipts'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "bill participants read receipts"
        ON storage.objects FOR SELECT
        USING (
          bucket_id = 'bill-receipts'
          AND public.is_bill_accessible(
            split_part(name, '/', 1)::uuid,
            auth.uid()
          )
        )
    $p$;
  END IF;
END $$;

-- ─── 2. Fix vote_weight check constraint ────────────────────────────────────
-- CLAUDE.md spec: vote_weight >= 0 AND vote_weight <= 5
-- Allows "Doesn't vote" (0×) and future 4×/5× weights.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'hangout_participants'
      AND c.conname = 'hangout_participants_vote_weight_check'
  ) THEN
    ALTER TABLE public.hangout_participants
      DROP CONSTRAINT hangout_participants_vote_weight_check;
  END IF;

  BEGIN
    ALTER TABLE public.hangout_participants
      ADD CONSTRAINT hangout_participants_vote_weight_check
      CHECK (vote_weight >= 0 AND vote_weight <= 5);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ─── 3. Index on friendships(user_b_id) ─────────────────────────────────────
-- are_friends() ORs both orientations. PK only covers (user_a_id, user_b_id).
-- Without this index Postgres full-scans friendships for user_b lookups.

CREATE INDEX IF NOT EXISTS idx_friendships_user_b
  ON public.friendships (user_b_id);

-- ─── 4. Partial indexes for pending friend requests ─────────────────────────
-- outgoing requests: sender_id = ? WHERE status = 'pending'
-- incoming requests: recipient_id = ? WHERE status = 'pending'

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_pending
  ON public.friend_requests (sender_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient_pending
  ON public.friend_requests (recipient_id)
  WHERE status = 'pending';
