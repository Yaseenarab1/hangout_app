import { useQuery } from '@tanstack/react-query';
import { searchPlaces } from '@/features/places';
import { useSearchLocation } from '@/features/places/hooks/useSearchLocation';
import { filterByRadius } from '@/features/places/utils/distance';
import type { Place } from '@/features/places';
import type { PriceHint, SportVenueOption } from '../types';

function getPriceHint(place: Place, freeHint: boolean): PriceHint {
  if (place.priceLevel === 0) return 'free';
  if (place.priceLevel != null && place.priceLevel > 0) return 'paid';
  const types = (place as any).types as string[] | undefined;
  if (freeHint && types?.some((t) => t.includes('park') || t.includes('playground'))) {
    return 'free';
  }
  return 'unknown';
}

export function placesToVenueOptions(places: Place[], freeHint: boolean, sportEmoji?: string): SportVenueOption[] {
  return places.map((p) => ({
    id: `place:${p.placeId}`,
    name: p.name,
    address: p.address,
    placeId: p.placeId,
    rating: p.rating,
    priceLevel: p.priceLevel,
    primaryType: p.primaryType,
    mapsUrl: p.mapsUrl,
    photos: p.photos,
    sportEmoji,
    priceHint: getPriceHint(p, freeHint),
  }));
}

export function useSportVenues(query: string, radius: number, minRating: number) {
  const searchLoc = useSearchLocation();
  const location = searchLoc.data ?? undefined;
  const enabled = query.trim().length > 0;

  return useQuery({
    queryKey: ['sports', 'venues', query, radius, minRating, location],
    queryFn: () =>
      searchPlaces({
        query,
        location,
        radius,
        minRating: minRating > 0 ? minRating : undefined,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
    select: (data) => filterByRadius(data, searchLoc.data, radius),
  });
}
