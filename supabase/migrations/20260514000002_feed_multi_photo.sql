-- Phase 3C: multi-photo posts + keep-forever
-- media_paths stores all photo storage paths (1-4). storage_path stays for backward compat.
alter table public.feed_posts
  add column if not exists media_paths text[] default null;
