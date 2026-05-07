# Phase 3D — Bills / expense splitting

## Prereq
Phase 3.0 (push + realtime). 3A and 3B are useful but not strictly
required.

## What we're building
Per-hangout expense tracking with smart split logic and debt
simplification. The "Splitwise" half of the value prop.

Scope for v1:
- Add a bill (who paid, amount, what for, who shares it, how to split)
- See running balances per person across all hangouts and per hangout
- Mark debts as paid (settled)
- Simplify debts within a hangout group (greedy algorithm)
- Receipts (photo attachment per bill)

NOT in 3D for v1:
- Multi-currency (USD only)
- Cross-hangout settle-up flows (each hangout settles independently)
- Recurring bills
- Connect to Venmo/CashApp/Zelle (we just track who-owes-who)
- Categories (just "what for" free text)

## Database

### `bills` table
```sql
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  payer_id uuid not null references auth.users(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  description text not null check (length(description) > 0 and length(description) <= 200),
  paid_at timestamptz not null default now(),     -- when the payer paid
  receipt_storage_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text
);

create index bills_hangout_idx on public.bills(hangout_id, paid_at desc);
create index bills_payer_idx on public.bills(payer_id);

alter table public.bills enable row level security;

create policy "participants read bills"
  on public.bills for select
  using (is_hangout_participant(hangout_id, auth.uid()));

create policy "participants insert bills"
  on public.bills for insert
  with check (
    auth.uid() = created_by
    and is_hangout_participant(hangout_id, auth.uid())
  );

create policy "creator can edit unsettled bills"
  on public.bills for update
  using (
    auth.uid() = created_by
    and voided_at is null
    and not exists (
      select 1 from public.bill_shares bs
      where bs.bill_id = id and bs.settled_at is not null
    )
  );
```

### `bill_shares` table — who owes how much for each bill
```sql
create table public.bill_shares (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  -- equal | percent | exact | shares (weights)
  split_method text not null check (split_method in ('equal', 'percent', 'exact', 'shares')),
  weight numeric(10, 4),  -- only used when split_method = 'shares' or 'percent'
  settled_at timestamptz,
  settled_by uuid references auth.users(id),
  settle_note text,
  created_at timestamptz not null default now(),
  unique (bill_id, user_id)
);

create index bill_shares_bill_idx on public.bill_shares(bill_id);
create index bill_shares_user_idx on public.bill_shares(user_id);
create index bill_shares_unsettled_idx on public.bill_shares(user_id, settled_at)
  where settled_at is null;

alter table public.bill_shares enable row level security;

create policy "hangout participants read shares"
  on public.bill_shares for select
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
      and is_hangout_participant(b.hangout_id, auth.uid())
    )
  );

create policy "bill creator inserts shares"
  on public.bill_shares for insert
  with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
      and b.created_by = auth.uid()
    )
  );

-- Settling: ower marks themselves paid, OR payer marks ower paid
create policy "owers + payers can settle"
  on public.bill_shares for update
  using (
    auth.uid() = user_id  -- I owe and I paid
    or exists (
      select 1 from public.bills b
      where b.id = bill_id and b.payer_id = auth.uid()  -- I'm payer, I'm marking received
    )
  );
```

### View: `v_user_balances` — net balance per user per hangout
```sql
create or replace view public.v_user_balances as
with paid as (
  select
    b.hangout_id,
    b.payer_id as user_id,
    sum(b.amount_cents) as paid_cents
  from public.bills b
  where b.voided_at is null
  group by 1, 2
),
owed as (
  select
    b.hangout_id,
    bs.user_id,
    sum(bs.amount_cents) as owed_cents
  from public.bill_shares bs
  join public.bills b on b.id = bs.bill_id
  where bs.settled_at is null and b.voided_at is null
  group by 1, 2
),
all_users as (
  select hangout_id, user_id from paid
  union
  select hangout_id, user_id from owed
)
select
  au.hangout_id,
  au.user_id,
  coalesce(p.paid_cents, 0) as paid_cents,
  coalesce(o.owed_cents, 0) as owed_cents,
  coalesce(p.paid_cents, 0) - coalesce(o.owed_cents, 0) as net_cents
from all_users au
left join paid p on p.hangout_id = au.hangout_id and p.user_id = au.user_id
left join owed o on o.hangout_id = au.hangout_id and o.user_id = au.user_id;

-- View RLS: matches participant scope
grant select on public.v_user_balances to authenticated;
```

