-- ============================================================================
-- Hangout Planner — Triggers and side effects
-- ============================================================================
-- These triggers handle automatic data creation that should always happen
-- together — keeping it in the database guarantees consistency even if a
-- client crashes mid-flow.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New auth user → create profile shell + notification prefs
-- ----------------------------------------------------------------------------
-- When Supabase Auth creates a new auth.users row, we create a matching
-- profiles row with placeholder data. The user completes their profile
-- in the Create Profile screen.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  -- Derive a temporary username from the email; user can change it.
  base_username := lower(regexp_replace(
    split_part(coalesce(new.email, ''), '@', 1),
    '[^a-z0-9_]', '', 'g'
  ));
  if length(base_username) < 3 then
    base_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, candidate);

  insert into public.notification_preferences (user_id) values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 2. New hangout → auto-create album + add host as participant
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_hangout()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Album
  insert into public.albums (hangout_id) values (new.id);

  -- Host as participant with role=host, status=accepted
  insert into public.hangout_participants (hangout_id, user_id, status, role, responded_at)
  values (new.id, new.host_id, 'accepted', 'host', now())
  on conflict (hangout_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_hangout_created on public.hangouts;
create trigger on_hangout_created
  after insert on public.hangouts
  for each row execute function public.handle_new_hangout();

-- ----------------------------------------------------------------------------
-- 3. Friend request accepted → create friendship + notify sender
-- ----------------------------------------------------------------------------

create or replace function public.handle_friend_request_accepted()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    -- Insert friendship (canonicalize trigger reorders user_a < user_b)
    insert into public.friendships (user_a_id, user_b_id)
    values (new.sender_id, new.recipient_id)
    on conflict do nothing;

    -- Notify sender
    insert into public.notifications (user_id, kind, payload)
    values (
      new.sender_id,
      'friend_request_accepted',
      jsonb_build_object('by_user_id', new.recipient_id)
    );

    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_friend_request_accepted on public.friend_requests;
create trigger on_friend_request_accepted
  before update on public.friend_requests
  for each row execute function public.handle_friend_request_accepted();

-- ----------------------------------------------------------------------------
-- 4. Friend request created → notify recipient
-- ----------------------------------------------------------------------------

create or replace function public.handle_friend_request_created()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.notifications (user_id, kind, payload)
  values (
    new.recipient_id,
    'friend_request_received',
    jsonb_build_object('from_user_id', new.sender_id)
  );
  return new;
end;
$$;

drop trigger if exists on_friend_request_created on public.friend_requests;
create trigger on_friend_request_created
  after insert on public.friend_requests
  for each row execute function public.handle_friend_request_created();

-- ----------------------------------------------------------------------------
-- 5. Hangout participant invited → notify
-- ----------------------------------------------------------------------------

create or replace function public.handle_participant_invited()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'invited' and new.user_id <> coalesce(new.invited_by, '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications (user_id, kind, payload)
    values (
      new.user_id,
      'hangout_invited',
      jsonb_build_object(
        'hangout_id', new.hangout_id,
        'invited_by', new.invited_by
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_participant_invited on public.hangout_participants;
create trigger on_participant_invited
  after insert on public.hangout_participants
  for each row execute function public.handle_participant_invited();

-- ----------------------------------------------------------------------------
-- 6. Vote inserted → snapshot voter's vote_weight from hangout_participants
-- ----------------------------------------------------------------------------
-- We snapshot the weight at the time of voting so changing weights later
-- doesn't retroactively change tallies.

create or replace function public.handle_vote_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  participant_weight numeric(3,1);
  poll_hangout uuid;
begin
  select hangout_id into poll_hangout from public.polls where id = new.poll_id;

  select vote_weight into participant_weight
    from public.hangout_participants
    where hangout_id = poll_hangout and user_id = new.voter_id;

  if participant_weight is null then
    raise exception 'Voter % is not a participant of hangout %', new.voter_id, poll_hangout;
  end if;

  new.weight := participant_weight;
  return new;
end;
$$;

drop trigger if exists on_vote_insert on public.votes;
create trigger on_vote_insert
  before insert on public.votes
  for each row execute function public.handle_vote_insert();

-- ----------------------------------------------------------------------------
-- 7. Message inserted → notify other (non-muted) participants
-- ----------------------------------------------------------------------------

create or replace function public.handle_message_inserted()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.notifications (user_id, kind, payload)
  select
    hp.user_id,
    'message_received',
    jsonb_build_object(
      'hangout_id', new.hangout_id,
      'message_id', new.id,
      'sender_id', new.sender_id
    )
  from public.hangout_participants hp
  join public.notification_preferences np on np.user_id = hp.user_id
  where hp.hangout_id = new.hangout_id
    and hp.user_id <> new.sender_id
    and hp.status = 'accepted'
    and hp.notifications_muted = false
    and np.message_received = true;

  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute function public.handle_message_inserted();

-- ----------------------------------------------------------------------------
-- 8. Bill inserted → notify all debtors
-- ----------------------------------------------------------------------------

create or replace function public.handle_bill_split_inserted()
returns trigger
language plpgsql
security definer
as $$
declare
  bill_hangout uuid;
  bill_payer uuid;
begin
  select hangout_id, paid_by into bill_hangout, bill_payer from public.bills where id = new.bill_id;

  if new.debtor_id <> bill_payer then
    insert into public.notifications (user_id, kind, payload)
    values (
      new.debtor_id,
      'bill_added',
      jsonb_build_object(
        'hangout_id', bill_hangout,
        'bill_id', new.bill_id,
        'amount_cents', new.amount_cents
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_bill_split_inserted on public.bill_splits;
create trigger on_bill_split_inserted
  after insert on public.bill_splits
  for each row execute function public.handle_bill_split_inserted();

-- ----------------------------------------------------------------------------
-- 9. Block created → cancel pending friend requests, hide posts (handled in policies)
-- ----------------------------------------------------------------------------

create or replace function public.handle_block_created()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Cancel any pending friend requests in either direction
  update public.friend_requests
     set status = 'cancelled', responded_at = now()
   where status = 'pending'
     and (
       (sender_id = new.blocker_id and recipient_id = new.blocked_id)
       or (sender_id = new.blocked_id and recipient_id = new.blocker_id)
     );

  -- Remove existing friendship if any
  delete from public.friendships
   where (user_a_id = new.blocker_id and user_b_id = new.blocked_id)
      or (user_a_id = new.blocked_id and user_b_id = new.blocker_id);

  return new;
end;
$$;

drop trigger if exists on_block_created on public.blocks;
create trigger on_block_created
  after insert on public.blocks
  for each row execute function public.handle_block_created();

-- ============================================================================
-- End of triggers.
-- ============================================================================
