-- ============================================================
-- Run this in Supabase SQL Editor to fix "showing nothing" issues
-- Safe to re-run (all statements use IF NOT EXISTS / DO blocks)
-- ============================================================

-- ── 1. When-to-Meet tables (availability_sessions + responses) ────────────────

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

DO $$ BEGIN
  CREATE POLICY "avail_sessions_select" ON public.availability_sessions
    FOR SELECT USING (
      auth.uid() = created_by
      OR hangout_id IS NULL
      OR (hangout_id IS NOT NULL AND public.is_hangout_participant(hangout_id, auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avail_sessions_insert" ON public.availability_sessions
    FOR INSERT WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avail_sessions_delete" ON public.availability_sessions
    FOR DELETE USING (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avail_responses_upsert" ON public.availability_responses
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_responses TO authenticated;


-- ── 2. Media ratings table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.media_ratings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tmdb_id      integer not null,
  media_type   text not null check (media_type in ('movie', 'tv')),
  title        text not null check (char_length(title) between 1 and 300),
  poster_url   text,
  year         text,
  genre        text,
  rating       smallint not null check (rating between 1 and 5),
  notes        text check (char_length(notes) <= 280),
  watched_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS media_ratings_user_idx ON public.media_ratings(user_id, watched_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_ratings TO service_role;

ALTER TABLE public.media_ratings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "read own and friends media ratings"
  ON public.media_ratings FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships
      WHERE (user_a_id = auth.uid() AND user_b_id = media_ratings.user_id)
         OR (user_b_id = auth.uid() AND user_a_id = media_ratings.user_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "insert own media rating"
  ON public.media_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "update own media rating"
  ON public.media_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "delete own media rating"
  ON public.media_ratings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS set_media_ratings_updated_at ON public.media_ratings;
CREATE TRIGGER set_media_ratings_updated_at
  BEFORE UPDATE ON public.media_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 3. Restaurant ratings table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.restaurant_ratings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  place_id      text not null,
  place_name    text not null check (char_length(place_name) between 1 and 200),
  place_address text,
  place_photo   text,
  place_type    text,
  rating        smallint not null check (rating between 1 and 5),
  notes         text check (char_length(notes) <= 280),
  visited_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, place_id)
);

CREATE INDEX IF NOT EXISTS restaurant_ratings_user_idx ON public.restaurant_ratings(user_id, visited_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_ratings TO service_role;

ALTER TABLE public.restaurant_ratings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "read own and friends restaurant ratings"
  ON public.restaurant_ratings FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships
      WHERE (user_a_id = auth.uid() AND user_b_id = restaurant_ratings.user_id)
         OR (user_b_id = auth.uid() AND user_a_id = restaurant_ratings.user_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "insert own restaurant rating"
  ON public.restaurant_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "update own restaurant rating"
  ON public.restaurant_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "delete own restaurant rating"
  ON public.restaurant_ratings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS set_restaurant_ratings_updated_at ON public.restaurant_ratings;
CREATE TRIGGER set_restaurant_ratings_updated_at
  BEFORE UPDATE ON public.restaurant_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 4. Bills: ensure mode column exists (phase 3E) ────────────────────────────

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'whole'
    CHECK (mode IN ('whole', 'itemized'));

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS subtotal_cents bigint,
  ADD COLUMN IF NOT EXISTS tax_cents bigint,
  ADD COLUMN IF NOT EXISTS tip_cents bigint;


-- ── 5. Cross-hangout balances RPC ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_cross_hangout_balances()
RETURNS TABLE (
  other_user_id uuid,
  display_name  text,
  avatar_url    text,
  username      text,
  net_cents     bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH my_paid AS (
    SELECT
      bs.user_id                                                         AS other_user_id,
      SUM(CASE WHEN bs.settled_at IS NULL THEN bs.amount_cents ELSE 0 END) AS owed_to_me
    FROM   bills b
    JOIN   bill_shares bs ON bs.bill_id = b.id
    WHERE  b.payer_id    = auth.uid()
      AND  bs.user_id   != auth.uid()
      AND  bs.user_id    IS NOT NULL
      AND  b.voided_at   IS NULL
    GROUP  BY bs.user_id
  ),
  others_paid AS (
    SELECT
      b.payer_id                                                          AS other_user_id,
      SUM(CASE WHEN bs.settled_at IS NULL THEN bs.amount_cents ELSE 0 END) AS i_owe
    FROM   bills b
    JOIN   bill_shares bs ON bs.bill_id = b.id AND bs.user_id = auth.uid()
    WHERE  b.payer_id  != auth.uid()
      AND  b.voided_at  IS NULL
    GROUP  BY b.payer_id
  ),
  net AS (
    SELECT
      COALESCE(mp.other_user_id, op.other_user_id)        AS other_user_id,
      COALESCE(mp.owed_to_me, 0) - COALESCE(op.i_owe, 0) AS net_cents
    FROM      my_paid mp
    FULL JOIN others_paid op ON mp.other_user_id = op.other_user_id
    WHERE COALESCE(mp.owed_to_me, 0) - COALESCE(op.i_owe, 0) != 0
  )
  SELECT
    n.other_user_id,
    p.display_name,
    p.avatar_url,
    p.username,
    n.net_cents
  FROM   net n
  JOIN   profiles p ON p.id = n.other_user_id
  ORDER  BY ABS(n.net_cents) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_cross_hangout_balances() TO authenticated;
