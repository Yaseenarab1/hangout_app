import { supabase } from '@/services/supabase/client';
import { CONV_PAGE_SIZE } from '../types';
import type { Conversation, ConvMessage, ConvLastMessage } from '../types';

const db = () => supabase as any;

// ─── Conversations list ───────────────────────────────────────────────────────

export async function fetchConversations(): Promise<Conversation[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await db()
    .from('conversations')
    .select(`
      id, type, name, created_by, last_message_at, created_at,
      participants:conversation_participants(
        user_id, role, joined_at, last_read_at,
        profile:profiles(id, display_name, avatar_url, username)
      )
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) throw error;

  const convs: Conversation[] = data ?? [];
  if (convs.length === 0) return convs;

  // Batch-fetch last message for each conversation
  const convIds = convs.map((c) => c.id);
  const { data: msgs } = await db()
    .from('conversation_messages')
    .select('id, conversation_id, body, sender_id, created_at, deleted_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })
    .limit(convIds.length * 3);

  // Keep only the first (latest) per conversation
  const lastMsgMap = new Map<string, ConvLastMessage>();
  for (const m of (msgs ?? []) as ConvLastMessage[]) {
    if (!lastMsgMap.has(m.conversation_id)) {
      lastMsgMap.set(m.conversation_id, m);
    }
  }

  return convs.map((c) => ({ ...c, last_message: lastMsgMap.get(c.id) }));
}

// ─── Find or create DM ────────────────────────────────────────────────────────

export async function fetchOrCreateDM(friendId: string): Promise<Conversation> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Check if a DM with this friend already exists
  const { data: existing } = await db()
    .from('conversations')
    .select('id, type, name, created_by, last_message_at, created_at, participants:conversation_participants(user_id, role, joined_at, last_read_at)')
    .eq('type', 'dm');

  const found = ((existing ?? []) as Conversation[]).find((c) =>
    c.participants.some((p) => p.user_id === friendId),
  );

  if (found) return found;

  // Create new DM — use insert without select so RLS doesn't block
  // (no participants exist yet, so is_conv_participant would return false)
  const { data: convData, error: convErr } = await db()
    .from('conversations')
    .insert({ type: 'dm', created_by: auth.user.id })
    .select('id, type, name, created_by, last_message_at, created_at');

  if (convErr) throw convErr;
  const conv = (convData as any[])[0];
  if (!conv) throw new Error('Failed to create conversation');

  // Insert myself first — satisfies the "auth.uid() = user_id" clause
  const { error: myErr } = await db()
    .from('conversation_participants')
    .insert({ conversation_id: conv.id, user_id: auth.user.id, role: 'owner' });
  if (myErr) throw myErr;

  // Now insert friend — is_conv_participant returns true since I'm in the table
  const { error: friendErr } = await db()
    .from('conversation_participants')
    .insert({ conversation_id: conv.id, user_id: friendId, role: 'member' });
  if (friendErr) throw friendErr;

  return { ...conv, participants: [] };
}

// ─── Create group ─────────────────────────────────────────────────────────────

export async function createGroup(
  name: string,
  memberIds: string[],
): Promise<Conversation> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data: convData, error: convErr } = await db()
    .from('conversations')
    .insert({ type: 'group', name: name.trim(), created_by: auth.user.id })
    .select('id, type, name, created_by, last_message_at, created_at');

  if (convErr) throw convErr;
  const conv = (convData as any[])[0];
  if (!conv) throw new Error('Failed to create conversation');

  // Insert myself first so subsequent inserts pass is_conv_participant check
  const { error: myErr } = await db()
    .from('conversation_participants')
    .insert({ conversation_id: conv.id, user_id: auth.user.id, role: 'owner' });
  if (myErr) throw myErr;

  // Insert remaining members one by one
  for (const uid of memberIds) {
    const { error } = await db()
      .from('conversation_participants')
      .insert({ conversation_id: conv.id, user_id: uid, role: 'member' });
    if (error) throw error;
  }

  return { ...conv, participants: [] };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchConvMessages(
  convId: string,
  cursor?: string,
): Promise<ConvMessage[]> {
  let query = db()
    .from('conversation_messages')
    .select(`
      id, conversation_id, sender_id, body,
      reply_to_id, edited_at, deleted_at, created_at,
      sender:profiles(id, display_name, avatar_url)
    `)
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(CONV_PAGE_SIZE);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) throw error;

  const messages: ConvMessage[] = data ?? [];

  // Batch-fetch reply previews
  const replyIds = [
    ...new Set(
      messages
        .map((m: ConvMessage) => m.reply_to_id)
        .filter(Boolean) as string[],
    ),
  ];

  if (replyIds.length > 0) {
    const { data: replies } = await db()
      .from('conversation_messages')
      .select('id, body, deleted_at, sender:profiles(id, display_name, avatar_url)')
      .in('id', replyIds);

    const replyMap = new Map((replies ?? []).map((r: any) => [r.id, r]));
    for (const msg of messages) {
      if (msg.reply_to_id) {
        msg.reply_to = replyMap.get(msg.reply_to_id) as ConvMessage['reply_to'];
      }
    }
  }

  return messages;
}

export async function sendConvMessage(params: {
  convId: string;
  body: string;
  replyToId?: string;
}): Promise<ConvMessage> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await db()
    .from('conversation_messages')
    .insert({
      conversation_id: params.convId,
      sender_id: auth.user.id,
      body: params.body.trim(),
      reply_to_id: params.replyToId ?? null,
    })
    .select(`
      id, conversation_id, sender_id, body,
      reply_to_id, edited_at, deleted_at, created_at,
      sender:profiles(id, display_name, avatar_url)
    `)
    .single();

  if (error) throw error;

  // Update last_message_at on conversation
  await db()
    .from('conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', params.convId);

  return { ...data, reply_to: undefined };
}

export async function softDeleteConvMessage(messageId: string): Promise<void> {
  const { error } = await db()
    .from('conversation_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function updateConvLastRead(convId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  await db()
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', convId)
    .eq('user_id', auth.user.id);
}
