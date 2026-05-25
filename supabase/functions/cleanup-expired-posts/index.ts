// supabase/functions/cleanup-expired-posts/index.ts
//
// Hard-deletes feed_posts where expires_at < NOW() - 7 days.
// Ephemeral posts are soft-expired by RLS immediately, but the rows
// stay in the table for 7 days so users can recover if needed.
//
// Invoke via pg_cron or manually:
//   supabase functions invoke cleanup-expired-posts --no-verify-jwt
//
// Schedule (run this SQL once in Supabase SQL Editor):
//   SELECT cron.schedule(
//     'cleanup-expired-posts',
//     '0 3 * * *',
//     $$
//       SELECT net.http_post(
//         url := 'https://cruosjnuhcuewjnzhlja.supabase.co/functions/v1/cleanup-expired-posts',
//         headers := jsonb_build_object(
//           'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
//           'Content-Type', 'application/json'
//         ),
//         body := '{}'::jsonb
//       );
//     $$
//   );

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data, error } = await supabase.rpc('cleanup_expired_feed_posts');

  if (error) {
    console.error('[cleanup-expired-posts] error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deleted = (data as number) ?? 0;
  console.log(`[cleanup-expired-posts] deleted ${deleted} posts`);
  return new Response(JSON.stringify({ deleted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
