// supabase/functions/delete-account/index.ts
//
// Soft-deletes the calling user's profile, starting the 7-day grace period.
// A scheduled cron (in Phase 5) will later hard-delete profiles whose
// deleted_at is more than 7 days ago.
//
// We don't delete auth.users here — that happens in the cron job after grace.
// The user can sign back in during the grace period and the profile is restored
// (we'd add an undelete flow in the auth.signIn handler — Phase 5).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { error } = await adminClient
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userData.user.id);

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (err) {
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
