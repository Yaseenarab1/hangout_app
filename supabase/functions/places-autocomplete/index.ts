// supabase/functions/places-autocomplete/index.ts
//
// Provides address autocomplete using Google Places Autocomplete (New).
// Used by AddressAutocomplete component anywhere in the app.
//
// Request: { input: string; location?: {lat,lng}; sessionToken?: string }
// Response: { predictions: Prediction[] }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
const NYC_CENTER = { lat: 40.7580, lng: -73.9855 };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Body = {
  input: string;
  location?: { lat: number; lng: number };
  /** Session token for billing optimization — pass same UUID throughout a typing session. */
  sessionToken?: string;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error('GOOGLE_PLACES_API_KEY not configured');
    }

    const body: Body = await req.json();
    if (!body.input || body.input.trim().length < 2) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const center = body.location ?? NYC_CENTER;

    const requestBody: Record<string, unknown> = {
      input: body.input,
      languageCode: 'en',
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: 50000,
        },
      },
    };
    if (body.sessionToken) {
      requestBody.sessionToken = body.sessionToken;
    }

    const googleRes = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error('Google autocomplete error:', googleRes.status, errText);
      throw new Error(`Google API ${googleRes.status}`);
    }

    const googleJson = await googleRes.json();
    const predictions = (googleJson.suggestions ?? [])
      .filter((s: any) => s.placePrediction)
      .map((s: any) => ({
        placeId: s.placePrediction.placeId,
        primaryText: s.placePrediction.structuredFormat?.mainText?.text ?? '',
        secondaryText:
          s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
        fullText: s.placePrediction.text?.text ?? '',
      }));

    return new Response(JSON.stringify({ predictions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('places-autocomplete error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
