import { supabase } from '@/services/supabase/client';
import { env } from '@/config/env';
import { logError } from '@/services/errors';
import { MESSAGE_PAGE_SIZE } from '../types';
import type { Message, MessageReaction, MessageReadState } from '../types';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchMessages(
  hangoutId: string,
  cursor?: string,
): Promise<Message[]> {
  let query = (supabase as any)
    .from('messages')
    .select(`
      id, hangout_id, sender_id, body,
      reply_to_message_id, edited_at, deleted_at, created_at,
      sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url),
      reactions:message_reactions(message_id, user_id, emoji, created_at)
    `)
    .eq('hangout_id', hangoutId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Fetch reply previews for any message that has reply_to_message_id
  const messages: Message[] = data ?? [];
  const replyIds = [...new Set(
    messages.map((m: Message) => m.reply_to_message_id).filter(Boolean) as string[]
  )];

  if (replyIds.length > 0) {
    const { data: replies } = await (supabase as any)
      .from('messages')
      .select('id, body, deleted_at, sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url)')
      .in('id', replyIds);

    const replyMap = new Map((replies ?? []).map((r: any) => [r.id, r]));
    for (const msg of messages) {
      if (msg.reply_to_message_id) {
        msg.reply_to = replyMap.get(msg.reply_to_message_id) as Message['reply_to'];
      }
    }
  }

  return messages;
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendMessage(params: {
  hangoutId: string;
  body: string;
  replyToMessageId?: string;
}): Promise<Message> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await (supabase as any)
    .from('messages')
    .insert({
      hangout_id: params.hangoutId,
      sender_id: auth.user.id,
      body: params.body.trim(),
      reply_to_message_id: params.replyToMessageId ?? null,
    })
    .select(`
      id, hangout_id, sender_id, body,
      reply_to_message_id, edited_at, deleted_at, created_at,
      sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url)
    `)
    .single();

  if (error) throw error;

  // Fire push client-side (no pg_net available)
  firePushForMessage(data, auth.user.id).catch((e) =>
    logError(e, { where: 'firePushForMessage' }),
  );

  return { ...data, reactions: [] };
}

async function firePushForMessage(
  message: Message,
  actorId: string,
): Promise<void> {
  // Get all participant user_ids for this hangout
  const { data: participants } = await supabase
    .from('hangout_participants' as any)
    .select('user_id')
    .eq('hangout_id', message.hangout_id)
    .in('status', ['invited', 'accepted', 'maybe']);

  const userIds = ((participants ?? []) as any[])
    .map((p) => p.user_id)
    .filter((id: string) => id !== actorId);

  if (userIds.length === 0) return;

  const { data: hangout } = await supabase
    .from('hangouts')
    .select('title')
    .eq('id', message.hangout_id)
    .single();

  const senderName = (message.sender as any)?.display_name ?? 'Someone';
  const hangoutTitle = (hangout as any)?.title ?? 'Hangout';

  await fetch(`${env.supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.supabaseAnonKey}`,
    },
    body: JSON.stringify({
      userIds,
      type: 'message',
      refId: message.hangout_id,
      title: `${senderName} • ${hangoutTitle}`,
      body: message.body.slice(0, 200),
      excludeUserId: actorId,
      data: { hangoutId: message.hangout_id, messageId: message.id },
    }),
  });
}

// ─── Edit / Delete ────────────────────────────────────────────────────────────

export async function editMessage(
  messageId: string,
  body: string,
): Promise<void> {
  const { error } = await (supabase as any)
    .from('messages')
    .update({ body: body.trim(), edited_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function softDeleteMessage(messageId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function addReaction(
  messageId: string,
  emoji: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await (supabase as any)
    .from('message_reactions')
    .upsert(
      { message_id: messageId, user_id: auth.user.id, emoji },
      { onConflict: 'message_id,user_id,emoji' },
    );
  if (error) throw error;
}

export async function removeReaction(
  messageId: string,
  emoji: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await (supabase as any)
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', auth.user.id)
    .eq('emoji', emoji);
  if (error) throw error;
}

// ─── Read state ───────────────────────────────────────────────────────────────

export async function upsertReadState(
  hangoutId: string,
  lastReadMessageId: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await (supabase as any)
    .from('message_read_state')
    .upsert(
      {
        hangout_id: hangoutId,
        user_id: auth.user.id,
        last_read_message_id: lastReadMessageId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'hangout_id,user_id' },
    );
  if (error) throw error;
}

export async function fetchReadState(
  hangoutId: string,
): Promise<MessageReadState | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await (supabase as any)
    .from('message_read_state')
    .select('*')
    .eq('hangout_id', hangoutId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
