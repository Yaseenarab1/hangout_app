-- ============================================================================
-- Hangout Planner — Storage RLS Policies
-- ============================================================================
-- Apply these AFTER creating the buckets in the Supabase dashboard:
--   - avatars         (public)
--   - post-images     (private)
--   - album-photos    (private)
--   - receipts        (private)
--
-- Storage policies live in the `storage.objects` table.
-- The path convention we use: `{user_id}/{filename}` for owner-scoped objects.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- avatars: public read, owner-only write/update/delete
-- ----------------------------------------------------------------------------

create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_owner_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- post-images: read by anyone who can see the post (Phase 3 — placeholder for now)
-- ----------------------------------------------------------------------------
-- Path convention: `{author_id}/{post_id}/{filename}`
-- For Phase 1 we lock this down completely (no posts feature yet).
-- Phase 3 will replace these policies with the post-visibility-aware versions.

create policy "post_images_owner_only"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- album-photos: participants of the hangout (Phase 3 — placeholder)
-- ----------------------------------------------------------------------------
-- Path convention: `{hangout_id}/{uploader_id}/{filename}`
-- Phase 3 will add hangout-participant-aware policies. For now, owner-only.

create policy "album_photos_owner_only"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'album-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'album-photos'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- receipts: bill creators only (Phase 4 — placeholder)
-- ----------------------------------------------------------------------------
-- Path convention: `{hangout_id}/{bill_id}/{filename}`
-- For Phase 1, owner-only as a safe default. Phase 4 will add the real rules.

create policy "receipts_owner_only"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
