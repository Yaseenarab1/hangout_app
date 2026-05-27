-- Full bills RLS overhaul.
--
-- Root cause of persistent "new row violates RLS" errors:
--
-- 1. bills INSERT — "bills_insert" already fixed (migration 6). Kept.
--
-- 2. bill_shares / bill_guest_participants / bill_items INSERT policies all do:
--      EXISTS (SELECT 1 FROM bills WHERE id = bill_id AND created_by = auth.uid())
--    That SELECT goes through the bills SELECT policy (is_bill_accessible()).
--    is_bill_accessible() for hangout bills only checks is_hangout_participant().
--    If the user is not yet in hangout_participants (e.g. old hangout, trigger miss),
--    the bill is invisible → sub-query returns nothing → WITH CHECK fails → RLS error.
--
-- Fix A: Update is_bill_accessible() to always let the creator/payer see their own bill.
-- Fix B: Replace the bill_shares INSERT policy with a SECURITY DEFINER helper that
--        reads bills directly (bypassing RLS), so the SELECT is never gated.
-- Fix C: Same for bill_guest_participants and bill_items INSERT.

-- ── Fix A: is_bill_accessible — creator/payer always visible ─────────────────

CREATE OR REPLACE FUNCTION public.is_bill_accessible(p_bill_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = p_bill_id
      AND (
        -- creator can always see their bill
        b.created_by = p_user_id
        -- payer can always see their bill
        OR b.payer_id = p_user_id
        -- hangout bill: any participant
        OR (b.hangout_id IS NOT NULL
            AND public.is_hangout_participant(b.hangout_id, p_user_id))
        -- hangout bill: host (belt-and-suspenders for old hangouts)
        OR (b.hangout_id IS NOT NULL
            AND public.is_hangout_host(b.hangout_id, p_user_id))
        -- standalone bill: any share participant
        OR (b.hangout_id IS NULL AND EXISTS (
          SELECT 1 FROM public.bill_shares bs
          WHERE bs.bill_id = p_bill_id AND bs.user_id = p_user_id
        ))
      )
  )
$$;

-- ── Fix B: bill_shares INSERT — use SECURITY DEFINER helper ──────────────────

CREATE OR REPLACE FUNCTION public.bill_created_by_me(p_bill_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bills WHERE id = p_bill_id AND created_by = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.bill_created_by_me(uuid) TO authenticated;

DO $$ BEGIN
  DROP POLICY IF EXISTS "bill creator inserts shares" ON public.bill_shares;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "bill creator inserts shares"
  ON public.bill_shares FOR INSERT
  WITH CHECK (public.bill_created_by_me(bill_id));

-- ── Fix C: bill_guest_participants INSERT — same helper ───────────────────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "creator manages guests" ON public.bill_guest_participants;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "creator manages guests"
  ON public.bill_guest_participants FOR ALL
  USING  (public.bill_created_by_me(bill_id))
  WITH CHECK (public.bill_created_by_me(bill_id));

-- ── Fix D: bill_items INSERT — same helper ────────────────────────────────────

DO $$ BEGIN
  DROP POLICY IF EXISTS "creator manages items" ON public.bill_items;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "creator manages items"
  ON public.bill_items FOR ALL
  USING  (public.bill_created_by_me(bill_id))
  WITH CHECK (public.bill_created_by_me(bill_id));
