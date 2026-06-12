import { useQuery } from '@tanstack/react-query';
import { fetchNowPlaying, fetchStreamingTitles, searchMovies } from '../services/movies.service';

export function useNowPlaying() {
  return useQuery({
    queryKey: ['movies', 'now_playing'],
    queryFn: fetchNowPlaying,
    staleTime: 60 * 60 * 1000,
  });
}

export function useStreamingTitles(provider: number | null, media: 'movie' | 'tv') {
  return useQuery({
    queryKey: ['movies', 'streaming', provider, media],
    queryFn: () => fetchStreamingTitles(provider!, media),
    enabled: provider !== null,
    staleTime: 30 * 60 * 1000,
  });
}

export function useMovieSearch(query: string) {
  return useQuery({
    queryKey: ['movies', 'search', query],
    queryFn: () => searchMovies(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
