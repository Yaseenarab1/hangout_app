-- ============================================================================
-- Hangout Planner — Row Level Security Policies
-- ============================================================================
-- This file is THE security boundary. Every table is RLS-enabled.
-- Default = deny. Every read and write must match an explicit policy.
--
-- IMPORTANT: When adding a new table, you MUST also:
--   1. enable RLS on it
--   2. write at least one policy
--   3. add a test in supabase/tests/rls/<table>.test.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enable RLS on every table
-- ----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.hangouts enable row level security;
alter table public.hangout_participants enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.itinerary_stops enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.post_visibility_allowlist enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
alter table public.albums enable row level security;
alter table public.album_photos enable row level security;
alter table public.bills enable row level security;
alter table public.bill_splits enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.calendar_visibility_allowlist enable row level security;
alter table public.time_polls enable row level security;
alter table public.time_poll_slots enable row level security;
alter table public.time_poll_responses enable row level security;
alter table public.location_sessions enable row level security;
alter table public.location_pings enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

-- Force RLS even for table owners (paranoid mode — Supabase default but make it explicit)
alter table public.profiles force row level security;
alter table public.messages force row level security;
alter table public.bills force row level security;
alter table public.location_pings force row level security;

-- ----------------------------------------------------------------------------
-- Profiles
-- ----------------------------------------------------------------------------
-- READ: any authenticated user can read any non-deleted profile (basic discoverability).
--       But blocked users hide each other (handled in app + view).
-- WRITE: a user can only insert/update their own profile.

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (
    deleted_at is null
    and not exists (
      select 1 from public.blocks
      where (blocker_id = auth.uid() and blocked_id = profiles.id)
         or (blocker_id = profiles.id and blocked_id = auth.uid())
    )
  );

create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- DELETE is handled via a soft-delete edge function, not direct.

-- ----------------------------------------------------------------------------
-- Friendships
-- ----------------------------------------------------------------------------

create policy "friendships_select_member"
  on public.friendships for select
  to authenticated
  using (auth.uid() in (user_a_id, user_b_id));

-- Friendship rows are created by an Edge Function on accepting a request.
-- We do not allow direct inserts from the client.
create policy "friendships_no_direct_insert"
  on public.friendships for insert
  to authenticated
  with check (false);

create policy "friendships_delete_member"
  on public.friendships for delete
  to authenticated
  using (auth.uid() in (user_a_id, user_b_id));

-- ----------------------------------------------------------------------------
-- Friend requests
-- ----------------------------------------------------------------------------

create policy "friend_requests_select_member"
  on public.friend_requests for select
  to authenticated
  using (auth.uid() in (sender_id, recipient_id));

create policy "friend_requests_insert_self_as_sender"
  on public.friend_requests for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and not exists (
      select 1 from public.blocks
      where (blocker_id = recipient_id and blocked_id = auth.uid())
         or (blocker_id = auth.uid() and blocked_id = recipient_id)
    )
  );

-- Recipient updates status (accept/decline). Sender can cancel.
create policy "friend_requests_update_recipient"
  on public.friend_requests for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "friend_requests_update_sender_cancel"
  on public.friend_requests for update
  to authenticated
  using (sender_id = auth.uid() and status = 'pending')
  with check (sender_id = auth.uid() and status = 'cancelled');

-- ----------------------------------------------------------------------------
-- Hangouts
-- ----------------------------------------------------------------------------

create policy "hangouts_select_participant"
  on public.hangouts for select
  to authenticated
  using (
    host_id = auth.uid()
    or public.is_hangout_participant(id, auth.uid())
  );

create policy "hangouts_insert_self_as_host"
  on public.hangouts for insert
  to authenticated
  with check (host_id = auth.uid());

create policy "hangouts_update_host_or_cohost"
  on public.hangouts for update
  to authenticated
  using (
    host_id = auth.uid()
    or exists (
      select 1 from public.hangout_participants hp
      where hp.hangout_id = hangouts.id
        and hp.user_id = auth.uid()
        and hp.role = 'co_host'
    )
  );

create policy "hangouts_delete_host"
  on public.hangouts for delete
  to authenticated
  using (host_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Hangout participants
-- ----------------------------------------------------------------------------

create policy "hp_select_co_participants"
  on public.hangout_participants for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_hangout_participant(hangout_id, auth.uid())
    or public.is_hangout_host(hangout_id, auth.uid())
  );

-- Host (or co-host) invites others.
create policy "hp_insert_by_host"
  on public.hangout_participants for insert
  to authenticated
  with check (
    public.is_hangout_host(hangout_id, auth.uid())
    or exists (
      select 1 from public.hangout_participants hp
      where hp.hangout_id = hangout_participants.hangout_id
        and hp.user_id = auth.uid()
        and hp.role = 'co_host'
    )
  );

