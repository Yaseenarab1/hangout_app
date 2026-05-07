-- Phase 3A+: DM and standalone group conversations

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('dm', 'group')),
  name            text,
  created_by      uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

create index conversations_last_message_idx on public.conversations(last_message_at desc);

alter table public.conversations enable row level security;

-- Visible only to participants
create policy "conversations_select" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

create policy "conversations_insert" on public.conversations
  for insert with check (auth.uid() = created_by);

create policy "conversations_update" on public.conversations
  for update using (auth.uid() = created_by);

grant select, insert, update on public.conversations to authenticated;

-- ─────────────────────────────────────────────────────────────
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'member' check (role in ('owner', 'member')),
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create index conv_participants_user_idx on public.conversation_participants(user_id);

alter table public.conversation_participants enable row level security;

-- Can see participants of conversations you're in
create policy "conv_participants_select" on public.conversation_participants
  for select using (
    exists (
      select 1 from public.conversation_participants cp2
      where cp2.conversation_id = conversation_id and cp2.user_id = auth.uid()
    )
  );

create policy "conv_participants_insert" on public.conversation_participants
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
    or auth.uid() = user_id  -- self-add when creating
  );

create policy "conv_participants_update_self" on public.conversation_participants
  for update using (auth.uid() = user_id);

grant select, insert, update on public.conversation_participants to authenticated;

-- ─────────────────────────────────────────────────────────────
create table public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text not null check (length(body) > 0 and length(body) <= 4000),
  reply_to_id     uuid references public.conversation_messages(id) on delete set null,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index conv_messages_conv_idx on public.conversation_messages(conversation_id, created_at desc);

alter table public.conversation_messages enable row level security;

create policy "conv_messages_select" on public.conversation_messages
  for select using (
    deleted_at is null
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "conv_messages_insert" on public.conversation_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "conv_messages_update" on public.conversation_messages
  for update using (auth.uid() = sender_id);

grant select, insert, update on public.conversation_messages to authenticated;

-- Enable realtime
alter publication supabase_realtime add table public.conversation_messages;
alter publication supabase_realtime add table public.conversations;
