# Phase 3B — Shared photo albums (per-hangout)

## Prereq
Phase 3.0 (push + realtime). Phase 3A is recommended but not strictly
required (chat infrastructure is reused for "X added 5 photos" message
notifications, but can also stand alone).

## What we're building
Each hangout has a shared photo album. Participants can upload, view,
react, and download photos. EXIF stripped on upload for privacy.
Thumbnails generated server-side.

## Storage

### Bucket: `hangout-photos`
- Created via Supabase dashboard or migration:
```sql
insert into storage.buckets (id, name, public)
values ('hangout-photos', 'hangout-photos', false)
on conflict do nothing;
```

- RLS on bucket (storage.objects):
```sql
-- Path format: <hangout_id>/<photo_id>.jpg and <hangout_id>/<photo_id>_thumb.webp
create policy "participants read photos"
  on storage.objects for select
  using (
    bucket_id = 'hangout-photos'
    and is_hangout_participant(
      (string_to_array(name, '/'))[1]::uuid,
      auth.uid()
    )
  );

create policy "participants upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'hangout-photos'
    and is_hangout_participant(
      (string_to_array(name, '/'))[1]::uuid,
      auth.uid()
    )
    and auth.uid() = owner
  );

create policy "owners delete own photos"
  on storage.objects for delete
  using (bucket_id = 'hangout-photos' and auth.uid() = owner);
```

## Database

### `hangout_photos` table — metadata for each photo
```sql
create table public.hangout_photos (
  id uuid primary key default gen_random_uuid(),
  hangout_id uuid not null references public.hangouts(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,        -- "<hangout_id>/<photo_id>.jpg"
  thumbnail_path text,                -- "<hangout_id>/<photo_id>_thumb.webp"
  width int not null,
  height int not null,
  size_bytes int not null,
  mime_type text not null,
  caption text check (caption is null or length(caption) <= 500),
  taken_at timestamptz,                -- from EXIF if present, before strip
  created_at timestamptz not null default now()
);

create index hangout_photos_hangout_idx on public.hangout_photos(hangout_id, created_at desc);
create index hangout_photos_uploader_idx on public.hangout_photos(uploader_id);

alter table public.hangout_photos enable row level security;

create policy "participants read photo metadata"
  on public.hangout_photos for select
  using (is_hangout_participant(hangout_id, auth.uid()));

create policy "participants insert photo metadata"
  on public.hangout_photos for insert
  with check (
    auth.uid() = uploader_id
    and is_hangout_participant(hangout_id, auth.uid())
  );

create policy "uploaders update own captions"
  on public.hangout_photos for update
  using (auth.uid() = uploader_id);

create policy "uploaders delete own"
  on public.hangout_photos for delete
  using (auth.uid() = uploader_id);
```

### `photo_reactions` table
```sql
create table public.photo_reactions (
  photo_id uuid not null references public.hangout_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id, emoji)
);

alter table public.photo_reactions enable row level security;

create policy "participants read reactions"
  on public.photo_reactions for select
  using (
    exists (
      select 1 from public.hangout_photos p
      where p.id = photo_id
      and is_hangout_participant(p.hangout_id, auth.uid())
    )
  );

create policy "participants react"
  on public.photo_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.hangout_photos p
      where p.id = photo_id
      and is_hangout_participant(p.hangout_id, auth.uid())
    )
  );

create policy "users delete own reactions"
  on public.photo_reactions for delete
  using (auth.uid() = user_id);
```

### Trigger: notify on photo added
```sql
create or replace function public.notify_photo_inserted()
returns trigger as $$
declare
  v_recipients uuid[];
  v_uploader_name text;
  v_hangout_title text;
  v_count int;
begin
  -- Coalesce: if multiple photos added within 60s by same user, count them
  select count(*) into v_count
  from public.hangout_photos
  where hangout_id = new.hangout_id
    and uploader_id = new.uploader_id
    and created_at > now() - interval '60 seconds';

  -- Only notify on first photo of a burst
  if v_count > 1 then
    return new;
  end if;

  select array_agg(p.user_id) into v_recipients
  from public.hangout_participants p
  where p.hangout_id = new.hangout_id
    and p.status in ('invited', 'accepted', 'maybe')
    and p.user_id != new.uploader_id;

  if v_recipients is null then return new; end if;

  select display_name into v_uploader_name from public.profiles where id = new.uploader_id;
  select title into v_hangout_title from public.hangouts where id = new.hangout_id;

  perform extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'userIds', v_recipients,
      'type', 'photo_added',
      'refId', new.hangout_id,
      'title', coalesce(v_uploader_name, 'Someone') || ' added photos',
      'body', coalesce(v_hangout_title, 'Hangout'),
      'data', jsonb_build_object('hangoutId', new.hangout_id)
    )::text
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger photos_after_insert_push
  after insert on public.hangout_photos
  for each row execute function public.notify_photo_inserted();
```

