-- Fix is_hangout_participant to include 'maybe' and 'declined' statuses.
-- Users with these statuses could not cast votes (RLS error 42501).

create or replace function public.is_hangout_participant(_hangout_id uuid, _user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.hangout_participants
    where hangout_id = _hangout_id and user_id = _user_id
      and status in ('invited', 'accepted', 'maybe', 'declined')
  );
$$;
