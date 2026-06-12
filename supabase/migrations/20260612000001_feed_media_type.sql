-- Add media_type column to feed_posts to support video posts.
-- Existing rows default to 'photo'.
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'photo'
    CHECK (media_type IN ('photo', 'video'));

-- Also add video-specific metadata columns.
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS duration_ms integer; -- video duration in ms, null for photos
