-- ─── Storage bucket ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('hangout-photos', 'hangout-photos', false)
on conflict do nothing;

-- ─── Storage RLS ──────────────────────────────────────────────────────────────
create policy "hangout_photos_read"
  on storage.objects for select
  using (
    bucket_id = 'hangout-photos'
    and is_hangout_participant(
      (string_to_array(name, '/'))[1]::uuid,
      auth.uid()
    )
  );

create policy "hangout_photos_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'hangout-photos'
    and is_hangout_participant(
      (string_to_array(name, '/'))[1]::uuid,
      auth.uid()
    )
  );

create policy "hangout_photos_delete_own"
  on storage.objects for delete
  using (bucket_id = 'hangout-photos' and owner = auth.uid());

-- ─── hangout_photos ───────────────────────────────────────────────────────────
create table public.hangout_photos (
  id            uuid        primary key default gen_random_uuid(),
  hangout_id    uuid        not null references public.hangouts(id) on delete cascade,
  uploader_id   uuid        not null references public.profiles(id) on delete cascade,
  storage_path  text        not null,
  thumbnail_path text,
  width         int         not null default 0,
  height        int         not null default 0,
  size_bytes    int         not null default 0,
  mime_type     text        not null default 'image/jpeg',
  caption       text        check (caption is null or char_length(caption) <= 500),
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

create index hangout_photos_hangout_idx on public.hangout_photos(hangout_id, created_at desc);
create index hangout_photos_uploader_idx on public.hangout_photos(uploader_id);

alter table public.hangout_photos enable row level security;

grant all on public.hangout_photos to authenticated;

create policy "participants_read_photos"
  on public.hangout_photos for select
  using (is_hangout_participant(hangout_id, auth.uid()));

create policy "participants_insert_photos"
  on public.hangout_photos for insert
  with check (
    auth.uid() = uploader_id
    and is_hangout_participant(hangout_id, auth.uid())
  );

create policy "uploaders_update_caption"
  on public.hangout_photos for update
  using (auth.uid() = uploader_id);

create policy "uploaders_delete_own"
  on public.hangout_photos for delete
  using (auth.uid() = uploader_id);

alter publication supabase_realtime add table public.hangout_photos;

-- ─── photo_reactions ──────────────────────────────────────────────────────────
create table public.photo_reactions (
  photo_id   uuid not null references public.hangout_photos(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id, emoji)
);

alter table public.photo_reactions enable row level security;

grant all on public.photo_reactions to authenticated;

create policy "participants_read_reactions"
  on public.photo_reactions for select
  using (
    exists (
      select 1 from public.hangout_photos p
      where p.id = photo_id
        and is_hangout_participant(p.hangout_id, auth.uid())
    )
  );

create policy "participants_react"
  on public.photo_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.hangout_photos p
      where p.id = photo_id
        and is_hangout_participant(p.hangout_id, auth.uid())
    )
  );

create policy "users_delete_own_reactions"
  on public.photo_reactions for delete
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.photo_reactions;