### Postgres function: simplified payments
```sql
-- Returns minimum set of payments to settle a hangout's net balances.
-- Uses greedy algorithm: largest creditor paid by largest debtor first.
create or replace function public.simplify_hangout_debts(p_hangout_id uuid)
returns table(from_user uuid, to_user uuid, amount_cents bigint)
language plpgsql
security definer
as $$
declare
  v_balances record;
  v_creditors record[];
  v_debtors record[];
  v_creditor_idx int;
  v_debtor_idx int;
  v_amount bigint;
begin
  -- Validate caller is participant
  if not is_hangout_participant(p_hangout_id, auth.uid()) then
    raise exception 'not a participant';
  end if;

  -- Collect non-zero balances
  -- (Implementation: build sorted arrays in plpgsql — see test plan)
  -- Greedy match largest credit with largest debt; emit payment;
  -- subtract; repeat until all zero.
  -- Pseudocode:
  --   while creditors and debtors both non-empty:
  --     amt = min(creditor[0].balance, abs(debtor[0].balance))
  --     emit (debtor[0], creditor[0], amt)
  --     creditor.balance -= amt; debtor.balance += amt
  --     if creditor.balance == 0: pop creditor
  --     if debtor.balance == 0: pop debtor
  -- Return final list of payments.
  -- (Claude Code implements; this is a documented function spec.)
  return;
end;
$$;
```

Note to Claude Code: implementing greedy debt simplification in plpgsql is
a bit tedious. Acceptable alternative: implement in TypeScript (in
`bills.service.ts`) and call from the client. Either works for v1. The
trade-off: if you ever add a "simplify all debts globally" feature later,
SQL function is reusable. For now, TypeScript is easier to test.

**Default decision: implement in TypeScript** unless Claude Code prefers
the SQL approach.

### Trigger: notify on bill added
```sql
create or replace function public.notify_bill_inserted()
returns trigger as $$
declare
  v_recipients uuid[];
  v_payer_name text;
begin
  -- Notify everyone who owes a share
  select array_agg(user_id) into v_recipients
  from public.bill_shares
  where bill_id = new.id and user_id != new.created_by;

  if v_recipients is null then return new; end if;

  select display_name into v_payer_name from public.profiles where id = new.payer_id;

  perform extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'userIds', v_recipients,
      'type', 'bill_added',
      'refId', new.hangout_id,
      'title', 'New bill: ' || new.description,
      'body', coalesce(v_payer_name, 'Someone') || ' paid $' || (new.amount_cents / 100.0)::text,
      'data', jsonb_build_object('billId', new.id, 'hangoutId', new.hangout_id)
    )::text
  );

  return new;
end;
$$ language plpgsql security definer;

-- Note: trigger fires on AFTER INSERT of bill, but bill_shares may not exist yet.
-- Better: trigger on bill_shares INSERT, dedup by bill_id (one push per bill).
-- Or: explicitly call send-push from the client AFTER both bill + shares are inserted.
-- Default: client-side notification call after the transaction completes.
```

## Split methods

### Equal (default)
Amount divided evenly among N participants. If $30 / 3, each = $10.
If $30 / 7, base = 4.28..., remainder cents distributed to first M people:
$4.29, $4.29, $4.28, $4.28, $4.28, $4.28, $4.28 (sum = $30.00, no
rounding loss).

### Percent
Each person assigned a %. Must total 100%. UI prevents save until total = 100.
Server validates.

### Exact
Each person assigned an exact amount. Must total bill amount. UI shows
running total + delta.

### Shares (weights)
Each person assigned an integer weight (1, 2, 3...). Total cents
distributed proportionally; remainder cents go to highest-weight people.

All four methods produce a list of `{ user_id, amount_cents }` that sums
EXACTLY to the bill total. Never round in a way that loses cents. Use
the "remainder distribution" pattern for fairness.

Implement in `src/features/bills/utils/split.ts`. Unit-test the helpers.

## UI / screens