-- Self-update: a participant updates their own status (accept/decline) and mute.
-- Host: updates anyone's role/weight.
create policy "hp_update_self"
  on public.hangout_participants for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "hp_update_by_host"
  on public.hangout_participants for update
  to authenticated
  using (public.is_hangout_host(hangout_id, auth.uid()))
  with check (public.is_hangout_host(hangout_id, auth.uid()));

-- ----------------------------------------------------------------------------
-- Polls + options + votes
-- ----------------------------------------------------------------------------

create policy "polls_select_participant"
  on public.polls for select
  to authenticated
  using (public.is_hangout_participant(hangout_id, auth.uid())
         or public.is_hangout_host(hangout_id, auth.uid()));

create policy "polls_insert_host"
  on public.polls for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.is_hangout_host(hangout_id, auth.uid())
  );

create policy "polls_update_host"
  on public.polls for update
  to authenticated
  using (public.is_hangout_host(hangout_id, auth.uid()));

-- Poll options
create policy "poll_options_select_participant"
  on public.poll_options for select
  to authenticated
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_options.poll_id
        and (
          public.is_hangout_participant(p.hangout_id, auth.uid())
          or public.is_hangout_host(p.hangout_id, auth.uid())
        )
    )
  );

-- Anyone in the hangout can add options DURING the suggesting phase OR if mode = simple_vote and they are the host.
create policy "poll_options_insert_during_suggest"
  on public.poll_options for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and exists (
      select 1 from public.polls p
      where p.id = poll_options.poll_id
        and (
          public.is_hangout_participant(p.hangout_id, auth.uid())
          or public.is_hangout_host(p.hangout_id, auth.uid())
        )
        and (
          (p.mode = 'suggest_then_vote' and p.phase = 'suggesting')
          or (p.mode = 'simple_vote' and p.created_by = auth.uid())
        )
    )
  );

-- Votes
create policy "votes_select_participant"
  on public.votes for select
  to authenticated
  using (
    exists (
      select 1 from public.polls p
      where p.id = votes.poll_id
        and (
          public.is_hangout_participant(p.hangout_id, auth.uid())
          or public.is_hangout_host(p.hangout_id, auth.uid())
        )
    )
  );

create policy "votes_insert_during_voting"
  on public.votes for insert
  to authenticated
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.polls p
      where p.id = votes.poll_id
        and p.phase = 'voting'
        and p.vote_deadline > now()
        and public.is_hangout_participant(p.hangout_id, auth.uid())
    )
  );

create policy "votes_update_self_during_voting"
  on public.votes for update
  to authenticated
  using (
    voter_id = auth.uid()
    and exists (
      select 1 from public.polls p
      where p.id = votes.poll_id
        and p.phase = 'voting'
        and p.vote_deadline > now()
    )
  );

-- ----------------------------------------------------------------------------
-- Itinerary stops
-- ----------------------------------------------------------------------------

create policy "stops_select_participant"
  on public.itinerary_stops for select
  to authenticated
  using (
    public.is_hangout_participant(hangout_id, auth.uid())
    or public.is_hangout_host(hangout_id, auth.uid())
  );

create policy "stops_modify_host"
  on public.itinerary_stops for all
  to authenticated
  using (public.is_hangout_host(hangout_id, auth.uid()))
  with check (public.is_hangout_host(hangout_id, auth.uid()));

-- ----------------------------------------------------------------------------
-- Messages
-- ----------------------------------------------------------------------------

create policy "messages_select_participant"
  on public.messages for select
  to authenticated
  using (
    public.is_hangout_participant(hangout_id, auth.uid())
    or public.is_hangout_host(hangout_id, auth.uid())
  );

create policy "messages_insert_self_as_participant"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_hangout_participant(hangout_id, auth.uid())
      or public.is_hangout_host(hangout_id, auth.uid())
    )
  );

-- Edit your own message (within 5 min) or soft-delete it.
create policy "messages_update_self"
  on public.messages for update
  to authenticated
  using (sender_id = auth.uid() and created_at > now() - interval '5 minutes')
  with check (sender_id = auth.uid());

-- Message reads
create policy "message_reads_select_self"
  on public.message_reads for select
  to authenticated
  using (user_id = auth.uid());

create policy "message_reads_insert_self"
  on public.message_reads for insert
  to authenticated
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Posts, images, reactions, comments
-- ----------------------------------------------------------------------------

-- A user can see a post if:
--   - they are the author, OR
--   - visibility = friends and they are friends with the author, OR
--   - visibility = hangout_only and they were a participant of that hangout, OR
--   - visibility = selected and they appear in the allowlist.
-- Plus: never if blocked either way.

