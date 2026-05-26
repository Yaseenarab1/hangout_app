-- Comprehensive bills RLS fix.
-- Problem: "participants insert bills" policy only uses is_hangout_participant(),
-- which returns false if the host row is missing from hangout_participants,
-- OR if the migration 20260514000005 was never applied to this DB instance.
--
-- Fix:
--   1. Drop ALL possible INSERT policy names on bills (idempotent).
--   2. Create a single clean policy that covers hangout bills, standalone bills,
--      AND hosts who are in hangouts.host_id (belt-and-suspenders).
--   3. Backfill any hangouts whose host is not yet in hangout_participants.

-- ── 1. Drop all possible INSERT policy names ──────────────────────────────────

DO $$ BEGIN DROP POLICY IF EXISTS "bills_insert_participant" ON public.bills; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "participants insert bills"  ON public.bills; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "bills_insert"              ON public.bills; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ── 2. Create single comprehensive INSERT policy ──────────────────────────────

CREATE POLICY "bills_insert"
  ON public.bills FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      -- standalone bill: no hangout required
      hangout_id IS NULL
      -- hangout bill: must be a participant OR the host
      OR is_hangout_participant(hangout_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.hangouts
        WHERE id = hangout_id AND host_id = auth.uid()
      )
    )
  );

-- ── 3. Backfill missing host rows in hangout_participants ─────────────────────
-- Safe: ON CONFLICT DO NOTHING means it won't touch existing rows.

INSERT INTO public.hangout_participants (hangout_id, user_id, status, role, responded_at)
SELECT h.id, h.host_id, 'accepted', 'host', now()
FROM public.hangouts h
WHERE NOT EXISTS (
  SELECT 1 FROM public.hangout_participants hp
  WHERE hp.hangout_id = h.id AND hp.user_id = h.host_id
)
ON CONFLICT (hangout_id, user_id) DO NOTHING;