### `app/hangout/[id]/bills.tsx` — replace stub

Layout:
```
┌─────────────────────────────┐
│ ← Bills           [+ Add]   │
├─────────────────────────────┤
│ Net for you                 │
│ ┌─────────────────────────┐ │
│ │ +$24.50 owed to you     │ │  green if positive
│ └─────────────────────────┘ │  red if negative
│                             │
│ Settle up                   │
│  Mike → You: $12.00 [Settle]│
│  You → Sarah: $5.00 [Mark paid]
│                             │
│ All bills                   │
│  Apr 14                     │
│   🍕 Pizza            $30   │
│   You paid • split equally  │
│   ━━━━━━━━━━━━━━━━━━━━     │
│   🍻 Bar tab          $80   │
│   Mike paid • exact split   │
└─────────────────────────────┘
```

### Add bill flow (modal stack or dedicated screen)

`app/hangout/[id]/bills/new.tsx`

Steps:
1. **Amount + description** — number pad keyboard, autoFocus. Free-text "for what"
2. **Payer** — defaults to current user, pickable from participants
3. **Who shares** — multi-select of participants (defaults to all)
4. **How to split** — Equal / Percent / Exact / Shares
   - Per-method UI for entering details
   - Live preview of each person's share
   - "Total: $X.XX" with red if mismatched
5. **Receipt photo** — optional, opens camera / library
6. **Review + Save** — sticky bottom button

### Components
- `BillCard` — bill row with payer avatar, description, amount
- `BalanceBanner` — net for current user, color-coded
- `SimplifiedPayments` — list of "X owes Y $Z [Settle]" rows
- `BillDetailSheet` — modal showing full breakdown of a bill
- `SplitMethodPicker` — 4-option picker
- `ParticipantShareEditor` — per-method UI
- `BillReceiptViewer` — full-screen image of receipt

### Hooks
- `useBills(hangoutId)` — list bills with realtime
- `useBill(billId)` — single bill with shares
- `useUserBalance(hangoutId)` — net for current user (queries view)
- `useSimplifiedDebts(hangoutId)` — calls simplify function
- `useCreateBill()` — mutation, transactionally inserts bill + shares
- `useSettleShare()` — mark a share as paid
- `useVoidBill()` — soft-void if bill was created in error
- `useUploadReceipt()` — image upload to storage

### Storage bucket: `bill-receipts`
Same RLS pattern as `hangout-photos`. Path: `<hangout_id>/<bill_id>/<photo_id>.jpg`.

## Acceptance criteria

- [ ] Add a bill → all participants see it in real time
- [ ] Bill amounts split correctly (no rounding loss; sum equals total)
- [ ] Net balance banner correct for each user
- [ ] "Settle up" suggestions show simplified payments
- [ ] Tap "Settle" → marks share as paid → balance updates → push to other party
- [ ] Photo receipt attached → viewable by all participants
- [ ] Edit bill (only if no settlements yet) → updates everyone's balances
- [ ] Void bill → removes from balances, shown crossed-out in history
- [ ] All splits add up to bill total (constraint + UI + server validation)
- [ ] Payer cannot be a non-participant of the hangout
- [ ] Sharer cannot be a non-participant
- [ ] Push notification when added to a bill
- [ ] Push notification when someone settles with you ("Mike paid you $12")
- [ ] Bills survive hangout cancellation (do they? — see edge cases)

## Edge cases

- $0.01 split among 3 → one person owes $0.01, others $0
- $30 / 7 = 4.2857... → distribute remainder cents to first N people
- Percent split totaling 99.99% or 100.01% → block save with clear error
- Exact split with $0.01 mismatch → same
- Same user paid + sharer (Mike paid for himself + 3 others) → Mike's
  share row exists but his net balance only counts the others' shares
- User added to hangout AFTER bill exists → not on the bill, no share row
- User removed from hangout AFTER having a bill share → bill stays,
  share stays, user's balance still shows; settling still works
- Hangout deleted → cascade deletes bills + shares (right call?
  Alternative: keep bills around as a "bills history" feature later. For
  v1, cascade is simpler. Document this clearly.)
- User edits a bill after some shares settled → block edit
- User voids a bill after some shares settled → block void? Or refund?
  V1: block void if any share is settled.
