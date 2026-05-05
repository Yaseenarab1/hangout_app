import { useQuery } from '@tanstack/react-query';
import {
  searchRestaurants,
  searchPlaces,
  autocompleteAddress,
  getPlaceDetails,
} from '../services/places.service';
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
  return useQuery({
    queryKey: placesKeys.search(filters),
    queryFn: () => searchRestaurants(filters),
    enabled: enabled && Boolean(filters.query || filters.cuisine),
    staleTime: 5 * 60 * 1000, // Restaurants don't change much; cache 5 min
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
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export { searchRestaurants, searchPlaces, autocompleteAddress, getPlaceDetails };
