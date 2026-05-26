-- When to Meet: availability sessions + per-user slot responses
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.availability_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hangout_id  uuid REFERENCES public.hangouts(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'When can we meet?',
  dates       date[] NOT NULL,
  start_hour  smallint NOT NULL DEFAULT 9,
  end_hour    smallint NOT NULL DEFAULT 22,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.availability_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.availability_sessions(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name  text,
  available   text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

ALTER TABLE public.availability_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_responses ENABLE ROW LEVEL SECURITY;

-- Sessions: creator or hangout participant can see/insert
CREATE POLICY "avail_sessions_select" ON public.availability_sessions
  FOR SELECT USING (
    auth.uid() = created_by
    OR hangout_id IS NULL
    OR (hangout_id IS NOT NULL AND public.is_hangout_participant(hangout_id, auth.uid()))
  );

CREATE POLICY "avail_sessions_insert" ON public.availability_sessions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "avail_sessions_delete" ON public.availability_sessions
  FOR DELETE USING (auth.uid() = created_by);

-- Responses: readable by session viewers; writable only by self
CREATE POLICY "avail_responses_select" ON public.availability_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.availability_sessions s
      WHERE s.id = session_id
        AND (
          auth.uid() = s.created_by
          OR s.hangout_id IS NULL
          OR (s.hangout_id IS NOT NULL AND public.is_hangout_participant(s.hangout_id, auth.uid()))
        )
    )
  );

CREATE POLICY "avail_responses_upsert" ON public.availability_responses
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_responses TO authenticated;
