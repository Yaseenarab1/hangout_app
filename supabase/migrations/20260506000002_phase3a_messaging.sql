-- Phase 3A: group messaging additions

-- Add reply threading to existing messages table
alter table public.messages
  add column if not exists reply_to_message_id uuid
    references public.messages(id) on delete set null;

create index if not exists messages_hangout_idx
  on public.messages(hangout_id, created_at desc);

-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;

-- message_reactions: emoji reactions per message per user
create table public.message_reactions (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null check (length(emoji) <= 8),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index message_reactions_msg_idx on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

create policy "participants_read_reactions" on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and is_hangout_participant(m.hangout_id, auth.uid())
    )
  );

create policy "participants_react" on public.message_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and is_hangout_participant(m.hangout_id, auth.uid())
    )
  );

create policy "participants_unreact" on public.message_reactions
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.message_reactions to authenticated;

-- Enable realtime for reactions
alter publication supabase_realtime add table public.message_reactions;

-- message_read_state: tracks last read position per user per hangout
create table public.message_read_state (
  hangout_id          uuid not null references public.hangouts(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at        timestamptz not null default now(),
  primary key (hangout_id, user_id)
);

alter table public.message_read_state enable row level security;

create policy "users_read_own_state" on public.message_read_state
  for select using (auth.uid() = user_id);

create policy "users_insert_own_state" on public.message_read_state
  for insert with check (auth.uid() = user_id);

create policy "users_update_own_state" on public.message_read_state
  for update using (auth.uid() = user_id);

grant select, insert, update on public.message_read_state to authenticated;
