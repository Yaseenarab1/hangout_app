-- Phase 3E: Receipt OCR + itemized bills + standalone bills + guest participants
-- Idempotent: safe to re-run. All ALTER/CREATE use IF NOT EXISTS / IF EXISTS guards.

-- ─── 1. bills — make hangout_id nullable (standalone bills) ──────────────────

alter table public.bills
  alter column hangout_id drop not null;

-- ─── 2. bills — add mode + itemized-specific columns ─────────────────────────

alter table public.bills
  add column if not exists mode text not null default 'whole'
    check (mode in ('whole', 'itemized'));

alter table public.bills
  add column if not exists subtotal_cents bigint
    check (subtotal_cents is null or subtotal_cents >= 0),
  add column if not exists tax_cents bigint
    check (tax_cents is null or tax_cents >= 0),
  add column if not exists tip_cents bigint
    check (tip_cents is null or tip_cents >= 0);

-- Backfill: existing 3D bills get subtotal = amount_cents, tax/tip = null
update public.bills
  set subtotal_cents = amount_cents
  where subtotal_cents is null;

-- ─── 3. bills — updated RLS (standalone bills readable by creator + participants)

drop policy if exists "participants read bills" on public.bills;
create policy "participants read bills"
  on public.bills for select
  using (
    (hangout_id is not null and is_hangout_participant(hangout_id, auth.uid()))
    or
    (hangout_id is null and (
      created_by = auth.uid()
      or auth.uid() in (
        select bs.user_id
        from public.bill_shares bs
        where bs.bill_id = bills.id and bs.user_id is not null
      )
    ))
  );

-- ─── 4. bill_shares — make user_id nullable (supports guest shares) ───────────

alter table public.bill_shares
  alter column user_id drop not null;

alter table public.bill_shares
  add column if not exists guest_participant_id uuid;
  -- FK added after bill_guest_participants table is created below

-- Check: exactly one of user_id / guest_participant_id must be set
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bill_shares_user_or_guest_check'
  ) then
    alter table public.bill_shares
      add constraint bill_shares_user_or_guest_check
      check (
        (user_id is not null and guest_participant_id is null)
        or (user_id is null and guest_participant_id is not null)
      );
  end if;
end $$;

-- Replace old unique constraint with partial indexes
alter table public.bill_shares
  drop constraint if exists bill_shares_bill_id_user_id_key;

drop index if exists public.bill_shares_unique_user;
drop index if exists public.bill_shares_unique_guest;

create unique index bill_shares_unique_user
  on public.bill_shares(bill_id, user_id)
  where user_id is not null;

create unique index bill_shares_unique_guest
  on public.bill_shares(bill_id, guest_participant_id)
  where guest_participant_id is not null;

-- ─── 5. bill_guest_participants — non-user participants ───────────────────────

create table if not exists public.bill_guest_participants (
  id          uuid        primary key default gen_random_uuid(),
  bill_id     uuid        not null references public.bills(id) on delete cascade,
  name        text        not null check (length(name) > 0 and length(name) <= 60),
  created_at  timestamptz not null default now()
);

create index if not exists bill_guest_participants_bill_idx
  on public.bill_guest_participants(bill_id);

alter table public.bill_guest_participants enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'bill_guest_participants' and policyname = 'see guests if can see bill'
  ) then
    execute $p$
      create policy "see guests if can see bill"
        on public.bill_guest_participants for select
        using (
          exists (
            select 1 from public.bills b
            where b.id = bill_id
              and (
                (b.hangout_id is not null and is_hangout_participant(b.hangout_id, auth.uid()))
                or
                (b.hangout_id is null and (
                  b.created_by = auth.uid()
                  or auth.uid() in (
                    select bs.user_id from public.bill_shares bs
                    where bs.bill_id = b.id and bs.user_id is not null
                  )
                ))
              )
          )
        )
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'bill_guest_participants' and policyname = 'creator manages guests'
  ) then
    execute $p$
      create policy "creator manages guests"
        on public.bill_guest_participants for all
        using (
          exists (
            select 1 from public.bills b
            where b.id = bill_id and b.created_by = auth.uid()
          )
        )
        with check (
          exists (
            select 1 from public.bills b
            where b.id = bill_id and b.created_by = auth.uid()
          )
        )
    $p$;
  end if;
end $$;

-- ─── 6. bill_shares — now add FK to bill_guest_participants ──────────────────

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bill_shares_guest_participant_id_fkey'
  ) then
    alter table public.bill_shares
      add constraint bill_shares_guest_participant_id_fkey
      foreign key (guest_participant_id)
      references public.bill_guest_participants(id)
      on delete cascade;
  end if;
end $$;

-- ─── 7. bill_shares — updated settle policy (creator can settle guest shares) ─

