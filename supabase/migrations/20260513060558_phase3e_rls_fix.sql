-- Phase 3E RLS fix: break the circular reference between bills ↔ bill_shares policies.
--
-- Root cause: bills SELECT policy reads bill_shares, and bill_shares SELECT policy
-- reads bills → infinite recursion in PostgreSQL RLS.
--
-- Fix: a SECURITY DEFINER function that reads bills + bill_shares without RLS,
-- then all policies delegate to it instead of querying each other directly.

-- ─── Helper: is_bill_accessible ──────────────────────────────────────────────
-- Returns true if p_user_id may read the bill.
-- SECURITY DEFINER → runs as function owner, bypasses RLS, breaks the loop.

create or replace function public.is_bill_accessible(p_bill_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.bills b
    where b.id = p_bill_id
      and (
        -- hangout bill: must be a hangout participant
        (b.hangout_id is not null
          and is_hangout_participant(b.hangout_id, p_user_id))
        or
        -- standalone bill: creator or a user-type participant
        (b.hangout_id is null and (
          b.created_by = p_user_id
          or exists (
            select 1 from public.bill_shares bs
            where bs.bill_id = p_bill_id
              and bs.user_id = p_user_id
          )
        ))
      )
  )
$$;

grant execute on function public.is_bill_accessible(uuid, uuid) to authenticated;

-- ─── bills: replace the recursive policy ─────────────────────────────────────

drop policy if exists "participants read bills" on public.bills;

create policy "participants read bills"
  on public.bills for select
  using (is_bill_accessible(id, auth.uid()));

-- ─── bill_shares: replace the old policy (which read bills directly) ──────────

drop policy if exists "participants read shares" on public.bill_shares;

create policy "participants read shares"
  on public.bill_shares for select
  using (is_bill_accessible(bill_id, auth.uid()));

-- ─── bill_items: fix the select policy to use helper ─────────────────────────

drop policy if exists "see items if can see bill" on public.bill_items;

create policy "see items if can see bill"
  on public.bill_items for select
  using (is_bill_accessible(bill_id, auth.uid()));

-- ─── bill_guest_participants: fix the select policy ──────────────────────────

drop policy if exists "see guests if can see bill" on public.bill_guest_participants;

create policy "see guests if can see bill"
  on public.bill_guest_participants for select
  using (is_bill_accessible(bill_id, auth.uid()));

-- ─── bill_item_assignments: fix the select policy ────────────────────────────

drop policy if exists "see assignments if can see bill" on public.bill_item_assignments;

create policy "see assignments if can see bill"
  on public.bill_item_assignments for select
  using (
    exists (
      select 1 from public.bill_items i
      where i.id = item_id
        and is_bill_accessible(i.bill_id, auth.uid())
    )
  );
