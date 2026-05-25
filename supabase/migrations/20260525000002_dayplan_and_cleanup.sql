-- Day plan tables + expired post cleanup function
-- Run this in Supabase SQL Editor (or via supabase db push)

-- ─── Day Plans ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.day_plans (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id  uuid        NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'Day Plan',
  plan_date   date,
  created_by  uuid        NOT NULL REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.day_plan_items (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid        NOT NULL REFERENCES public.day_plans(id) ON DELETE CASCADE,
  position         integer     NOT NULL DEFAULT 0,
  item_type        text        NOT NULL CHECK (item_type IN ('restaurant', 'activity', 'custom')),
  title            text        NOT NULL,
  subtitle         text,
  start_time       text,
  duration_minutes integer,
  place_id         text,
  place_data       jsonb,
  notes            text,
  created_by       uuid        REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS day_plan_items_plan_idx
  ON public.day_plan_items (plan_id, position);

-- RLS
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_plan_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.day_plans TO authenticated;
GRANT ALL ON public.day_plan_items TO authenticated;

-- day_plans policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plans' AND policyname='day_plans_select') THEN
    CREATE POLICY "day_plans_select" ON public.day_plans FOR SELECT
      USING (is_hangout_participant(hangout_id, auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plans' AND policyname='day_plans_insert') THEN
    CREATE POLICY "day_plans_insert" ON public.day_plans FOR INSERT
      WITH CHECK (auth.uid() = created_by AND is_hangout_participant(hangout_id, auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plans' AND policyname='day_plans_update') THEN
    CREATE POLICY "day_plans_update" ON public.day_plans FOR UPDATE
      USING (is_hangout_participant(hangout_id, auth.uid()));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plans' AND policyname='day_plans_delete') THEN
    CREATE POLICY "day_plans_delete" ON public.day_plans FOR DELETE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- day_plan_items policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plan_items' AND policyname='day_plan_items_select') THEN
    CREATE POLICY "day_plan_items_select" ON public.day_plan_items FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.day_plans dp WHERE dp.id = plan_id AND is_hangout_participant(dp.hangout_id, auth.uid())));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plan_items' AND policyname='day_plan_items_insert') THEN
    CREATE POLICY "day_plan_items_insert" ON public.day_plan_items FOR INSERT
      WITH CHECK (
        auth.uid() = created_by
        AND EXISTS (SELECT 1 FROM public.day_plans dp WHERE dp.id = plan_id AND is_hangout_participant(dp.hangout_id, auth.uid()))
      );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plan_items' AND policyname='day_plan_items_update') THEN
    CREATE POLICY "day_plan_items_update" ON public.day_plan_items FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.day_plans dp WHERE dp.id = plan_id AND is_hangout_participant(dp.hangout_id, auth.uid())));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plan_items' AND policyname='day_plan_items_delete') THEN
    CREATE POLICY "day_plan_items_delete" ON public.day_plan_items FOR DELETE
      USING (EXISTS (SELECT 1 FROM public.day_plans dp WHERE dp.id = plan_id AND is_hangout_participant(dp.hangout_id, auth.uid())));
  END IF;
END $$;

-- ─── Expired post cleanup function ───────────────────────────────────────────
-- Called by the cleanup-expired-posts edge function nightly.
-- Returns the number of rows deleted.

CREATE OR REPLACE FUNCTION public.cleanup_expired_feed_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.feed_posts
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_feed_posts() TO service_role;

-- ─── Schedule nightly cleanup (requires pg_cron extension) ──────────────────
-- Enable pg_cron in Supabase: Dashboard → Extensions → pg_cron
-- Then uncomment and run:
--
-- SELECT cron.schedule(
--   'cleanup-expired-posts',
--   '0 3 * * *',
--   $$
--     SELECT net.http_post(
--       url := 'https://cruosjnuhcuewjnzhlja.supabase.co/functions/v1/cleanup-expired-posts',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );
