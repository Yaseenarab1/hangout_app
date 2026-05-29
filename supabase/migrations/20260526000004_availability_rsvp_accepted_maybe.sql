-- Tighten availability: only 'accepted' or 'maybe' participants can save slots.
-- 'invited' and 'declined' are blocked. Standalone sessions (no hangout) remain open.

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
            OR EXISTS (
              SELECT 1 FROM public.hangout_participants hp
              WHERE hp.hangout_id = s.hangout_id
                AND hp.user_id = auth.uid()
                AND hp.status IN ('accepted', 'maybe')
            )
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
