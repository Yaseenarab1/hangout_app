// supabase/functions/places-search/index.ts
//
// Proxies search requests to Google Places API (New).
// Keeps the API key server-side. Defaults to NYC if location not provided.
//
// Request body:
// {
//   query?: string;           // Free-text search (e.g. "italian restaurants")
//   location?: { lat, lng };  // Center of search; defaults to NYC if omitted
//   radius?: number;          // Meters, default 5000
//   includedTypes?: string[]; // ['restaurant'] or ['cafe', 'bar'] etc.
//   minPriceLevel?: number;   // 0-4, where 0=free, 4=very expensive
//   maxPriceLevel?: number;   // 0-4
//   minRating?: number;       // e.g. 3.5
//   languageCode?: string;    // default 'en'
// }
//
// Response: { results: PlaceResult[] }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
const NYC_CENTER = { lat: 40.7580, lng: -73.9855 }; // Times Square

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type SearchBody = {
  query?: string;
  location?: { lat: number; lng: number };
  radius?: number;
  includedTypes?: string[];
  minPriceLevel?: number;
  maxPriceLevel?: number;
  minRating?: number;
  languageCode?: string;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error('GOOGLE_PLACES_API_KEY not configured');
    }

    const body: SearchBody = await req.json();

    const center = body.location ?? NYC_CENTER;
    const radius = Math.min(body.radius ?? 5000, 50000); // Google caps at 50km

    // Use the new "Places API (New)" Text Search endpoint.
    // Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
    // locationRestriction is a hard radius cap — results strictly within the circle.
    // locationBias is only a hint and lets Google return far-away places.
    // We always have a radius (default 5000m), so always restrict strictly.
    const requestBody: Record<string, unknown> = {
      textQuery: body.query ?? 'restaurants',
      languageCode: body.languageCode ?? 'en',
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius,
        },
      },
    };

    if (body.includedTypes && body.includedTypes.length > 0) {
      requestBody.includedType = body.includedTypes[0]; // API takes single type
    }
    if (body.minRating !== undefined) {
      requestBody.minRating = body.minRating;
    }
    if (body.minPriceLevel !== undefined || body.maxPriceLevel !== undefined) {
      requestBody.priceLevels = priceLevelEnumList(
        body.minPriceLevel ?? 0,
        body.maxPriceLevel ?? 4,
      );
    }

    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.rating',
      'places.userRatingCount',
      'places.priceLevel',
      'places.primaryTypeDisplayName',
      'places.photos',
      'places.googleMapsUri',
      'places.types',
    ].join(',');

    const googleRes = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error('Google Places error:', googleRes.status, errText);
      throw new Error(`Google API ${googleRes.status}: ${errText.slice(0, 200)}`);
    }

    const googleJson = await googleRes.json();

    const mapped = (googleJson.places ?? []).map((p: any) => ({
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
      types: p.types ?? [],
    }));

    // Hard distance filter: cut anything Google returned outside our radius.
    // locationRestriction is advisory in some edge cases; this is the guarantee.
    const results = mapped.filter((p: any) => {
      if (!p.location) return true;
      return haversineMeters(center.lat, center.lng, p.location.lat, p.location.lng) <= radius;
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('places-search error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function priceLevelEnumList(min: number, max: number): string[] {
  const enumMap: Record<number, string> = {
    0: 'PRICE_LEVEL_FREE',
    1: 'PRICE_LEVEL_INEXPENSIVE',
    2: 'PRICE_LEVEL_MODERATE',
    3: 'PRICE_LEVEL_EXPENSIVE',
    4: 'PRICE_LEVEL_VERY_EXPENSIVE',
  };
  const result: string[] = [];
  for (let i = min; i <= max; i++) {
    const level = enumMap[i];
    if (level) result.push(level);
  }
  return result;
}

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
