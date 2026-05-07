// supabase/functions/places-details/index.ts
//
// Fetches details for a specific place_id. Used after autocomplete selection
// to get coordinates and full address.

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

    const { placeId, sessionToken } = await req.json();
    if (!placeId) throw new Error('placeId required');

    const fieldMask = [
      'id',
      'displayName',
      'formattedAddress',
      'location',
      'rating',
      'userRatingCount',
      'priceLevel',
      'primaryTypeDisplayName',
      'photos',
      'googleMapsUri',
      'types',
      'websiteUri',
      'nationalPhoneNumber',
      'regularOpeningHours',
      'currentOpeningHours',
    ].join(',');

    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(
      placeId,
    )}${sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : ''}`;

    const googleRes = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error('Google details error:', googleRes.status, errText);
      throw new Error(`Google API ${googleRes.status}`);
    }

    const p = await googleRes.json();
    const place = {
      placeId: p.id,
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
      location: p.location
        ? { lat: p.location.latitude, lng: p.location.longitude }
        : null,
      rating: p.rating ?? null,
      ratingCount: p.userRatingCount ?? null,
      priceLevel: priceLevelToNumber(p.priceLevel),
      primaryType: p.primaryTypeDisplayName?.text ?? null,
      photos: (p.photos ?? []).slice(0, 5).map((ph: any) => ph.name).filter(Boolean),
      mapsUrl: p.googleMapsUri ?? null,
      website: p.websiteUri ?? null,
      phone: p.nationalPhoneNumber ?? null,
      openingHours: p.regularOpeningHours?.weekdayDescriptions ?? null,
      isOpenNow: p.currentOpeningHours?.openNow ?? null,
      types: p.types ?? [],
    };

    return new Response(JSON.stringify({ place }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('places-details error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

function priceLevelToNumber(p?: string): number | null {
  if (!p) return null;
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[p] ?? null;
}
