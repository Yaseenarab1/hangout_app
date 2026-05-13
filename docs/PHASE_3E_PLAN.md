# Phase 3E — Receipt OCR + item-level bill splitting + standalone bills

## Prereq
- Phase 3D complete and committed (basic bills + manual split methods).
- `CLAUDE_MD_ADDENDUM.md` patterns merged into `CLAUDE.md`.
- Google Cloud Vision API enabled on the existing Google Cloud project.
- Secret `GOOGLE_CLOUD_VISION_API_KEY` set in Supabase.

## What we're building

Three big additions on top of the existing 3D bills feature:

1. **Receipt OCR + item-by-item assignment.** User photographs a
   receipt → app reads the line items via Google Cloud Vision → user
   reviews/edits items → assigns each item to one or more people →
   tax + tip distribute proportionally.
2. **Standalone bills.** Split a bill that isn't attached to a hangout.
   Accessible via a floating action button on Home. Supports "guest"
   participants who aren't users.
3. **Manual fallback at every step.** OCR can be skipped. Items can be
   added manually. Existing 3D manual-split flow stays as one of the
   options.

NOT in 3E:
- Receipt OCR for non-English receipts
- Auto-categorize items (food / drink / dessert)
- Receipt history / searchable past receipts
- Itemized splits being editable after settlement begins (block edits
  once any share is settled, same as 3D)
