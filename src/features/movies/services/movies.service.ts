import { supabase } from '@/services/supabase/client';
import type { MovieOption } from '../types';

type RawMovie = {
  tmdbId: number;
  title: string;
  overview: string;
  posterUrl: string | null;
  rating: number | null;
  year: string | null;
  mediaType: 'movie' | 'tv';
  genres: string[];
};

async function callMovieSearch(body: Record<string, unknown>): Promise<MovieOption[]> {
  const { data, error } = await supabase.functions.invoke('movie-search', { body });
  if (error) throw error;
  const results: RawMovie[] = (data as { results: RawMovie[] }).results ?? [];
  return results.map((m) => ({ ...m, id: `tmdb:${m.tmdbId}` }));
}

export function fetchNowPlaying(): Promise<MovieOption[]> {
  return callMovieSearch({ type: 'now_playing' });
}

export function fetchStreamingTitles(provider: number, media: 'movie' | 'tv'): Promise<MovieOption[]> {
  return callMovieSearch({ type: 'streaming', provider, media });
}

export function searchMovies(q: string): Promise<MovieOption[]> {
  return callMovieSearch({ type: 'search', q });
}
