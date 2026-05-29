-- Grant service_role (used by edge functions) access to availability tables.
-- Also grant anon read access to sessions where hangout_id IS NULL (public sessions).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_sessions  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_responses TO service_role;

-- Allow anonymous (web guests) to read public sessions so the availability-page
-- edge function can fall back to anon key if needed.
GRANT SELECT ON public.availability_sessions  TO anon;
GRANT SELECT ON public.availability_responses TO anon;

-- Allow guests (no auth) to insert their own responses via a policy.
-- The edge function uses service_role so this isn't strictly needed for the
-- edge function path, but it future-proofs direct anon inserts.
DO $$ BEGIN
  CREATE POLICY "avail_responses_guest_insert"
    ON public.availability_responses
    FOR INSERT
    WITH CHECK (user_id IS NULL AND guest_name IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
