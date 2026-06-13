/**
 * Group-context recommendations ("smart defaults").
 *
 * When a group is about to vote on where to eat / what to do / what to watch,
 * we rank candidates from what the group's members have already rated highly
 * (and, for places, where they've been together). The strongest signal is the
 * group's own ratings — see `utils/rank.ts`.
 */

export type RecommendationKind = 'restaurant' | 'venue' | 'activity' | 'movie';

/**
 * A single normalized rating, fed into the ranker. `key` is the dedupe/exclude
 * identity: a Google `place_id` for places, `tmdb:<type>:<id>` for media.
 */
export type RatingSignal = {
  key: string;
  raterId: string;
  /** 1..5 */
  rating: number;
  /** ISO timestamp — used for "latest rating per rater" and tie-breaks. */
  ratedAt: string;

  // Display payload, carried through to the winning recommendation:
  name: string;
  address?: string | null;
  placeId?: string | null;
  primaryType?: string | null;

  // Media-only:
  tmdbId?: number | null;
  mediaType?: 'movie' | 'tv' | null;
  posterUrl?: string | null;
  year?: number | null;
};

/** A ranked suggestion shown to the group. */
export type GroupRecommendation = {
  key: string;
  name: string;
  /** Average of the group's ratings (1..5). */
  avgRating: number;
  /** How many distinct group members rated it. */
  raterCount: number;
  /** Ranking score: `avgRating × log(1 + raterCount)`. */
  score: number;

  address?: string | null;
  placeId?: string | null;
  primaryType?: string | null;

  tmdbId?: number | null;
  mediaType?: 'movie' | 'tv' | null;
  posterUrl?: string | null;
  year?: number | null;
};
