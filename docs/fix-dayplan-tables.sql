-- Paste this entire block into the Supabase SQL Editor and click Run.
-- It is safe to run multiple times (all IF NOT EXISTS / DO $$ guards).

-- 1. Create tables
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

-- 2. Enable RLS
ALTER TABLE public.day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_plan_items ENABLE ROW LEVEL SECURITY;

-- 3. Grant access
GRANT ALL ON public.day_plans TO authenticated;
GRANT ALL ON public.day_plan_items TO authenticated;

-- 4. RLS policies (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plans' AND policyname='day_plans_select') THEN
    CREATE POLICY "day_plans_select" ON public.day_plans FOR SELECT
      USING (is_hangout_participant(hangout_id, auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='day_plans' AND policyname='day_plans_insert') THEN
    CREATE POLICY "day_plans_insert" ON public.day_plans FOR INSERT
      WITH CHECK (created_by = auth.uid() AND is_hangout_participant(hangout_id, auth.uid()));
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
      USING (created_by = auth.uid());
  END IF;
END $$;

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
        created_by = auth.uid()
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
      USING (created_by = auth.uid());
  END IF;
END $$;

-- 5. Verify (run this after — you should see both table names returned)
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('day_plans', 'day_plan_items');
