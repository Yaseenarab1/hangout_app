-- ============================================================================
-- Hangout Planner — Database Schema (v3 — bulletproof)
-- ============================================================================
-- Uses gen_random_uuid() (built into Postgres 13+, no extension needed).
-- Helper functions defined AFTER the tables they reference.
-- ============================================================================

-- 1. Extensions (Supabase convention: in `extensions` schema)
create schema if not exists extensions;
create extension if not exists "pg_trgm" with schema extensions;
create extension if not exists "postgis" with schema extensions;
set search_path to public, extensions;

-- 2. Generic helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3. Profiles and friendships
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name    text not null check (char_length(display_name) between 2 and 32),
  bio             text check (char_length(bio) <= 280),
  avatar_url      text,
  push_token      text,
  last_active_at  timestamptz default now(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  default_post_visibility     text not null default 'friends'
    check (default_post_visibility in ('friends', 'hangout_only', 'selected')),
  default_calendar_visibility text not null default 'friends'
    check (default_calendar_visibility in ('friends', 'private', 'selected')),
  deleted_at      timestamptz
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.friendships (
  user_a_id   uuid not null references public.profiles(id) on delete cascade,
  user_b_id   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (user_a_id, user_b_id),
  check (user_a_id <> user_b_id),
  check (user_a_id < user_b_id)
);

create or replace function public.canonicalize_friendship()
returns trigger language plpgsql as $$
begin
  if new.user_a_id > new.user_b_id then
    new := row(new.user_b_id, new.user_a_id, new.created_at)::public.friendships;
  end if;
  return new;
end;
$$;

create trigger friendships_canonicalize before insert on public.friendships
  for each row execute function public.canonicalize_friendship();

create table public.friend_requests (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message       text check (char_length(message) <= 200),
  created_at    timestamptz default now(),
  responded_at  timestamptz,
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);

-- 4. Hangouts and participants
create type hangout_status as enum ('planning', 'scheduled', 'in_progress', 'completed', 'cancelled');

create table public.hangouts (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references public.profiles(id) on delete restrict,
  title           text not null check (char_length(title) between 1 and 100),
  description     text check (char_length(description) <= 500),
  status          hangout_status not null default 'planning',
  start_time      timestamptz,
  end_time        timestamptz,
  primary_location_name text,
  primary_location_address text,
  primary_location_geo  geography(point, 4326),
  cover_photo_url text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  cancelled_at    timestamptz,
  check (end_time is null or end_time > start_time)
);
create trigger hangouts_updated_at before update on public.hangouts
  for each row execute function public.set_updated_at();

create type participant_status as enum ('invited', 'accepted', 'declined', 'maybe', 'removed');
create type participant_role as enum ('host', 'co_host', 'guest');

create table public.hangout_participants (
  hangout_id  uuid not null references public.hangouts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      participant_status not null default 'invited',
  role        participant_role not null default 'guest',
  invited_by  uuid references public.profiles(id) on delete set null,
  invited_at  timestamptz default now(),
  responded_at timestamptz,
  vote_weight numeric(3,1) not null default 1.0
                check (vote_weight between 0.5 and 3.0),
  notifications_muted boolean not null default false,
  primary key (hangout_id, user_id)
);

-- 5. Polls and votes
create type poll_kind as enum ('activity', 'cuisine', 'restaurant');
create type poll_mode as enum ('simple_vote', 'suggest_then_vote');
create type poll_phase as enum ('suggesting', 'voting', 'closed');

create table public.polls (
  id                uuid primary key default gen_random_uuid(),
  hangout_id        uuid not null references public.hangouts(id) on delete cascade,
  created_by        uuid not null references public.profiles(id) on delete restrict,
  kind              poll_kind not null,
  mode              poll_mode not null,
  phase             poll_phase not null default 'voting',
  title             text not null check (char_length(title) between 1 and 100),
  suggest_deadline  timestamptz,
  vote_deadline     timestamptz not null,
  winning_option_id uuid,
  created_at        timestamptz default now(),
  closed_at         timestamptz,
  check (
    (mode = 'suggest_then_vote' and suggest_deadline is not null)
    or (mode = 'simple_vote' and suggest_deadline is null)
  )
);

create table public.poll_options (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references public.polls(id) on delete cascade,
  added_by      uuid not null references public.profiles(id) on delete restrict,
  label         text not null check (char_length(label) between 1 and 100),
  google_place_id text,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

alter table public.polls
  add constraint polls_winning_option_fk
  foreign key (winning_option_id) references public.poll_options(id) on delete set null;

create table public.votes (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references public.polls(id) on delete cascade,
  option_id     uuid not null references public.poll_options(id) on delete cascade,
  voter_id      uuid not null references public.profiles(id) on delete cascade,
  weight        numeric(3,1) not null,
  created_at    timestamptz default now(),
  unique (poll_id, voter_id)
);

-- 6. Itineraries
create table public.itinerary_stops (
  id              uuid primary key default gen_random_uuid(),
  hangout_id      uuid not null references public.hangouts(id) on delete cascade,
  order_index     int not null check (order_index >= 0),
  title           text not null check (char_length(title) between 1 and 100),
  notes           text check (char_length(notes) <= 500),
  start_time      timestamptz,
  end_time        timestamptz,
  location_name   text,
  location_address text,
  location_geo    geography(point, 4326),
  google_place_id text,
  created_at      timestamptz default now(),
  unique (hangout_id, order_index),
  check (end_time is null or end_time > start_time)
);

-- 7. Messaging
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  hangout_id    uuid not null references public.hangouts(id) on delete cascade,
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 2000),
  created_at    timestamptz default now(),
  edited_at     timestamptz,
  deleted_at    timestamptz
);

