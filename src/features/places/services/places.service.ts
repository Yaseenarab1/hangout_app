import { supabase } from '@/services/supabase/client';
import { env } from '@/config/env';
import type {
  Place,
  PlaceDetails,
  AutocompletePrediction,
  RestaurantSearchFilters,
} from '../types';

/**
 * Client-side Places service. Calls our Supabase Edge Functions which
 * proxy to Google Places. The API key never reaches the client app.
 */

/**
 * Search for restaurants/places. Returns up to 20 results.
 *
 * The Edge Function defaults the search center to NYC if no location is
 * provided. Pass `location` to use the user's current location instead.
 */
export async function searchRestaurants(
  filters: RestaurantSearchFilters,
): Promise<Place[]> {
  // Build query from filters. Cuisine is folded into the query string;
  // Google handles "italian restaurants" naturally.
  const queryParts: string[] = [];
  if (filters.cuisine) queryParts.push(filters.cuisine);
  if (filters.query) queryParts.push(filters.query);
  queryParts.push('restaurants');
  const finalQuery = queryParts.join(' ');

  const { data, error } = await supabase.functions.invoke('places-search', {
    body: {
      query: finalQuery,
      location: filters.location,
      radius: filters.radius,
      includedTypes: ['restaurant'],
      minPriceLevel: filters.minPriceLevel,
      maxPriceLevel: filters.maxPriceLevel,
      minRating: filters.minRating,
    },
  });

  if (error) throw error;
  return (data?.results ?? []) as Place[];
}

/**
 * General-purpose place search (any type). Used for activities in 2D
 * (Plan a Day) and could also augment activity polls in future.
 */
export async function searchPlaces(filters: {
  query: string;
  location?: { lat: number; lng: number };
  radius?: number;
  includedTypes?: string[];
  minPriceLevel?: number;
  maxPriceLevel?: number;
  minRating?: number;
}): Promise<Place[]> {
  const { data, error } = await supabase.functions.invoke('places-search', {
    body: filters,
  });
  if (error) throw error;
  return (data?.results ?? []) as Place[];
}

/**
 * Address autocomplete. Pass a session token (UUID, generated client-side)
 * for the duration of one typing session — Google bills the whole session
 * as one request when paired with a places-details call using the same token.
 */
export async function autocompleteAddress(
  input: string,
  sessionToken?: string,
  location?: { lat: number; lng: number },
): Promise<AutocompletePrediction[]> {
  if (input.trim().length < 2) return [];

  const { data, error } = await supabase.functions.invoke(
    'places-autocomplete',
    {
      body: { input, sessionToken, location },
    },
  );

  if (error) throw error;
  return (data?.predictions ?? []) as AutocompletePrediction[];
}

/**
 * Fetch full details for a place_id. Used after autocomplete selection
 * to get the coordinates and full address.
 */
export async function getPlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<PlaceDetails | null> {
  const { data, error } = await supabase.functions.invoke('places-details', {
    body: { placeId, sessionToken },
  });

  if (error) throw error;
  return (data?.place ?? null) as PlaceDetails | null;
}

/**
 * Build a proxied URL for a Google Places photo resource name.
 * The API key stays server-side in the places-photo Edge Function.
 * React Native Image loads it via source={{ uri, headers: { Authorization } }}.
 */
export function getPlacePhotoUrl(photoName: string, maxWidthPx = 800): string {
  const base = `${env.supabaseUrl}/functions/v1/places-photo`;
  return `${base}?photoName=${encodeURIComponent(photoName)}&maxWidthPx=${maxWidthPx}`;
}
