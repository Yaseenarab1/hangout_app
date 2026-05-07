import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSearchLocation,
  saveSearchLocation,
  clearSearchLocation,
  type SearchLocation,
} from '../services/searchLocation';

const QUERY_KEY = ['search-location'] as const;

/** Returns the user's saved search center, or null if using the NYC default. */
export function useSearchLocation() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getSearchLocation,
    staleTime: Infinity, // only changes when the user explicitly updates it
  });
}

export function useSaveSearchLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveSearchLocation,
    onSuccess: (_data, loc: SearchLocation) => {
      qc.setQueryData(QUERY_KEY, loc);
    },
  });
}

export function useClearSearchLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearSearchLocation,
    onSuccess: () => {
      qc.setQueryData(QUERY_KEY, null);
    },
  });
}
