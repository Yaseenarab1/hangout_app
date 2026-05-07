// supabase/functions/places-photo/index.ts
//
// Proxies Google Places photo requests so the API key stays server-side.
//
// Query params:
//   photoName   — Google photo resource name, e.g. "places/ChIJ.../photos/AUac..."
//   maxWidthPx  — optional, default 800
//   maxHeightPx — optional
//
// Returns the image binary with cache headers (1 day, immutable).

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error('GOOGLE_PLACES_API_KEY not configured');
    }

    const url = new URL(req.url);
    const photoName = url.searchParams.get('photoName');
    const maxWidthPx = url.searchParams.get('maxWidthPx') ?? '800';
    const maxHeightPx = url.searchParams.get('maxHeightPx');

    if (!photoName) {
      return new Response(JSON.stringify({ error: 'photoName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate photoName to prevent path traversal. Google photo names look like
    // "places/ChIJ.../photos/Af..." — they always start with "places/" and
    // never contain "..".
    if (!photoName.startsWith('places/') || photoName.includes('..')) {
      return new Response(JSON.stringify({ error: 'Invalid photoName' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Google Places (New) photo endpoint: GET /v1/{photoName}/media
    // Follows redirect automatically (Deno fetch default) to get image bytes.
    const googleUrl = new URL(
      `https://places.googleapis.com/v1/${photoName}/media`,
    );
    googleUrl.searchParams.set('key', GOOGLE_PLACES_API_KEY);
    googleUrl.searchParams.set('maxWidthPx', maxWidthPx);
    if (maxHeightPx) googleUrl.searchParams.set('maxHeightPx', maxHeightPx);

    const googleRes = await fetch(googleUrl.toString());

    if (!googleRes.ok) {
      console.error('Google photo error:', googleRes.status);
      return new Response(JSON.stringify({ error: 'Photo fetch failed' }), {
        status: googleRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = googleRes.headers.get('content-type') ?? 'image/jpeg';
    const imageBytes = await googleRes.arrayBuffer();

    return new Response(imageBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error) {
    console.error('places-photo error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
