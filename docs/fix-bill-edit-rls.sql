-- Fix: bill_shares has no DELETE policy, so updateItemizedBill's delete is
-- silently blocked by RLS, old shares remain, and the insert hits the
-- bill_shares_unique_user unique index.
-- Safe to re-run.

-- Allow the bill creator to delete shares as long as no share is settled.
-- Matches the same guard already on the bills UPDATE policy.
DROP POLICY IF EXISTS "bill creator deletes shares" ON public.bill_shares;

CREATE POLICY "bill creator deletes shares"
  ON public.bill_shares FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_id
        AND b.created_by = auth.uid()
        AND NOT EXISTS (
          SELECT 1 FROM public.bill_shares bs2
          WHERE bs2.bill_id = b.id
            AND bs2.settled_at IS NOT NULL
        )
    )
  );

-- Also allow deletion of guest participants when creator edits the bill.
DROP POLICY IF EXISTS "bill creator deletes guests" ON public.bill_guest_participants;

CREATE POLICY "bill creator deletes guests"
  ON public.bill_guest_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_id
        AND b.created_by = auth.uid()
    )
  );
