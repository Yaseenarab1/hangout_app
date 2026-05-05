-- Phase 2C-final FIX 2: allow 0 weight on hangout_participants
-- Previously the constraint required weight > 0 which broke the "Doesn't vote" option.

ALTER TABLE public.hangout_participants
  DROP CONSTRAINT IF EXISTS hangout_participants_vote_weight_check;

ALTER TABLE public.hangout_participants
  ADD CONSTRAINT hangout_participants_vote_weight_check
  CHECK (vote_weight >= 0 AND vote_weight <= 5);
