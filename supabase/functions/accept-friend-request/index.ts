// supabase/functions/accept-friend-request/index.ts
//
// Edge Function: accept a friend request.
//
// Why this is server-side: the `friendships` table denies direct INSERT from the
// client (RLS), so we need to do this with the service-role key. The Edge Function:
//   1. Verifies the caller is authenticated.
//   2. Verifies the friend_request exists and the caller is the recipient.
//   3. Updates the request status to 'accepted' — the DB trigger then inserts
//      the friendship row and notifies the sender.
//
// Deno runtime. Run `supabase functions deploy accept-friend-request` to deploy.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.2';
import { z } from 'https://esm.sh/zod@3.23.8';

const requestSchema = z.object({
  requestId: z.string().uuid(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validate input
    const body = await req.json();
    const { requestId } = requestSchema.parse(body);

    // 2. Get caller from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use the user's JWT to identify them
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const callerId = userData.user.id;

    // 3. Use service-role for the privileged operation
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 3a. Look up the request and verify the caller is the recipient
    const { data: request, error: fetchError } = await adminClient
      .from('friend_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return json({ error: 'Request not found' }, 404);
    }
    if (request.recipient_id !== callerId) {
      return json({ error: 'Not authorized to accept this request' }, 403);
    }
    if (request.status !== 'pending') {
      return json({ error: 'Request is not pending' }, 400);
    }

    // 3b. Update status to 'accepted'. The DB trigger handles friendship + notification.
    const { error: updateError } = await adminClient
      .from('friend_requests')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return json({ error: 'Invalid input', issues: err.issues }, 400);
    }
    const message = err instanceof Error ? err.message : 'Internal error';
    return json({ error: message }, 500);
  }
});

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
