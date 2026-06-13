import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import { rankGroupRecommendations } from '../utils/rank';
import type { RecommendationKind, RatingSignal, GroupRecommendation } from '../types';

export type FetchGroupRecommendationsInput = {
  participantIds: string[];
  kind: RecommendationKind;
  /** Max recommendations to return. Default 12. */
  limit?: number;
};

/**
 * Fetch the group's ratings and rank them. Reads the same tables the ratings
 * feature writes to (`restaurant_ratings`, `media_ratings`). RLS already allows
 * reading other participants' ratings (see ratings `fetchFriendRatings`).
 *
 * Venues like theaters / bowling alleys are rated through the same
 * `restaurant_ratings` table, so `restaurant` / `venue` / `activity` all read
 * from there.
 */
export async function fetchGroupRecommendations(
  input: FetchGroupRecommendationsInput,
): Promise<GroupRecommendation[]> {
  const userIds = [...new Set(input.participantIds)].filter(Boolean);
  if (userIds.length === 0) return [];

  const limit = input.limit ?? 12;

  if (input.kind === 'movie') {
    const { data, error } = await (supabase as any)
      .from('media_ratings')
      .select('user_id, tmdb_id, media_type, title, poster_url, year, rating, watched_at, updated_at')
      .in('user_id', userIds);
    if (error) throw error;

    const signals: RatingSignal[] = (data ?? []).map((r: any) => ({
      key: `tmdb:${r.media_type}:${r.tmdb_id}`,
      raterId: r.user_id as string,
      rating: Number(r.rating),
      ratedAt: (r.watched_at as string) ?? (r.updated_at as string) ?? '',
      name: r.title as string,
      tmdbId: (r.tmdb_id as number) ?? null,
      mediaType: (r.media_type as 'movie' | 'tv') ?? null,
      posterUrl: (r.poster_url as string) ?? null,
      year: (r.year as number) ?? null,
    }));
    return rankGroupRecommendations(signals, { limit });
  }

  const { data, error } = await supabase
    .from(TABLES.restaurant_ratings as any)
    .select('user_id, place_id, place_name, place_address, place_type, rating, visited_at, updated_at')
    .in('user_id', userIds);
  if (error) throw error;

  const signals: RatingSignal[] = (data ?? []).map((r: any) => ({
    key: (r.place_id as string) ?? `name:${String(r.place_name ?? '').toLowerCase()}`,
    raterId: r.user_id as string,
    rating: Number(r.rating),
    ratedAt: (r.visited_at as string) ?? (r.updated_at as string) ?? '',
    name: r.place_name as string,
    address: (r.place_address as string) ?? null,
    placeId: (r.place_id as string) ?? null,
    primaryType: (r.place_type as string) ?? null,
  }));
  return rankGroupRecommendations(signals, { limit });
}