### Schedule a "60s after first photo, send rollup" instead — alternative
If you want richer "added 5 photos" notifications, schedule a delayed
edge function instead of inline trigger. This is simpler for v1; defer
the rollup version.

## Edge functions

### `process-photo-upload` — generates thumbnails
`supabase/functions/process-photo-upload/index.ts`

Trigger: storage webhook on `INSERT` into `hangout-photos` bucket.
- Skip if path ends with `_thumb.webp` (don't recurse).
- Download original.
- Use `imagescript` or `magick-wasm` (Deno-compatible) to:
  - Resize to max 1600px on longest side (full-size).
  - Generate 400×400 cover-cropped webp thumbnail.
- Strip EXIF (set ExifTool tags or use library that does this by default).
- Upload thumbnail as `<hangout_id>/<photo_id>_thumb.webp`.
- Update `hangout_photos.thumbnail_path`.

If `imagescript` proves heavy, fallback: do the resize CLIENT-side with
`expo-image-manipulator` before upload, skip the edge function entirely.
**Recommended for v1**: client-side resize. Simpler, no edge function
to debug, faster perceived upload.

## UI / screens

### `app/hangout/[id]/photos.tsx` — replace stub

Layout:

```
┌─────────────────────────────┐
│ ← Photos          [+ Add]   │
├─────────────────────────────┤
│  ━━ Mon Apr 14 ━━           │
│  ┌───┬───┬───┬───┐          │  3-column grid
│  │   │   │   │   │          │  square thumbs
│  ├───┼───┼───┼───┤          │
│  │   │   │   │              │
│  └───┴───┴───┘              │
│  ━━ Sun Apr 13 ━━           │
│  ┌───┬───┬───┐              │
│  ...                        │
└─────────────────────────────┘
```

Group by upload date. Tap a photo → full-screen viewer.

### Full-screen viewer (`PhotoViewer` component)
- Pinch to zoom (use `react-native-gesture-handler` + `react-native-reanimated`)
- Swipe horizontally to next/prev photo
- Swipe down to dismiss
- Top-right: actions menu (Delete if own, Save to camera roll, Report)
- Bottom: caption (editable if own), reactions, uploader name

### Components
- `PhotoGrid` — date-grouped grid, FlatList with sections
- `PhotoTile` — single thumbnail, tap to open viewer
- `PhotoViewer` — full-screen viewer with gestures
- `PhotoUploader` — opens image picker (multi-select up to 10), shows
  upload progress per photo
- `PhotoCaptionEditor` — inline edit for own photos
- `ReactionRow` — emoji reactions visible on viewer

### Hooks
- `usePhotos(hangoutId)` — paginated list, realtime appends new uploads
- `useUploadPhoto(hangoutId)` — mutation, returns `{ progress, isPending }`
- `useDeletePhoto(photoId)` — soft-delete the row + storage object
- `useReactToPhoto(photoId)` — toggle reaction
- `useUpdateCaption(photoId)` — edit caption (only own)

### Upload pipeline (client-side)

```ts
// 1. User picks photos via expo-image-picker (multi-select)
// 2. For each photo:
//    a. Read EXIF for taken_at (then strip in next step)
//    b. Resize via expo-image-manipulator: max 1600px, JPEG 80%
//    c. Generate thumbnail: 400x400 cover-crop, webp 75%
//    d. Upload original to <hangout_id>/<uuid>.jpg
//    e. Upload thumb to <hangout_id>/<uuid>_thumb.webp
//    f. Insert hangout_photos row with both paths
// 3. Show progress bar per photo
// 4. On error: show retry button on that specific photo
```

### Hangout detail integration
Add "Photos" entry point with thumbnail count: "📷 8 photos".
On hangouts with > 0 photos, show a 3-photo preview strip on the detail
screen.

## Acceptance criteria

- [ ] Tap "Add photos" → image picker opens, multi-select up to 10
- [ ] Selected photos upload with progress indicator per photo
- [ ] After upload, photo appears in grid for everyone in hangout
- [ ] Other participants get push: "Mike added photos"
- [ ] Tap a thumbnail → full-screen viewer with pinch zoom + swipe
- [ ] Swipe to next/prev photo
- [ ] Swipe down to dismiss
- [ ] Long-press in viewer → action menu (delete own, save, share)
- [ ] React with emoji → appears under photo in real time
- [ ] Edit caption on own photo → updates in real time
- [ ] Delete own photo → removed from grid, file deleted from storage
- [ ] Non-participant cannot view photos (RLS, AND storage RLS)
- [ ] EXIF data stripped (verify with metadata tool on downloaded file)
- [ ] Thumbnails load fast (< 200ms each on wifi)
- [ ] Album opens in < 1s for 100 photos

## Edge cases

- User picks 50 photos → enforce max 10 per upload session (UX limit)
- Network drops mid-upload → individual photo retry, others succeed
- Storage bucket full / quota → show meaningful error, don't crash
- Photo too small (< 200px) → upload fine, just looks pixelated
- Photo larger than 25MB before resize → resize succeeds, upload OK
- HEIC photos from iPhone → expo-image-manipulator converts to JPEG
- Live Photo (HEIC + MOV) → only the still image uploads, video discarded
- User deletes a photo someone reacted to → reactions cascade-delete
- User uploads same photo twice → no dedup; both appear (acceptable)
- Caption with emoji + special chars → fine, stored as-is
- User without camera permission tries to add photo → falls back to
  library picker
- User without library permission → show prompt to grant in Settings
- Upload completes, then trigger fires push, then hangout was deleted
  mid-upload → cascade handles it; push won't deliver but no crash
- User scrolls fast through 200 photos → use `recyclerlistview` or
  FlatList with `removeClippedSubviews` to prevent memory bloat
- Pinch zoom past max → snap back smoothly
- App backgrounded mid-upload → upload continues if iOS allows
  (use `expo-background-fetch` if needed; v1 just shows error if
  interrupted)

## File-by-file plan

### Database
- `supabase/migrations/<ts>_phase3b_photos.sql` — tables, RLS, trigger.
- Storage bucket creation (verify in dashboard or include in migration).

### Edge functions
- (Optional) `process-photo-upload/index.ts` — only if doing server-side
  thumbnails. **Default v1: skip; do client-side.**

### Feature folder
- `src/features/photos/types.ts`
- `src/features/photos/services/photos.service.ts`
- `src/features/photos/services/upload.service.ts` — handles resize +
  thumbnail + storage + DB row insert
- `src/features/photos/hooks/usePhotos.ts`
- `src/features/photos/hooks/useUploadPhoto.ts`
- `src/features/photos/hooks/useDeletePhoto.ts`
- `src/features/photos/hooks/useReactToPhoto.ts`
- `src/features/photos/hooks/useUpdateCaption.ts`
- `src/features/photos/components/PhotoGrid.tsx`
- `src/features/photos/components/PhotoTile.tsx`
- `src/features/photos/components/PhotoViewer.tsx`
- `src/features/photos/components/PhotoUploader.tsx`
- `src/features/photos/components/PhotoCaptionEditor.tsx`
- `src/features/photos/index.ts`

### Routes
- `app/hangout/[id]/photos.tsx` — replace stub
- `app/hangout/[id]/photos/[photoId].tsx` — full-screen viewer
  (alternatively render the viewer as a Modal in the photos screen — pick
  whichever Claude Code thinks is cleaner; modal is simpler)

### Wiring
- Hangout detail → Photos entry point with count + preview strip

## Test plan

1. Migration + bucket created. Storage RLS verified.
2. Two devices, same hangout.
3. A uploads 3 photos → grid shows them, B sees them in real time.
4. B gets push notification on lock screen.
5. B taps push → opens to photos screen.
6. B taps a photo → viewer opens.
7. B pinches → zooms.
8. B swipes → next photo.
9. B reacts 🔥 → A sees it instantly.
10. A edits caption → B sees the new caption.
11. A deletes a photo → B's grid updates immediately.
12. RLS: non-participant cannot SELECT from `hangout_photos` or storage.

## Done when
- All acceptance criteria pass
- `npx tsc --noEmit` clean
- 100-photo album opens in <1s
- EXIF stripped (verify with `exiftool` on downloaded photo)
- Migration committed: `git commit -m "Phase 3B: shared photo albums"`
