-- Cross-hangout net balance per person pair.
-- Returns one row per "other" user. net_cents > 0 means they owe you; < 0 means you owe them.
-- Only unsettled shares are counted. Voided bills are excluded.
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
    -- Bills I paid: other participants' unsettled shares = they owe me
    select
      bs.user_id                                                         as other_user_id,
      sum(case when bs.settled_at is null then bs.amount_cents else 0 end) as owed_to_me
    from   bills b
    join   bill_shares bs on bs.bill_id = b.id
    where  b.payer_id    = auth.uid()
      and  bs.user_id   != auth.uid()
      and  bs.user_id    is not null
      and  b.voided_at   is null
    group  by bs.user_id
  ),
  others_paid as (
    -- Bills others paid: my unsettled share = I owe them
    select
      b.payer_id                                                          as other_user_id,
      sum(case when bs.settled_at is null then bs.amount_cents else 0 end) as i_owe
    from   bills b
    join   bill_shares bs on bs.bill_id = b.id and bs.user_id = auth.uid()
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
  join   profiles p on p.id = n.other_user_id
  order  by abs(n.net_cents) desc;
$$;

grant execute on function public.get_cross_hangout_balances() to authenticated;
