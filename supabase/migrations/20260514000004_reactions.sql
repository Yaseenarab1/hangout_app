-- ── media_paths (multi-photo, backfills migration 0002 if not yet applied) ─────
alter table public.feed_posts
  add column if not exists media_paths text[];

-- ── Reactions on posts (add reaction_type to existing feed_post_likes) ─────────
-- One row per (post, user) — one reaction type at a time.
-- Changing reaction type → upsert. Removing → delete.

alter table public.feed_post_likes
  add column if not exists reaction_type text not null default 'heart'
    check (reaction_type in ('heart', 'fire', 'laugh', 'wow', 'sad', 'clap'));

-- Allow viewer to UPDATE their reaction type (not just insert/delete)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'feed_post_likes' and policyname = 'feed_post_likes_update'
  ) then
    execute $pol$
      create policy "feed_post_likes_update"
        on public.feed_post_likes for update
        using (user_id = auth.uid())
    $pol$;
  end if;
end $$;

-- ── Comment reactions ──────────────────────────────────────────────────────────

create table if not exists public.feed_comment_reactions (
  comment_id    uuid        not null
                              references public.feed_post_comments(id)
                              on delete cascade,
  user_id       uuid        not null
                              references public.profiles(id)
                              on delete cascade,
  reaction_type text        not null default 'heart'
                              check (reaction_type in
                                ('heart', 'fire', 'laugh', 'wow', 'sad', 'clap')),
  created_at    timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists feed_comment_reactions_comment_idx
  on public.feed_comment_reactions(comment_id);

alter table public.feed_comment_reactions enable row level security;
grant all on public.feed_comment_reactions to authenticated;

create policy "feed_comment_reactions_select"
  on public.feed_comment_reactions for select
  using (
    exists (
      select 1 from public.feed_post_comments c
      where c.id = comment_id and c.deleted_at is null
    )
  );

create policy "feed_comment_reactions_insert"
  on public.feed_comment_reactions for insert
  with check (user_id = auth.uid());

create policy "feed_comment_reactions_update"
  on public.feed_comment_reactions for update
  using (user_id = auth.uid());

create policy "feed_comment_reactions_delete"
  on public.feed_comment_reactions for delete
  using (user_id = auth.uid());
