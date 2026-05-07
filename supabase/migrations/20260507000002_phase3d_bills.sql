-- Phase 3D: Bills / expense splitting
-- Uses public.profiles(id) for all FK references so PostgREST joins work.
-- Idempotent: safe to re-run if partially applied.

-- ─── Tables ────────────────────────────────────────────────────────────────
-- Drop and recreate if schema changed (dev only — no prod data yet)
drop table if exists public.bill_shares cascade;
drop table if exists public.bills cascade;

create table public.bills (
  id              uuid        primary key default gen_random_uuid(),
  hangout_id      uuid        not null references public.hangouts(id) on delete cascade,
  payer_id        uuid        not null references public.profiles(id) on delete restrict,
  amount_cents    bigint      not null check (amount_cents > 0),
  currency        text        not null default 'USD' check (currency = 'USD'),
  description     text        not null check (length(description) > 0 and length(description) <= 200),
  paid_at         timestamptz not null default now(),
  receipt_storage_path text,
  created_by      uuid        not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid        references public.profiles(id),
  void_reason     text
);

create index bills_hangout_idx on public.bills(hangout_id, paid_at desc);
create index bills_payer_idx   on public.bills(payer_id);

create table public.bill_shares (
  id            uuid        primary key default gen_random_uuid(),
  bill_id       uuid        not null references public.bills(id) on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  amount_cents  bigint      not null check (amount_cents >= 0),
  split_method  text        not null check (split_method in ('equal', 'percent', 'exact', 'shares')),
  weight        numeric(10,4),
  settled_at    timestamptz,
  settled_by    uuid        references public.profiles(id),
  settle_note   text,
  created_at    timestamptz not null default now(),
  unique (bill_id, user_id)
);

create index bill_shares_bill_idx       on public.bill_shares(bill_id);
create index bill_shares_user_idx       on public.bill_shares(user_id);
create index bill_shares_unsettled_idx  on public.bill_shares(user_id, settled_at) where settled_at is null;

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.bills       enable row level security;
alter table public.bill_shares enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'bills' and policyname = 'participants read bills'
  ) then
    execute 'create policy "participants read bills" on public.bills for select using (is_hangout_participant(hangout_id, auth.uid()))';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'bills' and policyname = 'participants insert bills'
  ) then
    execute $p$create policy "participants insert bills" on public.bills for insert with check (auth.uid() = created_by and is_hangout_participant(hangout_id, auth.uid()))$p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'bills' and policyname = 'creator update unsettled bills'
  ) then
    execute $p$create policy "creator update unsettled bills" on public.bills for update using (auth.uid() = created_by and voided_at is null and not exists (select 1 from public.bill_shares bs where bs.bill_id = id and bs.settled_at is not null))$p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'bill_shares' and policyname = 'participants read shares'
  ) then
    execute $p$create policy "participants read shares" on public.bill_shares for select using (exists (select 1 from public.bills b where b.id = bill_id and is_hangout_participant(b.hangout_id, auth.uid())))$p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'bill_shares' and policyname = 'bill creator inserts shares'
  ) then
    execute $p$create policy "bill creator inserts shares" on public.bill_shares for insert with check (exists (select 1 from public.bills b where b.id = bill_id and b.created_by = auth.uid()))$p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'bill_shares' and policyname = 'owers and payers settle'
  ) then
    execute $p$create policy "owers and payers settle" on public.bill_shares for update using (auth.uid() = user_id or exists (select 1 from public.bills b where b.id = bill_id and b.payer_id = auth.uid()))$p$;
  end if;
end $$;

-- ─── View: net balance per user per hangout ─────────────────────────────────

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

grant select on public.v_user_balances to authenticated;

-- ─── Realtime ──────────────────────────────────────────────────────────────

do $$ begin
  alter publication supabase_realtime add table public.bills;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.bill_shares;
exception when others then null; end $$;

-- ─── Storage bucket ────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bill-receipts', 'bill-receipts', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'participants read receipts'
  ) then
    execute $p$create policy "participants read receipts" on storage.objects for select using (bucket_id = 'bill-receipts' and auth.uid() is not null)$p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'participants upload receipts'
  ) then
    execute $p$create policy "participants upload receipts" on storage.objects for insert with check (bucket_id = 'bill-receipts' and auth.uid() is not null and owner = auth.uid())$p$;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'uploader delete receipts'
  ) then
    execute $p$create policy "uploader delete receipts" on storage.objects for delete using (bucket_id = 'bill-receipts' and owner = auth.uid())$p$;
  end if;
end $$;
