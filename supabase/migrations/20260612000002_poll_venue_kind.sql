-- Add 'venue' as a valid poll kind so sports/activity venue polls
-- are distinct from restaurant polls and activity-catalog polls.
ALTER TABLE public.polls
  DROP CONSTRAINT IF EXISTS polls_kind_check;
ALTER TABLE public.polls
  ADD CONSTRAINT polls_kind_check
  CHECK (kind IN ('activity', 'cuisine', 'restaurant', 'venue'));