- Two users settle simultaneously → both succeed (separate share rows)
- User tries to settle someone else's share they don't own → RLS blocks
- Receipt upload fails → bill saves without it, retry button on detail
- Currency mismatch — locked to USD, doesn't apply
- Negative amount — blocked by check constraint
- Description with emoji or unicode — fine
- Very long description (250 chars) — blocked at 200
- User leaves hangout (declines) — bill data preserved; balance still
  visible to them in profile (later feature). For v1, declining doesn't
  delete shares.
- Notification when bill paid → only to the OWED party, not actor

## File-by-file plan

### Database
- `supabase/migrations/<ts>_phase3d_bills.sql` — all tables, view, RLS,
  trigger, optional simplify function.
- Storage bucket `bill-receipts`.

### Feature folder
- `src/features/bills/types.ts`
- `src/features/bills/schemas/index.ts`
- `src/features/bills/utils/split.ts` — split calculators (equal, percent,
  exact, shares)
- `src/features/bills/utils/simplify.ts` — greedy debt simplification
- `src/features/bills/services/bills.service.ts`
- `src/features/bills/hooks/useBills.ts`
- `src/features/bills/hooks/useBill.ts`
- `src/features/bills/hooks/useUserBalance.ts`
- `src/features/bills/hooks/useSimplifiedDebts.ts`
- `src/features/bills/hooks/useCreateBill.ts`
- `src/features/bills/hooks/useSettleShare.ts`
- `src/features/bills/hooks/useVoidBill.ts`
- `src/features/bills/hooks/useUploadReceipt.ts`
- `src/features/bills/components/BillCard.tsx`
- `src/features/bills/components/BalanceBanner.tsx`
- `src/features/bills/components/SimplifiedPayments.tsx`
- `src/features/bills/components/BillDetailSheet.tsx`
- `src/features/bills/components/SplitMethodPicker.tsx`
- `src/features/bills/components/ParticipantShareEditor.tsx`
- `src/features/bills/components/BillReceiptViewer.tsx`
- `src/features/bills/index.ts`

### Routes
- `app/hangout/[id]/bills.tsx` — replace stub, main bills view
- `app/hangout/[id]/bills/new.tsx` — add bill flow
- `app/hangout/[id]/bills/[billId].tsx` — bill detail (or use
  BillDetailSheet modal — Claude Code's choice)

### Wiring
- Hangout detail screen → "Bills" entry point with running total badge

## Test plan

1. Migration applied; tables, view, RLS verified.
2. Three users in same hangout: Mike, Sarah, You.
3. Mike adds: $30 pizza, equal split among all 3 → each owes $10.
4. Sarah's banner: "$10 to Mike". Your banner: "$10 to Mike".
5. Mike's banner: "+$20 owed to you".
6. You: tap "Mark paid" on your $10 share → settles. Your banner shows $0
   for this hangout.
7. Mike sees: Sarah still owes him $10, you settled.
8. Sarah adds $80 bar tab, exact split (Mike $30, Sarah $30, You $20).
9. Net: You owe Sarah $20, Mike owes Sarah $30 (after his $20 from pizza).
10. Wait — let me redo: Mike paid $30 pizza, owed $10 from each = $20 net
    positive. Sarah paid $80 bar tab, owed $30 from Mike + $20 from You
    = $50 net positive. Mike owed Sarah $30 - his $20 credit = $10 owes Sarah.
    You owed Sarah $20.
11. Simplified payments view: "You → Sarah: $20", "Mike → Sarah: $10".
12. Mike settles his $30 share of bar tab → Sarah's view updates in real time.
13. RLS: log in as a non-participant, query bills/shares → empty.
14. Edit a bill that has 0 settlements → succeeds.
15. Try to edit a bill that has 1 settlement → blocked with clear error.
16. Try to set percent split to 99% total → save button disabled.
17. Photo receipt: upload, view, RLS test.

## Done when
- All acceptance criteria pass
- All split utility functions unit-tested (run `npm test`)
- `npx tsc --noEmit` clean
- Three-user test scenario above produces correct balances
- Migration committed: `git commit -m "Phase 3D: bills + expense splitting"`