create policy "posts_select_visible"
  on public.posts for select
  to authenticated
  using (
    deleted_at is null
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = posts.author_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid() and b.blocked_id = posts.author_id)
    )
    and (
      author_id = auth.uid()
      or (visibility = 'friends' and public.are_friends(author_id, auth.uid()))
      or (
        visibility = 'hangout_only'
        and hangout_id is not null
        and public.is_hangout_participant(hangout_id, auth.uid())
      )
      or (
        visibility = 'selected'
        and exists (
          select 1 from public.post_visibility_allowlist a
          where a.post_id = posts.id and a.user_id = auth.uid()
        )
      )
    )
  );

create policy "posts_insert_self"
  on public.posts for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "posts_update_self"
  on public.posts for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Images, allowlist, reactions, comments inherit visibility via the parent post.

create policy "post_images_select_via_post"
  on public.post_images for select
  to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_images.post_id) -- RLS on posts filters
  );

create policy "post_images_insert_by_author"
  on public.post_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_images.post_id and p.author_id = auth.uid()
    )
  );

create policy "post_visibility_allowlist_select_via_post"
  on public.post_visibility_allowlist for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_visibility_allowlist.post_id and p.author_id = auth.uid()
    )
  );

create policy "post_visibility_allowlist_modify_by_author"
  on public.post_visibility_allowlist for all
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_visibility_allowlist.post_id and p.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_visibility_allowlist.post_id and p.author_id = auth.uid()
    )
  );

create policy "reactions_select_via_post"
  on public.post_reactions for select
  to authenticated
  using (exists (select 1 from public.posts p where p.id = post_reactions.post_id));

create policy "reactions_insert_self"
  on public.post_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_reactions.post_id)
  );

create policy "reactions_delete_self"
  on public.post_reactions for delete
  to authenticated
  using (user_id = auth.uid());

create policy "comments_select_via_post"
  on public.post_comments for select
  to authenticated
  using (
    deleted_at is null
    and exists (select 1 from public.posts p where p.id = post_comments.post_id)
  );

create policy "comments_insert_self"
  on public.post_comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_comments.post_id)
  );

create policy "comments_update_self"
  on public.post_comments for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Albums + photos
-- ----------------------------------------------------------------------------

create policy "albums_select_participant"
  on public.albums for select
  to authenticated
  using (
    public.is_hangout_participant(hangout_id, auth.uid())
    or public.is_hangout_host(hangout_id, auth.uid())
  );

-- Album rows are created by trigger when a hangout is created — no client inserts.
create policy "albums_no_direct_insert"
  on public.albums for insert
  to authenticated with check (false);

create policy "album_photos_select_participant"
  on public.album_photos for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.albums a
      where a.id = album_photos.album_id
        and (
          public.is_hangout_participant(a.hangout_id, auth.uid())
          or public.is_hangout_host(a.hangout_id, auth.uid())
        )
    )
  );

create policy "album_photos_insert_participant"
  on public.album_photos for insert
  to authenticated
  with check (
    uploader_id = auth.uid()
    and exists (
      select 1 from public.albums a
      where a.id = album_photos.album_id
        and (
          public.is_hangout_participant(a.hangout_id, auth.uid())
          or public.is_hangout_host(a.hangout_id, auth.uid())
        )
    )
  );

