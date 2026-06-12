import { env } from '@/config/env';
import { invokeFn } from '@/services/supabase/invoke';
import type {
  Place,
  PlaceDetails,
  AutocompletePrediction,
  RestaurantSearchFilters,
} from '../types';

export async function searchRestaurants(
  filters: RestaurantSearchFilters,
): Promise<Place[]> {
  const queryParts: string[] = [];
  if (filters.cuisine) queryParts.push(filters.cuisine);
  if (filters.query) queryParts.push(filters.query);
  queryParts.push('restaurants');

  const data = await invokeFn<{ results: Place[] }>('places-search', {
    query: queryParts.join(' '),
    location: filters.location,
    radius: filters.radius,
    includedTypes: ['restaurant'],
    minPriceLevel: filters.minPriceLevel,
    maxPriceLevel: filters.maxPriceLevel,
    minRating: filters.minRating,
  });
  return data.results ?? [];
}

export async function searchPlaces(filters: {
  query: string;
  location?: { lat: number; lng: number };
  radius?: number;
  includedTypes?: string[];
  minPriceLevel?: number;
  maxPriceLevel?: number;
  minRating?: number;
}): Promise<Place[]> {
  const data = await invokeFn<{ results: Place[] }>('places-search', filters);
  return data.results ?? [];
}

export async function autocompleteAddress(
  input: string,
  sessionToken?: string,
  location?: { lat: number; lng: number },
): Promise<AutocompletePrediction[]> {
  if (input.trim().length < 2) return [];
  const data = await invokeFn<{ predictions: AutocompletePrediction[] }>(
    'places-autocomplete',
    { input, sessionToken, location },
  );
  return data.predictions ?? [];
}

export async function getPlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<PlaceDetails | null> {
  const data = await invokeFn<{ place: PlaceDetails | null }>(
    'places-details',
    { placeId, sessionToken },
  );
  return data.place ?? null;
}

export function getPlacePhotoUrl(photoName: string, maxWidthPx = 800): string {
  const base = `${env.supabaseUrl}/functions/v1/places-photo`;
  return `${base}?photoName=${encodeURIComponent(photoName)}&maxWidthPx=${maxWidthPx}`;
}
