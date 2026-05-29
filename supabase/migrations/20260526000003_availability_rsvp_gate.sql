-- Only hangout participants can submit availability for hangout-linked sessions.
-- Standalone sessions (hangout_id IS NULL) remain open to any authenticated user.

DO $$ BEGIN
  DROP POLICY IF EXISTS "avail_responses_upsert" ON public.availability_responses;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avail_responses_upsert" ON public.availability_responses
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.availability_sessions s
        WHERE s.id = session_id
          AND (
            s.hangout_id IS NULL
            OR public.is_hangout_participant(s.hangout_id, auth.uid())
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