-- Soft-delete: uploader can delete their own; host can delete any photo in their hangout.
create policy "album_photos_update_uploader_or_host"
  on public.album_photos for update
  to authenticated
  using (
    uploader_id = auth.uid()
    or exists (
      select 1 from public.albums a
      where a.id = album_photos.album_id
        and public.is_hangout_host(a.hangout_id, auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- Bills
-- ----------------------------------------------------------------------------

create policy "bills_select_participant"
  on public.bills for select
  to authenticated
  using (
    deleted_at is null
    and (
      public.is_hangout_participant(hangout_id, auth.uid())
      or public.is_hangout_host(hangout_id, auth.uid())
    )
  );

create policy "bills_insert_participant"
  on public.bills for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and (
      public.is_hangout_participant(hangout_id, auth.uid())
      or public.is_hangout_host(hangout_id, auth.uid())
    )
  );

create policy "bills_update_creator_or_host"
  on public.bills for update
  to authenticated
  using (
    added_by = auth.uid()
    or public.is_hangout_host(hangout_id, auth.uid())
  );

create policy "bill_splits_select_via_bill"
  on public.bill_splits for select
  to authenticated
  using (exists (select 1 from public.bills b where b.id = bill_splits.bill_id));

create policy "bill_splits_modify_via_bill_creator"
  on public.bill_splits for all
  to authenticated
  using (
    exists (
      select 1 from public.bills b
      where b.id = bill_splits.bill_id
        and (b.added_by = auth.uid() or public.is_hangout_host(b.hangout_id, auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_splits.bill_id
        and (b.added_by = auth.uid() or public.is_hangout_host(b.hangout_id, auth.uid()))
    )
  );

-- Allow the debtor themselves to update settled_at (mark as paid).
create policy "bill_splits_settle_self"
  on public.bill_splits for update
  to authenticated
  using (debtor_id = auth.uid())
  with check (debtor_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Availability + Find Time
-- ----------------------------------------------------------------------------

create policy "availability_select_self"
  on public.availability_blocks for select
  to authenticated
  using (user_id = auth.uid());

-- Friends can see availability based on visibility setting.
create policy "availability_select_friends"
  on public.availability_blocks for select
  to authenticated
  using (
    user_id <> auth.uid()
    and (
      (visibility = 'friends' and public.are_friends(user_id, auth.uid()))
      or (
        visibility = 'selected'
        and exists (
          select 1 from public.calendar_visibility_allowlist a
          where a.user_id = availability_blocks.user_id
            and a.visible_to_user_id = auth.uid()
        )
      )
    )
  );

create policy "availability_modify_self"
  on public.availability_blocks for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "calendar_allowlist_self"
  on public.calendar_visibility_allowlist for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "time_polls_select_participant"
  on public.time_polls for select
  to authenticated
  using (
    hangout_id is null and created_by = auth.uid()
    or (
      hangout_id is not null
      and (
        public.is_hangout_participant(hangout_id, auth.uid())
        or public.is_hangout_host(hangout_id, auth.uid())
      )
    )
  );

create policy "time_polls_insert_self"
  on public.time_polls for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "time_polls_update_creator"
  on public.time_polls for update
  to authenticated
  using (created_by = auth.uid());

create policy "time_poll_slots_via_poll"
  on public.time_poll_slots for select
  to authenticated
  using (exists (select 1 from public.time_polls p where p.id = time_poll_slots.time_poll_id));

create policy "time_poll_slots_modify_creator"
  on public.time_poll_slots for all
  to authenticated
  using (
    exists (
      select 1 from public.time_polls p
      where p.id = time_poll_slots.time_poll_id
        and p.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.time_polls p
      where p.id = time_poll_slots.time_poll_id
        and p.created_by = auth.uid()
    )
  );

create policy "time_poll_responses_select_via_poll"
  on public.time_poll_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.time_poll_slots s
      join public.time_polls p on p.id = s.time_poll_id
      where s.id = time_poll_responses.slot_id
    )
  );

create policy "time_poll_responses_insert_self"
  on public.time_poll_responses for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "time_poll_responses_update_self"
  on public.time_poll_responses for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Location sharing
-- ----------------------------------------------------------------------------

create policy "location_sessions_select_participants"
  on public.location_sessions for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_hangout_participant(hangout_id, auth.uid())
    or public.is_hangout_host(hangout_id, auth.uid())
  );

create policy "location_sessions_insert_self"
  on public.location_sessions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_hangout_participant(hangout_id, auth.uid())
      or public.is_hangout_host(hangout_id, auth.uid())
    )
  );

create policy "location_sessions_update_self"
  on public.location_sessions for update
  to authenticated
  using (user_id = auth.uid());

create policy "location_pings_select_participants"
  on public.location_pings for select
  to authenticated
  using (
    exists (
      select 1 from public.location_sessions s
      where s.id = location_pings.session_id
        and s.ended_at is null
        and s.expires_at > now()
        and (
          s.user_id = auth.uid()
          or public.is_hangout_participant(s.hangout_id, auth.uid())
          or public.is_hangout_host(s.hangout_id, auth.uid())
        )
    )
  );

create policy "location_pings_upsert_session_owner"
  on public.location_pings for all
  to authenticated
  using (
    exists (
      select 1 from public.location_sessions s
      where s.id = location_pings.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.location_sessions s
      where s.id = location_pings.session_id and s.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Notifications
-- ----------------------------------------------------------------------------

create policy "notifications_select_self"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Notifications are inserted by Edge Functions / triggers (service role), not by users.
create policy "notifications_no_direct_insert"
  on public.notifications for insert to authenticated with check (false);

create policy "notifications_update_self_read"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notification_prefs_self"
  on public.notification_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Reports + blocks
-- ----------------------------------------------------------------------------

create policy "reports_insert_self"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "reports_select_self"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());

create policy "blocks_self"
  on public.blocks for all
  to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- ============================================================================
-- End of policies. Tests live in supabase/tests/rls/
-- ============================================================================
