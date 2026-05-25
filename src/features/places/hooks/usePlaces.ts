import { useQuery } from '@tanstack/react-query';
import {
  searchRestaurants,
  searchPlaces,
  autocompleteAddress,
  getPlaceDetails,
} from '../services/places.service';
import { useSearchLocation } from './useSearchLocation';
import { filterByRadius } from '../utils/distance';
import type { RestaurantSearchFilters } from '../types';

const placesKeys = {
  search: (filters: RestaurantSearchFilters) =>
    ['places', 'search', filters] as const,
  autocomplete: (input: string) => ['places', 'autocomplete', input] as const,
  details: (placeId: string) => ['places', 'details', placeId] as const,
};

export function useRestaurantSearch(
  filters: RestaurantSearchFilters,
  enabled = true,
) {
  const searchLoc = useSearchLocation();
  // Caller-provided location wins; fall back to user's saved location; NYC is the edge-function default
  const location = filters.location ?? searchLoc.data ?? undefined;
  const filtersWithLoc = { ...filters, location };

  return useQuery({
    queryKey: placesKeys.search(filtersWithLoc),
    queryFn: () => searchRestaurants(filtersWithLoc),
    enabled: enabled && Boolean(filters.query || filters.cuisine),
    staleTime: 5 * 60 * 1000,
    // Hard client-side enforcement: cut anything outside the radius regardless of what Google returned
    select: (data) => filterByRadius(data, searchLoc.data, filtersWithLoc.radius),
  });
}

export function useAddressAutocomplete(input: string, sessionToken?: string) {
  return useQuery({
    queryKey: placesKeys.autocomplete(input),
    queryFn: () => autocompleteAddress(input, sessionToken),
    enabled: input.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}

export function usePlaceDetails(placeId: string | undefined) {
  return useQuery({
    queryKey: placeId ? placesKeys.details(placeId) : ['places', 'details', 'noop'],
    queryFn: () => (placeId ? getPlaceDetails(placeId) : Promise.resolve(null)),
    enabled: Boolean(placeId),
    staleTime: 10 * 60 * 1000, // 10 min — detail sheet data
  });
}

export { searchRestaurants, searchPlaces, autocompleteAddress, getPlaceDetails };
