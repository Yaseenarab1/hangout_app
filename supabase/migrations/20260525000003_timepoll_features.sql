-- Time poll indexes (tables already exist from base schema)
-- + new tables for hangout/bill sharing

-- ─── Time Poll Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_poll_responses_slot_user
  ON public.time_poll_responses (slot_id, user_id);

CREATE INDEX IF NOT EXISTS idx_time_polls_hangout
  ON public.time_polls (hangout_id);

CREATE INDEX IF NOT EXISTS idx_time_polls_open
  ON public.time_polls (hangout_id, closed_at) WHERE closed_at IS NULL;

-- ─── Hangout Share Tokens ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hangout_share_tokens (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id uuid NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hangout_share_tokens ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.hangout_share_tokens TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hangout_share_tokens' AND policyname='hangout_share_tokens_select') THEN
    CREATE POLICY "hangout_share_tokens_select" ON public.hangout_share_tokens FOR SELECT
      USING (is_hangout_participant(hangout_id, auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hangout_share_tokens' AND policyname='hangout_share_tokens_insert') THEN
    CREATE POLICY "hangout_share_tokens_insert" ON public.hangout_share_tokens FOR INSERT
      WITH CHECK (auth.uid() = created_by AND is_hangout_participant(hangout_id, auth.uid()));
  END IF;
END $$;

-- ─── Hangout Web RSVPs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hangout_web_rsvps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id uuid NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  token      uuid NOT NULL REFERENCES public.hangout_share_tokens(token),
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  status     text NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hangout_web_rsvps ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.hangout_web_rsvps TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hangout_web_rsvps' AND policyname='hangout_web_rsvps_select') THEN
    CREATE POLICY "hangout_web_rsvps_select" ON public.hangout_web_rsvps FOR SELECT
      USING (is_hangout_participant(hangout_id, auth.uid()));
  END IF;
END $$;

-- Edge functions insert web RSVPs using service_role key (bypasses RLS)

-- ─── Bill Share Tokens ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_share_tokens (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

ALTER TABLE public.bill_share_tokens ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.bill_share_tokens TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bill_share_tokens' AND policyname='bill_share_tokens_select') THEN
    CREATE POLICY "bill_share_tokens_select" ON public.bill_share_tokens FOR SELECT
      USING (is_bill_accessible(bill_id, auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bill_share_tokens' AND policyname='bill_share_tokens_insert') THEN
    CREATE POLICY "bill_share_tokens_insert" ON public.bill_share_tokens FOR INSERT
      WITH CHECK (auth.uid() = created_by AND is_bill_accessible(bill_id, auth.uid()));
  END IF;
END $$;

-- ─── Bill Item Disputes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_item_disputes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  item_id     uuid REFERENCES public.bill_items(id) ON DELETE CASCADE,
  share_id    uuid REFERENCES public.bill_shares(id) ON DELETE CASCADE,
  name        text NOT NULL,
  reason      text,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_item_disputes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.bill_item_disputes TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bill_item_disputes' AND policyname='bill_item_disputes_select') THEN
    CREATE POLICY "bill_item_disputes_select" ON public.bill_item_disputes FOR SELECT
      USING (is_bill_accessible(bill_id, auth.uid()));
  END IF;
END $$;
