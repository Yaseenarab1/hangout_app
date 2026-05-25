-- ═══════════════════════════════════════════════════════════════════════
-- RUN THIS ENTIRE BLOCK IN THE SUPABASE SQL EDITOR
-- Covers migrations 20260514000002 → 20260514000005
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE everywhere)
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Multi-photo feed posts ─────────────────────────────────────────
alter table public.feed_posts
  add column if not exists media_paths text[] default null;

-- ── 2. Cross-hangout balances RPC ─────────────────────────────────────
create or replace function public.get_cross_hangout_balances()
returns table (
  other_user_id uuid,
  display_name  text,
  avatar_url    text,
  username      text,
  net_cents     bigint
)
language sql
security definer
stable
as $$
  with my_paid as (
    select
      bs.user_id                                                         as other_user_id,
      sum(case when bs.settled_at is null then bs.amount_cents else 0 end) as owed_to_me
    from   public.bills b
    join   public.bill_shares bs on bs.bill_id = b.id
    where  b.payer_id    = auth.uid()
      and  bs.user_id   != auth.uid()
      and  bs.user_id    is not null
      and  b.voided_at   is null
    group  by bs.user_id
  ),
  others_paid as (
    select
      b.payer_id                                                          as other_user_id,
      sum(case when bs.settled_at is null then bs.amount_cents else 0 end) as i_owe
    from   public.bills b
    join   public.bill_shares bs on bs.bill_id = b.id and bs.user_id = auth.uid()
    where  b.payer_id  != auth.uid()
      and  b.voided_at  is null
    group  by b.payer_id
  ),
  net as (
    select
      coalesce(mp.other_user_id, op.other_user_id)        as other_user_id,
      coalesce(mp.owed_to_me, 0) - coalesce(op.i_owe, 0) as net_cents
    from      my_paid mp
    full join others_paid op on mp.other_user_id = op.other_user_id
    where coalesce(mp.owed_to_me, 0) - coalesce(op.i_owe, 0) != 0
  )
  select
    n.other_user_id,
    p.display_name,
    p.avatar_url,
    p.username,
    n.net_cents
  from   net n
  join   public.profiles p on p.id = n.other_user_id
  order  by abs(n.net_cents) desc;
$$;

grant execute on function public.get_cross_hangout_balances() to authenticated;

-- ── 3. Reactions: add reaction_type to feed_post_likes ────────────────
alter table public.feed_post_likes
  add column if not exists reaction_type text not null default 'heart'
    check (reaction_type in ('heart', 'fire', 'laugh', 'wow', 'sad', 'clap'));

-- Allow viewers to UPDATE their reaction type
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'feed_post_likes' and policyname = 'feed_post_likes_update'
  ) then
    execute $pol$
      create policy "feed_post_likes_update"
        on public.feed_post_likes for update
        using (user_id = auth.uid())
    $pol$;
  end if;
end $$;

-- ── 4. Comment reactions table ────────────────────────────────────────
create table if not exists public.feed_comment_reactions (
  comment_id    uuid        not null
                              references public.feed_post_comments(id)
                              on delete cascade,
  user_id       uuid        not null
                              references public.profiles(id)
                              on delete cascade,
  reaction_type text        not null default 'heart'
                              check (reaction_type in
                                ('heart', 'fire', 'laugh', 'wow', 'sad', 'clap')),
  created_at    timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists feed_comment_reactions_comment_idx
  on public.feed_comment_reactions(comment_id);

alter table public.feed_comment_reactions enable row level security;
grant all on public.feed_comment_reactions to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'feed_comment_reactions' and policyname = 'feed_comment_reactions_select') then
    create policy "feed_comment_reactions_select"
      on public.feed_comment_reactions for select
      using (
        exists (
          select 1 from public.feed_post_comments c
          where c.id = comment_id and c.deleted_at is null
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'feed_comment_reactions' and policyname = 'feed_comment_reactions_insert') then
    create policy "feed_comment_reactions_insert"
      on public.feed_comment_reactions for insert
      with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'feed_comment_reactions' and policyname = 'feed_comment_reactions_update') then
    create policy "feed_comment_reactions_update"
      on public.feed_comment_reactions for update
      using (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'feed_comment_reactions' and policyname = 'feed_comment_reactions_delete') then
    create policy "feed_comment_reactions_delete"
      on public.feed_comment_reactions for delete
      using (user_id = auth.uid());
  end if;
end $$;

-- ── 5. Bills INSERT policy: allow standalone bills (hangout_id IS NULL) ─
drop policy if exists "participants insert bills" on public.bills;

create policy "participants insert bills"
  on public.bills for insert
  with check (
    auth.uid() = created_by
    and (
      (hangout_id is not null and is_hangout_participant(hangout_id, auth.uid()))
      or hangout_id is null
    )
  );

-- ── 6. is_bill_accessible: ensure standalone bills readable ───────────
-- If 20260513060558 was never applied, this creates it fresh.
-- If it was applied but didn't cover standalone, this replaces it.
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
        (b.hangout_id is not null
          and is_hangout_participant(b.hangout_id, p_user_id))
        or
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

-- Replace all policies that depend on is_bill_accessible
drop policy if exists "participants read bills" on public.bills;
create policy "participants read bills"
  on public.bills for select
  using (is_bill_accessible(id, auth.uid()));

drop policy if exists "participants read shares" on public.bill_shares;
create policy "participants read shares"
  on public.bill_shares for select
  using (is_bill_accessible(bill_id, auth.uid()));

drop policy if exists "see items if can see bill" on public.bill_items;
create policy "see items if can see bill"
  on public.bill_items for select
  using (is_bill_accessible(bill_id, auth.uid()));

drop policy if exists "see guests if can see bill" on public.bill_guest_participants;
create policy "see guests if can see bill"
  on public.bill_guest_participants for select
  using (is_bill_accessible(bill_id, auth.uid()));

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