drop policy if exists "owers and payers settle" on public.bill_shares;
drop policy if exists "owers + payers can settle" on public.bill_shares;
drop policy if exists "owers + payers + creator can settle" on public.bill_shares;

create policy "owers + payers + creator can settle"
  on public.bill_shares for update
  using (
    -- ower settles their own (user shares only)
    (auth.uid() = user_id)
    -- payer marks any share paid
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

-- ─── 8. bill_items — line items on an itemized bill ──────────────────────────

create table if not exists public.bill_items (
  id            uuid        primary key default gen_random_uuid(),
  bill_id       uuid        not null references public.bills(id) on delete cascade,
  description   text        not null check (length(description) > 0 and length(description) <= 200),
  amount_cents  bigint      not null check (amount_cents >= 0),
  quantity      int         not null default 1 check (quantity > 0 and quantity <= 99),
  source        text        not null default 'manual' check (source in ('ocr', 'manual')),
  position      int         not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists bill_items_bill_idx
  on public.bill_items(bill_id, position);

alter table public.bill_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'bill_items' and policyname = 'see items if can see bill'
  ) then
    execute $p$
      create policy "see items if can see bill"
        on public.bill_items for select
        using (
          exists (
            select 1 from public.bills b
            where b.id = bill_id
              and (
                (b.hangout_id is not null and is_hangout_participant(b.hangout_id, auth.uid()))
                or
                (b.hangout_id is null and (
                  b.created_by = auth.uid()
                  or auth.uid() in (
                    select bs.user_id from public.bill_shares bs
                    where bs.bill_id = b.id and bs.user_id is not null
                  )
                ))
              )
          )
        )
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'bill_items' and policyname = 'creator manages items'
  ) then
    execute $p$
      create policy "creator manages items"
        on public.bill_items for all
        using (
          exists (
            select 1 from public.bills b
            where b.id = bill_id and b.created_by = auth.uid()
          )
        )
        with check (
          exists (
            select 1 from public.bills b
            where b.id = bill_id and b.created_by = auth.uid()
          )
        )
    $p$;
  end if;
end $$;

-- ─── 9. bill_item_assignments — who shares each item ─────────────────────────
-- user_id → references profiles (not auth.users) to match PostgREST FK-hint pattern

create table if not exists public.bill_item_assignments (
  id                    uuid          primary key default gen_random_uuid(),
  item_id               uuid          not null references public.bill_items(id) on delete cascade,
  user_id               uuid          references public.profiles(id) on delete cascade,
  guest_participant_id  uuid          references public.bill_guest_participants(id) on delete cascade,
  weight                numeric(7,4)  not null default 1.0 check (weight > 0),
  created_at            timestamptz   not null default now(),
  check (
    (user_id is not null and guest_participant_id is null)
    or (user_id is null and guest_participant_id is not null)
  )
);

create index if not exists bill_item_assignments_item_idx
  on public.bill_item_assignments(item_id);

create unique index if not exists bill_item_assignments_unique_user
  on public.bill_item_assignments(item_id, user_id)
  where user_id is not null;

create unique index if not exists bill_item_assignments_unique_guest
  on public.bill_item_assignments(item_id, guest_participant_id)
  where guest_participant_id is not null;

alter table public.bill_item_assignments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'bill_item_assignments' and policyname = 'see assignments if can see bill'
  ) then
    execute $p$
      create policy "see assignments if can see bill"
        on public.bill_item_assignments for select
        using (
          exists (
            select 1 from public.bill_items i
            join public.bills b on b.id = i.bill_id
            where i.id = item_id
              and (
                (b.hangout_id is not null and is_hangout_participant(b.hangout_id, auth.uid()))
                or
                (b.hangout_id is null and (
                  b.created_by = auth.uid()
                  or auth.uid() in (
                    select bs.user_id from public.bill_shares bs
                    where bs.bill_id = b.id and bs.user_id is not null
                  )
                ))
              )
          )
        )
    $p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'bill_item_assignments' and policyname = 'creator manages assignments'
  ) then
    execute $p$
      create policy "creator manages assignments"
        on public.bill_item_assignments for all
        using (
          exists (
            select 1 from public.bill_items i
            join public.bills b on b.id = i.bill_id
            where i.id = item_id and b.created_by = auth.uid()
          )
        )
        with check (
          exists (
            select 1 from public.bill_items i
            join public.bills b on b.id = i.bill_id
            where i.id = item_id and b.created_by = auth.uid()
          )
        )
    $p$;
  end if;
end $$;

-- ─── 10. Realtime ─────────────────────────────────────────────────────────────

do $$ begin
  alter publication supabase_realtime add table public.bill_items;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.bill_guest_participants;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.bill_item_assignments;
exception when others then null; end $$;
