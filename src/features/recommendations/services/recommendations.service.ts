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

type MediaRatingRow = {
  user_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_url: string | null;
  year: number | null;
  rating: number;
  watched_at: string | null;
  updated_at: string | null;
};

type PlaceRatingRow = {
  user_id: string;
  place_id: string | null;
  place_name: string;
  place_address: string | null;
  place_type: string | null;
  rating: number;
  visited_at: string | null;
  updated_at: string | null;
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
    // `media_ratings` isn't in the generated schema types; cast the table name.
    const { data, error } = await supabase
      .from('media_ratings' as never)
      .select('user_id, tmdb_id, media_type, title, poster_url, year, rating, watched_at, updated_at')
      .in('user_id', userIds);
    if (error) throw error;

    const rows = (data ?? []) as unknown as MediaRatingRow[];
    const signals: RatingSignal[] = rows.map((r) => ({
      key: `tmdb:${r.media_type}:${r.tmdb_id}`,
      raterId: r.user_id,
      rating: Number(r.rating),
      ratedAt: r.watched_at ?? r.updated_at ?? '',
      name: r.title,
      tmdbId: r.tmdb_id,
      mediaType: r.media_type,
      posterUrl: r.poster_url,
      year: r.year,
    }));
    return rankGroupRecommendations(signals, { limit });
  }

  const { data, error } = await supabase
    .from(TABLES.restaurant_ratings as never)
    .select('user_id, place_id, place_name, place_address, place_type, rating, visited_at, updated_at')
    .in('user_id', userIds);
  if (error) throw error;

  const rows = (data ?? []) as unknown as PlaceRatingRow[];
  const signals: RatingSignal[] = rows.map((r) => ({
    key: r.place_id ?? `name:${String(r.place_name ?? '').toLowerCase()}`,
    raterId: r.user_id,
    rating: Number(r.rating),
    ratedAt: r.visited_at ?? r.updated_at ?? '',
    name: r.place_name,
    address: r.place_address,
    placeId: r.place_id,
    primaryType: r.place_type,
  }));
  return rankGroupRecommendations(signals, { limit });
}
