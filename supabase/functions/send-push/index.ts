// supabase/functions/send-push/index.ts
//
// Internal-only generic push sender. Called from other edge functions
// using the service-role key. Never exposed to clients directly.
//
// Input:
// {
//   userIds: string[];
//   type: NotificationType;
//   refId: string;
//   title: string;
//   body: string;
//   data?: Record<string, unknown>;
//   excludeUserId?: string;
// }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NotificationType =
  | 'message'
  | 'photo_added'
  | 'bill_added'
  | 'bill_paid'
  | 'friend_post'
  | 'hangout_invite'
  | 'poll_closed'
  | 'rsvp_change';

type PushInput = {
  userIds: string[];
  type: NotificationType;
  refId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  excludeUserId?: string;
};

// Maps push type → column name in notification_preferences table
const PREF_COL: Partial<Record<NotificationType, string>> = {
  message:        'message_received',
  bill_added:     'bill_added',
  bill_paid:      'bill_marked_paid',
  friend_post:    'post_created_by_friend',
  hangout_invite: 'hangout_invited',
  poll_closed:    'poll_closed',
  // photo_added and rsvp_change have no dedicated pref column yet — always send
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let input: PushInput;
  try {
    input = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { userIds, type, refId, title, body, data = {}, excludeUserId } = input;

  if (!userIds?.length || !type || !refId || !title) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const recipients = excludeUserId
    ? userIds.filter((id) => id !== excludeUserId)
    : userIds;

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prefCol = PREF_COL[type];
  const results: { userId: string; sent: number; skipped?: string }[] = [];

  for (const userId of recipients) {
    // Fetch prefs + tokens in parallel
    const [prefsResult, tokensResult] = await Promise.all([
      prefCol
        ? supabase
            .from('notification_preferences')
            .select(prefCol)
            .eq('user_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('device_tokens')
        .select('token')
        .eq('user_id', userId),
    ]);

    // Check per-type opt-out
    if (prefCol && prefsResult.data && prefsResult.data[prefCol] === false) {
      results.push({ userId, sent: 0, skipped: 'pref_disabled' });
      continue;
    }

    const tokens = (tokensResult.data ?? []).map((r: any) => r.token);
    if (tokens.length === 0) {
      results.push({ userId, sent: 0, skipped: 'no_tokens' });
      continue;
    }

    // Build Expo push messages
    const messages = tokens.map((token: string) => ({
      to: token,
      title,
      body,
      data: { type, refId, ...data },
      sound: 'default',
      badge: 1,
    }));

    let delivered = false;
    let pushError: string | undefined;

    try {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      const expoJson = await expoRes.json();
      const ticketData: any[] = expoJson.data ?? [];

      // Delete stale tokens
      const staleTokens = tokens.filter(
        (_: string, idx: number) =>
          ticketData[idx]?.status === 'error' &&
          ticketData[idx]?.details?.error === 'DeviceNotRegistered',
      );

      if (staleTokens.length > 0) {
        await supabase
          .from('device_tokens')
          .delete()
          .eq('user_id', userId)
          .in('token', staleTokens);
      }

      delivered = ticketData.some((t) => t.status === 'ok');
    } catch (err) {
      pushError = err instanceof Error ? err.message : String(err);
    }

    await supabase.from('notification_log').insert({
      user_id: userId,
      type,
      ref_id: refId,
      title,
      body,
      data: { ...data },
      delivered,
      error: pushError ?? null,
    });

    results.push({ userId, sent: delivered ? tokens.length : 0 });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
