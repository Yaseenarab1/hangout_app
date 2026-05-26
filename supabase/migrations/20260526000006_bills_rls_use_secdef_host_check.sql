-- Fix: bills INSERT policy used a raw EXISTS subquery on hangouts,
-- which goes through hangouts RLS and can silently return false.
-- Replace with is_hangout_host() which is SECURITY DEFINER and bypasses RLS.

DO $$ BEGIN DROP POLICY IF EXISTS "bills_insert" ON public.bills; EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "bills_insert"
  ON public.bills FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      hangout_id IS NULL
      OR is_hangout_participant(hangout_id, auth.uid())
      OR is_hangout_host(hangout_id, auth.uid())
    )
  );

-- Also make sure authenticated has INSERT on bills (defensive grant)
GRANT INSERT ON public.bills TO authenticated;
GRANT INSERT ON public.bill_shares TO authenticated;
GRANT INSERT ON public.bill_items TO authenticated;
GRANT INSERT ON public.bill_guest_participants TO authenticated;
