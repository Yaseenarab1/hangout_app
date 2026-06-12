-- Fix: votes RLS blocks casting after the vote_deadline even when poll is still open.
-- Root cause: default deadline = now+1h, so any poll older than 1h silently rejects votes.
-- Fix: remove vote_deadline check from INSERT/UPDATE; phase='voting' is the real gate.
-- Safe to re-run.

-- ── votes INSERT ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "votes_insert_during_voting" ON public.votes;

CREATE POLICY "votes_insert_during_voting"
  ON public.votes FOR INSERT
  TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = votes.poll_id
        AND p.phase = 'voting'
        AND public.is_hangout_participant(p.hangout_id, auth.uid())
    )
  );

-- ── votes UPDATE ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "votes_update_self_during_voting" ON public.votes;

CREATE POLICY "votes_update_self_during_voting"
  ON public.votes FOR UPDATE
  TO authenticated
  USING (
    voter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = votes.poll_id
        AND p.phase = 'voting'
    )
  );

-- ── votes DELETE (unvote) ─────────────────────────────────────────────────────
-- May already exist; recreate defensively
DROP POLICY IF EXISTS "votes_delete_self" ON public.votes;

CREATE POLICY "votes_delete_self"
  ON public.votes FOR DELETE
  TO authenticated
  USING (voter_id = auth.uid());

-- ── ranked_votes INSERT/UPDATE/DELETE ────────────────────────────────────────
-- Same issue may apply to ranked_votes table if it has deadline checks.
-- Ensure it has permissive insert/delete policies while poll is open.

ALTER TABLE IF EXISTS public.ranked_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranked_votes_insert" ON public.ranked_votes;
CREATE POLICY "ranked_votes_insert"
  ON public.ranked_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = ranked_votes.poll_id
        AND p.phase = 'voting'
        AND public.is_hangout_participant(p.hangout_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "ranked_votes_delete" ON public.ranked_votes;
CREATE POLICY "ranked_votes_delete"
  ON public.ranked_votes FOR DELETE
  TO authenticated
  USING (voter_id = auth.uid());

DROP POLICY IF EXISTS "ranked_votes_select" ON public.ranked_votes;
CREATE POLICY "ranked_votes_select"
  ON public.ranked_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      WHERE p.id = ranked_votes.poll_id
        AND (
          public.is_hangout_participant(p.hangout_id, auth.uid())
          OR public.is_hangout_host(p.hangout_id, auth.uid())
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ranked_votes TO authenticated;
