-- messages: per-hangout group chat
create table messages (
  id          uuid primary key default gen_random_uuid(),
  hangout_id  uuid references hangouts(id) on delete cascade not null,
  sender_id   uuid references profiles(id) on delete set null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz default now() not null
);

create index messages_hangout_created on messages (hangout_id, created_at desc);

-- RLS
alter table messages enable row level security;

-- participants can read messages in their hangouts
create policy "messages_select" on messages
  for select using (is_hangout_participant(hangout_id, auth.uid()));

-- participants can insert messages
create policy "messages_insert" on messages
  for insert with check (
    auth.uid() = sender_id
    and is_hangout_participant(hangout_id, auth.uid())
  );

-- sender can delete their own messages
create policy "messages_delete" on messages
  for delete using (auth.uid() = sender_id);

grant select, insert, delete on messages to authenticated;

-- Enable realtime for messages table
alter publication supabase_realtime add table messages;