- Linking guests to friends later (if a guest later joins the app,
  they're still just a label on the historical bill)

## Database additions

### `bills` table — modifications
```sql
-- Allow standalone bills (no hangout)
alter table public.bills
  alter column hangout_id drop not null;

-- Track bill mode: whole-amount (3D classic) vs itemized (3E)
alter table public.bills
  add column if not exists mode text not null default 'whole'
    check (mode in ('whole', 'itemized'));

-- Track if this is a standalone bill
-- (Could be inferred from hangout_id IS NULL, but explicit flag is clearer
--  for RLS and queries. Pick one and stick with it. Default: inferred.)

-- Store tax + tip as separate fields for itemized bills
-- (3D had tax/tip baked into the bill total; 3E breaks them out)
alter table public.bills
  add column if not exists subtotal_cents bigint check (subtotal_cents is null or subtotal_cents >= 0),
  add column if not exists tax_cents bigint check (tax_cents is null or tax_cents >= 0),
  add column if not exists tip_cents bigint check (tip_cents is null or tip_cents >= 0);

-- Backfill existing 3D bills: subtotal = amount_cents, tax/tip = null
update public.bills
set subtotal_cents = amount_cents
where subtotal_cents is null;

-- Constraint: if itemized, subtotal + tax + tip must equal amount_cents
-- (NOT a hard constraint — receipt totals don't always match exactly
--  due to fees/discounts. Validate in app logic, warn user.)

-- RLS for standalone bills (hangout_id IS NULL):
-- Only the creator and any user participant can read
drop policy if exists "participants read bills" on public.bills;
create policy "participants read bills"
  on public.bills for select
  using (
    (hangout_id is not null and is_hangout_participant(hangout_id, auth.uid()))
    or
    (hangout_id is null and (
      created_by = auth.uid()
      or auth.uid() in (
        select user_id from public.bill_shares where bill_id = bills.id and user_id is not null
      )
    ))
  );
```

### `bill_items` table — line items on an itemized bill
```sql
create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  description text not null check (length(description) > 0 and length(description) <= 200),
  amount_cents bigint not null check (amount_cents >= 0),
  quantity int not null default 1 check (quantity > 0 and quantity <= 99),
  -- 'ocr' | 'manual' — for analytics + UI hints
  source text not null default 'manual' check (source in ('ocr', 'manual')),
  -- Position in the receipt, used for stable ordering during review
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index bill_items_bill_idx on public.bill_items(bill_id, position);

alter table public.bill_items enable row level security;

create policy "see items if can see bill"
  on public.bill_items for select
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
      -- delegate to bills SELECT policy
    )
  );

create policy "creator manages items"
  on public.bill_items for insert
  with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and b.created_by = auth.uid()
    )
  );

create policy "creator updates items"
  on public.bill_items for update
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and b.created_by = auth.uid()
    )
  );

create policy "creator deletes items"
  on public.bill_items for delete
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and b.created_by = auth.uid()
    )
  );
```

### `bill_guest_participants` table — non-user participants
```sql
create table public.bill_guest_participants (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  name text not null check (length(name) > 0 and length(name) <= 60),
  created_at timestamptz not null default now()
);

create index bill_guest_participants_bill_idx on public.bill_guest_participants(bill_id);

alter table public.bill_guest_participants enable row level security;

create policy "see guests if can see bill"
  on public.bill_guest_participants for select
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id
    )
  );

create policy "creator manages guests"
  on public.bill_guest_participants for all
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_id and b.created_by = auth.uid()
    )
  );
```

### `bill_shares` table — modifications for guests
```sql
-- Allow user_id OR guest_participant_id (one must be set, not both)
alter table public.bill_shares
  alter column user_id drop not null;

alter table public.bill_shares
  add column if not exists guest_participant_id uuid
    references public.bill_guest_participants(id) on delete cascade;

alter table public.bill_shares
  add constraint bill_shares_user_or_guest_check
  check (
    (user_id is not null and guest_participant_id is null)
    or (user_id is null and guest_participant_id is not null)
  );

-- Update unique constraint
alter table public.bill_shares drop constraint if exists bill_shares_bill_id_user_id_key;
create unique index bill_shares_unique_user on public.bill_shares(bill_id, user_id)
  where user_id is not null;
create unique index bill_shares_unique_guest on public.bill_shares(bill_id, guest_participant_id)
  where guest_participant_id is not null;

-- Guests can't settle (no auth). The bill creator marks guest shares
-- as settled (the creator is the one who collected cash from them).
drop policy if exists "owers + payers can settle" on public.bill_shares;
create policy "owers + payers + creator can settle"
  on public.bill_shares for update
  using (
    -- ower settles their own (user shares only)
    (auth.uid() = user_id)
    -- payer marks ower paid
    or exists (
      select 1 from public.bills b
      where b.id = bill_id and b.payer_id = auth.uid()
    )
    -- creator settles guest shares
    or (guest_participant_id is not null and exists (
      select 1 from public.bills b
      where b.id = bill_id and b.created_by = auth.uid()
    ))
  );
```

### `bill_item_assignments` table — who shares each item
```sql
create table public.bill_item_assignments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.bill_items(id) on delete cascade,
  -- Reference EITHER a user OR a guest, mirroring bill_shares
  user_id uuid references auth.users(id) on delete cascade,
  guest_participant_id uuid references public.bill_guest_participants(id) on delete cascade,
  -- 'equal' (split this item evenly among assignees) or 'percent' (each
  -- assignee has a weight, sum = 100)
  weight numeric(7, 4) not null default 1.0 check (weight > 0),
  created_at timestamptz not null default now(),
  check (
    (user_id is not null and guest_participant_id is null)
    or (user_id is null and guest_participant_id is not null)
  )
);

create index bill_item_assignments_item_idx on public.bill_item_assignments(item_id);
create unique index bill_item_assignments_unique_user
  on public.bill_item_assignments(item_id, user_id)
  where user_id is not null;
create unique index bill_item_assignments_unique_guest
  on public.bill_item_assignments(item_id, guest_participant_id)
  where guest_participant_id is not null;

alter table public.bill_item_assignments enable row level security;

create policy "see assignments if can see bill"
  on public.bill_item_assignments for select
  using (
    exists (
      select 1 from public.bill_items i
      join public.bills b on b.id = i.bill_id
      where i.id = item_id
    )
  );

create policy "creator manages assignments"
  on public.bill_item_assignments for all
  using (
    exists (
      select 1 from public.bill_items i
      join public.bills b on b.id = i.bill_id
      where i.id = item_id and b.created_by = auth.uid()
    )
  );
```

### Computed share totals
The math: for an itemized bill, each participant's owed amount is:

```
(sum of their share of each item)
+ (their item subtotal / bill subtotal) * tax
+ (their item subtotal / bill subtotal) * tip
```

This is computed CLIENT-SIDE when the user finalizes the bill, then
inserted as `bill_shares.amount_cents`. After finalization, the bill
behaves like any other bill — balances, settlements, etc., all work
through existing 3D infrastructure.

**Implementation note:** there's a temptation to compute shares on
every render (live preview). Do that for the preview. Only INSERT into
`bill_shares` when user taps "Save bill."

## Edge functions

### `scan-receipt` — OCR via Google Cloud Vision
`supabase/functions/scan-receipt/index.ts`

```ts
// Input (POST body):
//   { imageBase64: string }  // ≤ 10MB
// or
//   { imageUrl: string }      // signed URL from Supabase storage

// Output:
//   {
//     items: Array<{
//       description: string;
//       amountCents: number;
//       quantity: number;
//       position: number;
//     }>;
//     subtotalCents: number | null;
//     taxCents: number | null;
//     tipCents: number | null;
//     totalCents: number | null;
//     confidence: 'high' | 'medium' | 'low';
//     rawText: string;  // for debugging
//   }

// Steps:
// 1. Auth check (user must be authenticated)
// 2. Resize image if > 4MB to keep Vision API happy
// 3. Call Vision API:
//    POST https://vision.googleapis.com/v1/images:annotate
//    Body: {
//      requests: [{
//        image: { content: <base64> } OR { source: { imageUri: <url> } },
//        features: [{ type: 'TEXT_DETECTION', maxResults: 50 }]
//      }]
//    }
// 4. Parse response:
//    - Extract all text annotations with bounding boxes
//    - Sort by Y position (top to bottom), then X position
//    - Find price-shaped strings: /\$?\d+\.\d{2}/
//    - For each price, find nearest text to the left on same Y line
//      → that's the item description
//    - Identify TAX / TIP / TOTAL / SUBTOTAL lines by keyword
//      ("tax", "tip", "gratuity", "total", "subtotal" case-insensitive)
// 5. Compute confidence:
//    - HIGH: found ≥ 3 items, total reconciles with sum within 1%
//    - MEDIUM: found items, but total doesn't reconcile
//    - LOW: found < 3 items or no prices detected
// 6. Return parsed JSON. NEVER throw on parsing — return what we got
//    and let the UI handle low-quality results gracefully.
```

CORS: standard CORS headers for client invocation, matching other edge
functions in the project.

### Receipt parser — separate module
`supabase/functions/scan-receipt/parser.ts`

Write the parsing logic as a pure function so it's testable:
```ts
export function parseReceiptText(
  blocks: VisionTextBlock[],
): ParsedReceipt;
```

Unit-test this with sample receipt outputs (the user is unlikely to
write tests but Claude Code should write at least 3-5 sample cases).

## Storage

### Bucket: `bill-receipts` (already exists from 3D)
Path for itemized bill receipts:
`<bill_id>/receipt.jpg`

Add a "scan-only" path for temporary OCR images that aren't kept as the
bill's receipt:
`scan-temp/<user_id>/<uuid>.jpg`
- Use signed URL with 1-hour expiry
- Cleanup job: delete files in `scan-temp/` older than 24 hours
  (defer cleanup job to ops; not in 3E scope)

## UI / screens

### Standalone bill entry point — Home FAB

`src/components/HomeFab.tsx` (or wherever home content lives)
- Floating action button bottom-right above tab bar
- Tap opens action sheet (Modal pageSheet)
- Action sheet content for v1:
  - "📷 Split a bill" — opens `/bill/new`
- Sheet has obvious dismiss (swipe down, tap outside, X button)

### `app/bill/new.tsx` — entry screen (standalone OR hangout-attached)

Layout:
```
┌─────────────────────────────┐
│ ← Split a bill              │
├─────────────────────────────┤
│                             │
│   ┌─────────────────────┐   │
│   │                     │   │
│   │   📷 Take a photo   │   │
│   │  of your receipt    │   │
│   │                     │   │
│   └─────────────────────┘   │
│                             │
│   ┌─────────────────────┐   │
│   │  Upload from album  │   │
│   └─────────────────────┘   │
│                             │
│   Or just enter it manually │
│   [Enter manually →]        │
│                             │
│   Tip: take the photo in    │
│   good light, flat on a     │
│   table. We'll read each    │
│   item — you can edit       │
│   anything before splitting.│
└─────────────────────────────┘
```

Small-print explainer text at the bottom. This is the "tell the user how
it works" requirement.

### After photo capture → OCR loading state

```
┌─────────────────────────────┐
│ Reading your receipt…       │
│   [spinner]                 │
│                             │
│ [thumbnail of receipt]      │
│                             │
│ This usually takes 5-10     │
│ seconds                     │
│                             │
│ [Cancel]                    │
└─────────────────────────────┘
```

If OCR takes > 30s → time out, show "Couldn't read receipt — try again
or enter manually."

### After OCR → review items

```
┌─────────────────────────────┐
│ ← Review items     [+ Add]  │
├─────────────────────────────┤
│ We found 8 items.           │
│ Tap to edit. Add any we     │
│ missed.                     │
├─────────────────────────────┤
│ 🍕 Margherita    $14.00 [×] │
│ 🍕 Pepperoni     $16.00 [×] │
│ 🍷 House red     $12.00 [×] │
│ ...                         │
│ ─────────────────────       │
│ Subtotal         $76.00     │
│ Tax              $6.84      │
│ Tip              $11.40 [+] │
│ Total            $94.24     │
├─────────────────────────────┤
│ [Continue: split with people]│
└─────────────────────────────┘
```

Each item tappable → small inline edit (description + amount).
Each item has × to delete.
"[+ Add]" button at the bottom of items list.
Tax and tip rows are editable + each has a "[+]" button if they weren't
parsed.

Subtotal auto-updates as items change.

### After review → pick participants

```
┌─────────────────────────────┐
│ ← Who's splitting?          │
├─────────────────────────────┤
│ You (always included)       │
│                             │
│ Friends                     │
│ ☑ Mike                      │
│ ☐ Sarah                     │
│ ☑ Alex                      │
│                             │
│ Or add a guest              │
│ [+ Add guest by name]       │
│                             │
│ Guests on this bill         │
│ • Cousin Tom        [×]     │
│                             │
└─────────────────────────────┘
[Continue: assign items →]
```

For STANDALONE bills (no hangout): all friends + "add guest" available.
For HANGOUT bills: hangout participants are auto-listed + "add guest."

### Then → item-by-item assignment

This is the core UX. One item at a time. Swipeable left/right.

```
┌─────────────────────────────┐
│ Item 3 of 8         [⋯ All] │  <- "All" jumps to overview
│ ━━━━━━━ ▮ ━━━━━━━━━━━       │  <- progress
├─────────────────────────────┤
│  🍷 House red               │
│         $12.00              │
├─────────────────────────────┤
│ Who got this?               │
│                             │
│ [You]    [Mike]   [Sarah]   │  <- big tappable chips
│ [Alex]   [Cousin Tom]       │     selected = filled purple
│                             │
│ ┌─────────────────────────┐ │
│ │ Split equally between   │ │  <- mini-toggle if > 1 selected
│ │ selected:               │ │
│ │  • You: $6              │ │
│ │  • Mike: $6             │ │
│ │ [Equal] [Custom]        │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│  ← Previous       Next →    │
└─────────────────────────────┘
```

Multi-select via tapping chips. Selected = filled with brand color.

If > 1 selected → show split preview:
- Default: equal split among selected
- Tap "Custom" → enter % per person, must total 100

Swipe horizontally OR tap Next/Previous to navigate items.

**[All] button** opens the item overview screen — see every item with
its assigned people, jump to any item.

### Item overview screen
```
┌─────────────────────────────┐
│ ← All items                 │
├─────────────────────────────┤
│ ✓ Margherita    Mike        │
│ ✓ Pepperoni     You, Sarah  │
│ ✓ House red     Equal: all  │
│ ⚠ Salad         Not assigned│
│ ...                         │
├─────────────────────────────┤
│ Continue: review totals →   │
└─────────────────────────────┘
```

Unassigned items get a warning. Continue button disabled if any items
unassigned (or show prompt: "You have 1 unassigned item. Assign it or
remove it.").

### Finally → totals review

```
┌─────────────────────────────┐
│ ← Final totals              │
├─────────────────────────────┤
│ Items                $76.00 │
│ Tax (proportional)    $6.84 │
│ Tip (proportional)   $11.40 │
│ ─────────────────────       │
│ Total                $94.24 │
├─────────────────────────────┤
│ Who pays what               │
│ You         $32.16          │
│ Mike        $24.48          │
│ Sarah       $18.42          │
│ Cousin Tom  $19.18          │
├─────────────────────────────┤
│ Description of bill         │
│ [Sunday dinner]             │
│                             │
│ Who paid? [You ▼]           │
│                             │
│ [Save bill]                 │
└─────────────────────────────┘
```

Editable: description (required), who paid (default current user).

Tax and tip distribution shown with "(proportional)" small-print so user
understands the math. Tappable to see formula:

> "Tax and tip are split based on what each person ordered. If you
> ordered more, you pay more tax and tip on it."

### Manual entry fallback

If user taps "Enter manually" from the entry screen → goes straight to
the EXISTING 3D bill entry flow. No changes needed. The 3D flow is
preserved as the manual path.

### Bills overview in Profile

`app/profile/bills.tsx` — new screen

Shows:
- Total balance across all bills (sum of net positives - net negatives)
- "Bills owed to you" list (across all hangouts + standalone)
- "Bills you owe" list
- Tap a bill → bill detail screen (reuses 3D's BillDetailSheet)
- Tab toggle: "All" / "Standalone" / "From hangouts"

Entry point: Profile screen → new row "Bills" with chevron + running
total badge.

## Components

### New components
- `src/features/bills/components/ReceiptCapture.tsx` — camera + library picker, photo preview
- `src/features/bills/components/ReceiptScanProgress.tsx` — loading + thumbnail + cancel
- `src/features/bills/components/ItemsReview.tsx` — editable list of OCR items + add/remove
- `src/features/bills/components/ItemEditor.tsx` — inline edit a single item
- `src/features/bills/components/ParticipantPicker.tsx` — pick friends + add guests (standalone) OR auto-list hangout members
- `src/features/bills/components/GuestAddSheet.tsx` — quick "add a guest by name" sheet
- `src/features/bills/components/ItemAssigner.tsx` — the swipeable one-item-at-a-time UI
- `src/features/bills/components/ItemAssignmentOverview.tsx` — all items + assignees grid
- `src/features/bills/components/SplitPreview.tsx` — live preview of who-pays-what
- `src/features/bills/components/FinalTotals.tsx` — summary screen
- `src/features/bills/components/SmallPrintExplainer.tsx` — reusable disclosure text
- `src/components/HomeFab.tsx` — floating action button on home
- `src/components/HomeFabSheet.tsx` — bottom sheet for FAB actions

### New hooks
- `src/features/bills/hooks/useScanReceipt.ts` — calls scan-receipt edge function, returns parsed result
- `src/features/bills/hooks/useCreateItemizedBill.ts` — creates bill + items + guests + assignments in one transaction
- `src/features/bills/hooks/useMyBills.ts` — list bills across all hangouts + standalone (for profile screen)
- `src/features/bills/hooks/useBillGuests.ts` — list/add/remove guests on a bill

### New utility functions
- `src/features/bills/utils/proportional-split.ts` — distribute tax/tip proportionally across item subtotals, no cents lost
- `src/features/bills/utils/compute-item-shares.ts` — given items + assignments, return per-person totals
- `src/features/bills/utils/parse-money.ts` — robust money string parsing (handles "$12.50", "12.50", "12,50", etc.)

## Routes

- `app/bill/new.tsx` — entry screen (photo / upload / manual)
- `app/bill/scan.tsx` — scanning state (while OCR runs)
- `app/bill/review-items.tsx` — review/edit OCR results
- `app/bill/participants.tsx` — pick who's splitting
- `app/bill/assign.tsx` — item-by-item assignment (or overview mode)
- `app/bill/totals.tsx` — final review + save
- `app/profile/bills.tsx` — bills overview in profile

For hangout-attached bills, the entry can also be `/hangout/<id>/bill/new` — but reuse the same screens with a route param signal. Same flow, just creates with `hangout_id` set instead of null.

## Acceptance criteria

### OCR flow
- [ ] Tap FAB on home → "Split a bill" sheet
- [ ] Tap "Split a bill" → entry screen with photo / upload / manual
- [ ] Take photo of a real receipt → OCR runs in < 10s → review screen
      with items prepopulated
- [ ] At least one item from a clear receipt is correctly parsed
      (description + price)
- [ ] Edit an OCR item → saved correctly
- [ ] Add a new item via "+ Add" → appears at bottom
- [ ] Delete an item via × → gone, subtotal updates
- [ ] OCR fails (network) → friendly fallback, manual entry still works
- [ ] Receipt is unreadable / blurry → app says "Couldn't read this — try
      again or enter manually," doesn't crash

### Participant picking
- [ ] Standalone bill → friends list + add guest works
- [ ] Hangout bill → auto-lists participants + add guest works
- [ ] Guest with same name as another guest is allowed (separate rows)
- [ ] You are always auto-included

### Item assignment
- [ ] Swipe to next/previous item works
- [ ] Tap chips to select multiple → equal split preview shown
- [ ] Switch to "Custom" split → enter percentages → must total 100,
      blocked otherwise
- [ ] [All] button → overview, jump to any item
- [ ] Unassigned items → warning + Continue blocked

### Totals + save
- [ ] Tax + tip distributed proportionally (verify math:
      if Mike's items = 50% of subtotal, his tax = 50% of total tax)
- [ ] Cents add up exactly (no rounding loss)
- [ ] Save creates bill + items + guests + shares in one transaction
- [ ] After save, bill appears in profile bills + hangout bills (if attached)
- [ ] Bill detail screen renders itemized bills correctly (shows items, not just total)

### Standalone bills
- [ ] Standalone bill saved → not in any hangout's bill list
- [ ] Standalone bill visible only to creator + user participants (not guests)
- [ ] Profile → Bills shows standalone alongside hangout bills
- [ ] Creator can mark guest shares as paid
- [ ] Other user participants cannot mark guest shares as paid (RLS)

### Notifications
- [ ] When standalone bill saved, user participants get push (not guests)
- [ ] Push deep-links to bill detail in profile

### Small print
- [ ] Entry screen has "Tip: take in good light..." explainer
- [ ] Totals screen explains proportional tax/tip math

## Edge cases

### OCR
- Receipt is rotated 90° / 180° → parser handles via position sort, but
  request user retake if confidence is LOW
- Receipt has handwritten notes → ignored by Vision; no special handling
- Two items on same line ("2x Beer  $12") → quantity field, parse "2x"
  pattern
- Receipt in non-USD currency → parse as numbers, user corrects
- Receipt has discount line ("-$5 off") → parsed as negative item OR
  ignored (default: parse as item with negative amount; UI shows as
  green discount)
- Server fees / service charges → treat like tax (proportional split)
  if user adds them as a non-item line. V1: surface as a separate field
  alongside tax/tip.
- OCR returns nothing usable → empty review screen, friendly message
  "Hmm, couldn't read this. Add items manually below," manual flow
  works fine
- Receipt photo > 10MB → resize client-side before upload (use
  expo-image-manipulator)
- Image upload fails → retry button
- Vision API quota exceeded → graceful error, fallback to manual

### Item assignment
- User selects 0 people for an item → item unassigned (warning)
- User selects everyone → equal split (fine)
- Custom % doesn't total 100 → save button disabled, red banner
  "Doesn't add up: 95%"
- User deletes a participant after assigning items → their items become
  unassigned (warning shown, can reassign or delete)
- Item amount is $0 → allowed (some receipts have $0 line items for
  free items like bread)
- Item amount is negative (discount) → allowed; assigned-to people get
  a credit

### Standalone bills
- User creates standalone bill with 0 other participants (just themself)
  → why are you splitting? Block with friendly error.
- Guest name with emoji → allowed
- Guest name 61+ chars → blocked client + DB
- User adds same guest twice → separate rows (might be different people
  with same name)
- User attached a hangout to a standalone bill mid-flow → not supported
  in v1. Standalone stays standalone, hangout bill is a separate flow.
- Standalone bill on Profile screen when user has 0 bills → empty state

### Money math
- Tax doesn't reconcile with item sum (receipt shows tax = $5.99 but
  sum of items × tax rate = $6.01) → trust the user-entered tax,
  distribute proportionally
- Tip is 18.5% but user entered $14.07 → trust the dollar amount
- Subtotal + tax + tip ≠ total on receipt → warn user, let them
  proceed (real receipts often have fees / rounding)
- All items $0 but tax > 0 → split tax equally among assigned people
- User changes tax/tip AFTER assignment → recompute, no problem
- Three people splitting $0.07 → first person gets $0.03, others $0.02

### Misc
- User aborts mid-flow → no orphan records (only insert on Save)
- User backgrounds app during OCR → cancel request, show retry
- User has 0 friends + standalone bill → only guests available
- Receipt scanned twice in a row → two separate bills (no dedup)
- User uploads non-receipt image (selfie) → Vision returns no items,
  fallback to manual entry
- FAB position blocks content → tappable area excludes the FAB region

## File-by-file plan

### Database
- `supabase/migrations/<ts>_phase3e_itemized_bills.sql` — all schema
  changes for bills/items/guests/assignments

### Edge functions
- `supabase/functions/scan-receipt/index.ts` — Vision API proxy
- `supabase/functions/scan-receipt/parser.ts` — pure parser
- `supabase/functions/scan-receipt/parser.test.ts` — unit tests

### Components
- `src/components/HomeFab.tsx`
- `src/components/HomeFabSheet.tsx`
- `src/features/bills/components/ReceiptCapture.tsx`
- `src/features/bills/components/ReceiptScanProgress.tsx`
- `src/features/bills/components/ItemsReview.tsx`
- `src/features/bills/components/ItemEditor.tsx`
- `src/features/bills/components/ParticipantPicker.tsx` (this is new and
  bills-specific; don't conflate with the existing
  `features/hangouts/ParticipantPicker.tsx`)
- `src/features/bills/components/GuestAddSheet.tsx`
- `src/features/bills/components/ItemAssigner.tsx`
- `src/features/bills/components/ItemAssignmentOverview.tsx`
- `src/features/bills/components/SplitPreview.tsx`
- `src/features/bills/components/FinalTotals.tsx`
- `src/features/bills/components/SmallPrintExplainer.tsx`

### Hooks
- `src/features/bills/hooks/useScanReceipt.ts`
- `src/features/bills/hooks/useCreateItemizedBill.ts`
- `src/features/bills/hooks/useMyBills.ts`
- `src/features/bills/hooks/useBillGuests.ts`

### Utility functions
- `src/features/bills/utils/proportional-split.ts`
- `src/features/bills/utils/compute-item-shares.ts`
- `src/features/bills/utils/parse-money.ts`
- `src/features/bills/utils/proportional-split.test.ts`
- `src/features/bills/utils/compute-item-shares.test.ts`

### Routes
- `app/bill/new.tsx`
- `app/bill/scan.tsx`
- `app/bill/review-items.tsx`
- `app/bill/participants.tsx`
- `app/bill/assign.tsx`
- `app/bill/totals.tsx`
- `app/profile/bills.tsx`

### Wiring
- Home screen → add `<HomeFab />` overlay
- Profile screen → add Bills row entry
- Existing hangout bill flow → add an "Add by scanning receipt" option
  in the same entry sheet

## Test plan

1. **Migration applied.** Verify tables, columns nullable correctly,
   RLS policies in place.
2. **Vision API secret set.** `npx supabase secrets list` shows
   `GOOGLE_CLOUD_VISION_API_KEY`.
3. **Edge function deployed.** `npx supabase functions deploy scan-receipt`.
   Test with a sample receipt POST from Supabase dashboard.
4. **Unit tests pass.** `npm test` runs parser + split tests.
5. **Happy path standalone:**
   - Open app, tap FAB, "Split a bill"
   - Take photo of a real restaurant receipt
   - Wait for OCR (5-10s)
   - Review items: at least 3 of 5 items match
   - Edit one item to fix any OCR error
   - Continue → pick 2 friends + add 1 guest
   - Assign items: tap chips for each item, advance with Next
   - Mix of solo + shared items
   - Continue → totals page shows correct math
   - Save → bill appears in Profile → Bills
6. **Push notifications fire.** Both user participants get a push.
7. **Settle flow:** mark guest's share as paid → only creator can do it.
   Mark user participant's share as paid → either ower or creator can.
8. **OCR failure:** kill wifi, scan receipt, get fallback. Manual entry
   from same starting screen works.
9. **Hangout-attached bill:** in a hangout, scan a receipt — same flow
   but participants pre-populated from hangout.
10. **RLS test:** log in as a stranger, query `bills` for the standalone
    bill → empty.
11. **Math regression:** create itemized bill with $76 subtotal, $6.84
    tax, $11.40 tip; assign all items to 4 people in known ratios;
    verify each person's total matches hand computation.
12. **Empty profile bills:** new user → "No bills yet" empty state.

## Done when
- All acceptance criteria pass
- All unit tests pass (`npm test` clean)
- `npx tsc --noEmit` clean
- Three-receipt OCR test (3 different real receipts) returns usable
  items for at least 2 of 3
- Standalone bill + hangout bill both work end-to-end
- Migration committed: `git commit -m "Phase 3E: receipt OCR + itemized bills + standalone bills"`

## Notes for Claude Code
- The parser logic is the most fragile part. Write tests FIRST for the
  parser with 3-5 sample Vision API responses. Then write the parser to
  pass them.
- The Vision API expects base64 or GCS URI for images. We're not using
  GCS — base64 only. Resize the image client-side to ≤ 4MB to avoid
  hitting payload limits.
- The OCR confidence flag is for UX, not for blocking. Show low-confidence
  warning ("We weren't sure about a few items — please double-check")
  but always proceed to the review screen.
- Don't over-engineer the receipt parser. Receipts vary wildly. Aim for
  "good enough that users can review + fix" not "perfectly accurate."
  The review step is the safety net.
- For the assignment UX, prioritize speed of input. Big tap targets,
  obvious affordances, swipe-friendly. The user is splitting a 8-item
  bill at the table — they want to be done in 60 seconds.
- The FAB sheet has only one option for now ("Split a bill"). Design it
  so adding more options later is trivial (it's just an array of action
  rows).