create table public.message_reads (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  read_at     timestamptz default now(),
  primary key (message_id, user_id)
);

-- 8. Social feed
create type post_visibility as enum ('friends', 'hangout_only', 'selected');

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  hangout_id    uuid references public.hangouts(id) on delete set null,
  caption       text check (char_length(caption) <= 1000),
  visibility    post_visibility not null default 'friends',
  created_at    timestamptz default now(),
  deleted_at    timestamptz
);

create table public.post_images (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text not null,
  order_index int not null check (order_index between 0 and 9),
  created_at  timestamptz default now(),
  unique (post_id, order_index)
);

create table public.post_visibility_allowlist (
  post_id  uuid not null references public.posts(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create type reaction_kind as enum ('like', 'love', 'laugh', 'wow');

create table public.post_reactions (
  post_id   uuid not null references public.posts(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  kind      reaction_kind not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz default now(),
  deleted_at  timestamptz
);

-- 9. Albums
create table public.albums (
  id          uuid primary key default gen_random_uuid(),
  hangout_id  uuid not null unique references public.hangouts(id) on delete cascade,
  created_at  timestamptz default now()
);

create table public.album_photos (
  id              uuid primary key default gen_random_uuid(),
  album_id        uuid not null references public.albums(id) on delete cascade,
  uploader_id     uuid not null references public.profiles(id) on delete cascade,
  storage_path    text not null,
  thumbnail_path  text not null,
  caption         text check (char_length(caption) <= 200),
  width           int,
  height          int,
  created_at      timestamptz default now(),
  deleted_at      timestamptz
);

-- 10. Bills
create table public.bills (
  id              uuid primary key default gen_random_uuid(),
  hangout_id      uuid not null references public.hangouts(id) on delete cascade,
  added_by        uuid not null references public.profiles(id) on delete restrict,
  paid_by         uuid not null references public.profiles(id) on delete restrict,
  description     text not null check (char_length(description) between 1 and 200),
  amount_cents    bigint not null check (amount_cents > 0),
  currency        char(3) not null default 'USD',
  receipt_storage_path text,
  ocr_data        jsonb,
  occurred_at     timestamptz default now(),
  created_at      timestamptz default now(),
  deleted_at      timestamptz
);

create table public.bill_splits (
  id              uuid primary key default gen_random_uuid(),
  bill_id         uuid not null references public.bills(id) on delete cascade,
  debtor_id       uuid not null references public.profiles(id) on delete restrict,
  amount_cents    bigint not null check (amount_cents >= 0),
  settled_at      timestamptz,
  unique (bill_id, debtor_id)
);

-- 11. Find Time
create type calendar_visibility as enum ('friends', 'selected', 'private');

create table public.availability_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  visibility  calendar_visibility not null default 'friends',
  note        text check (char_length(note) <= 100),
  created_at  timestamptz default now(),
  check (ends_at > starts_at)
);

create table public.calendar_visibility_allowlist (
  user_id           uuid not null references public.profiles(id) on delete cascade,
  visible_to_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz default now(),
  primary key (user_id, visible_to_user_id),
  check (user_id <> visible_to_user_id)
);

create table public.time_polls (
  id              uuid primary key default gen_random_uuid(),
  hangout_id      uuid references public.hangouts(id) on delete cascade,
  created_by      uuid not null references public.profiles(id) on delete restrict,
  title           text not null check (char_length(title) between 1 and 100),
  vote_deadline   timestamptz not null,
  winning_slot_id uuid,
  closed_at       timestamptz,
  created_at      timestamptz default now()
);

create table public.time_poll_slots (
  id          uuid primary key default gen_random_uuid(),
  time_poll_id uuid not null references public.time_polls(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  check (ends_at > starts_at)
);

alter table public.time_polls
  add constraint time_polls_winning_slot_fk
  foreign key (winning_slot_id) references public.time_poll_slots(id) on delete set null;

create type slot_response as enum ('yes', 'no', 'maybe');

create table public.time_poll_responses (
  slot_id   uuid not null references public.time_poll_slots(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  response  slot_response not null,
  created_at timestamptz default now(),
  primary key (slot_id, user_id)
);

-- 12. Location sharing
create table public.location_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  hangout_id    uuid not null references public.hangouts(id) on delete cascade,
  started_at    timestamptz default now(),
  expires_at    timestamptz not null,
  ended_at      timestamptz,
  check (expires_at > started_at),
  check (expires_at < started_at + interval '8 hours')
);

create table public.location_pings (
  session_id  uuid primary key references public.location_sessions(id) on delete cascade,
  geo         geography(point, 4326) not null,
  accuracy_m  real,
  heading     real,
  speed_mps   real,
  updated_at  timestamptz default now()
);

-- 13. Notifications
create type notification_kind as enum (
  'friend_request_received', 'friend_request_accepted',
  'hangout_invited', 'poll_created', 'poll_deadline_soon',
  'poll_voting_opened', 'poll_closed', 'itinerary_published',
  'hangout_reminder', 'message_received', 'post_created_by_friend',
  'post_comment', 'bill_added', 'bill_marked_paid', 'location_shared_with_you'
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        notification_kind not null,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

create table public.notification_preferences (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  friend_request_received      boolean not null default true,
  friend_request_accepted      boolean not null default true,
  hangout_invited              boolean not null default true,
  poll_created                 boolean not null default true,
  poll_deadline_soon           boolean not null default true,
  poll_voting_opened           boolean not null default true,
  poll_closed                  boolean not null default true,
  itinerary_published          boolean not null default true,
  hangout_reminder             boolean not null default true,
  message_received             boolean not null default true,
  post_created_by_friend       boolean not null default true,
  post_comment                 boolean not null default true,
  bill_added                   boolean not null default true,
  bill_marked_paid             boolean not null default true,
  location_shared_with_you     boolean not null default true,
  updated_at                   timestamptz default now()
);

create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- 14. Reports and blocks
create type report_target_type as enum ('user', 'post', 'comment', 'message');
create type report_status as enum ('pending', 'reviewed', 'dismissed', 'actioned');

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  target_type   report_target_type not null,
  target_id     uuid not null,
  reason        text not null check (char_length(reason) between 1 and 500),
  status        report_status not null default 'pending',
  created_at    timestamptz default now(),
  reviewed_at   timestamptz
);

create table public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- 15. Helper functions (created AFTER tables they reference)
create or replace function public.is_hangout_participant(_hangout_id uuid, _user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.hangout_participants
    where hangout_id = _hangout_id and user_id = _user_id
      and status in ('invited', 'accepted')
  );
$$;

create or replace function public.is_hangout_host(_hangout_id uuid, _user_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.hangouts where id = _hangout_id and host_id = _user_id
  );
$$;

create or replace function public.are_friends(_user_a uuid, _user_b uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.friendships
    where (user_a_id = _user_a and user_b_id = _user_b)
       or (user_a_id = _user_b and user_b_id = _user_a)
  );
$$;

-- 16. Indexes
create index idx_profiles_username_trgm on public.profiles using gin (username extensions.gin_trgm_ops);
create index idx_profiles_display_name_trgm on public.profiles using gin (display_name extensions.gin_trgm_ops);
create index idx_friend_requests_recipient on public.friend_requests(recipient_id) where status = 'pending';
create index idx_hangouts_host on public.hangouts(host_id);
create index idx_hangouts_status_starttime on public.hangouts(status, start_time);
create index idx_hp_user on public.hangout_participants(user_id, status);
create index idx_hp_hangout on public.hangout_participants(hangout_id, status);
create index idx_polls_hangout on public.polls(hangout_id);
create index idx_polls_open_deadline on public.polls(vote_deadline) where phase <> 'closed';
create index idx_poll_options_poll on public.poll_options(poll_id);
create index idx_votes_poll on public.votes(poll_id);
create index idx_votes_voter on public.votes(voter_id);
create index idx_itinerary_hangout_order on public.itinerary_stops(hangout_id, order_index);
create index idx_messages_hangout_created on public.messages(hangout_id, created_at desc);
create index idx_message_reads_user on public.message_reads(user_id);
create index idx_posts_author_created on public.posts(author_id, created_at desc) where deleted_at is null;
create index idx_posts_hangout on public.posts(hangout_id) where deleted_at is null;
create index idx_post_images_post on public.post_images(post_id);
create index idx_post_reactions_post on public.post_reactions(post_id);
create index idx_post_comments_post on public.post_comments(post_id) where deleted_at is null;
create index idx_album_photos_album on public.album_photos(album_id) where deleted_at is null;
create index idx_bills_hangout on public.bills(hangout_id) where deleted_at is null;
create index idx_bill_splits_debtor_unsettled on public.bill_splits(debtor_id) where settled_at is null;
create index idx_avail_user_starts on public.availability_blocks(user_id, starts_at);
create index idx_time_poll_slots_poll on public.time_poll_slots(time_poll_id);
create index idx_time_poll_responses_slot on public.time_poll_responses(slot_id);
create index idx_location_sessions_active on public.location_sessions(hangout_id, expires_at) where ended_at is null;
create index idx_notifications_user_unread on public.notifications(user_id, created_at desc) where read_at is null;
create index idx_blocks_blocker on public.blocks(blocker_id);
create index idx_blocks_blocked on public.blocks(blocked_id);
