-- Fix: standalone bills (hangout_id IS NULL) were blocked by INSERT policy
-- because is_hangout_participant(null, uid) returns false.
-- The SELECT policy was already fixed in 3E; the INSERT policy was missed.

drop policy if exists "participants insert bills" on public.bills;

create policy "participants insert bills"
  on public.bills for insert
  with check (
    auth.uid() = created_by
    and (
      -- hangout bill: must be a participant
      (hangout_id is not null and is_hangout_participant(hangout_id, auth.uid()))
      -- standalone bill: creator check above is sufficient
      or hangout_id is null
    )
  );
