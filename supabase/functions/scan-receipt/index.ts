import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseReceiptText, VisionEntityAnnotation } from './parser.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VISION_API_URL =
  'https://vision.googleapis.com/v1/images:annotate';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── Parse request body ────────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, 400);

    const { imageBase64, imageUrl } = body as {
      imageBase64?: string;
      imageUrl?: string;
    };
    if (!imageBase64 && !imageUrl) {
      return json({ error: 'Provide imageBase64 or imageUrl' }, 400);
    }

    // ── Build Vision request ──────────────────────────────────────────────────
    const imageSource = imageBase64
      ? { content: imageBase64 }
      : { source: { imageUri: imageUrl } };

    const visionKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
    if (!visionKey) {
      return json({ error: 'Vision API key not configured' }, 500);
    }

    const visionRes = await fetch(`${VISION_API_URL}?key=${visionKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: imageSource,
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            imageContext: { languageHints: ['en'] },
          },
        ],
      }),
    });

    if (!visionRes.ok) {
      const err = await visionRes.text();
      console.error('Vision API error:', err);
      return json({ error: 'Vision API request failed', detail: err }, 502);
    }

    const visionData = await visionRes.json();
    const response0 = visionData?.responses?.[0];

    // Propagate Vision-level errors (e.g. image too large, unsupported format)
    if (response0?.error) {
      console.error('Vision response error:', response0.error);
      return json({ error: 'Vision API returned an error', detail: response0.error }, 422);
    }

    const annotations: VisionEntityAnnotation[] =
      response0?.textAnnotations ?? [];

    // ── Parse ─────────────────────────────────────────────────────────────────
    const parsed = parseReceiptText(annotations);

    return json(parsed, 200);
  } catch (err) {
    console.error('scan-receipt unhandled error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
