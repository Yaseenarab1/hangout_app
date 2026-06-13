import type { RatingSignal, GroupRecommendation } from '../types';

export type RankOptions = {
  /** Keys to drop (e.g. options already on the poll). */
  excludeKeys?: Set<string> | string[];
  /** Max recommendations to return. Default 12. */
  limit?: number;
  /** Only include items rated by at least this many distinct members. Default 1. */
  minRaters?: number;
};

/**
 * Rank candidates from a flat list of group ratings.
 *
 * - One rating per rater per item (latest wins) so a single enthusiastic rater
 *   can't stack the deck by rating the same place twice.
 * - Score = avgRating × log(1 + raterCount): favors places multiple members liked
 *   over a single 5★ outlier. (log keeps the rater-count boost from dominating.)
 * - Deterministic tie-break: score, then raterCount, then avgRating, then name.
 *
 * Pure and synchronous — unit-tested without Supabase.
 */
export function rankGroupRecommendations(
  signals: RatingSignal[],
  options: RankOptions = {},
): GroupRecommendation[] {
  const exclude =
    options.excludeKeys instanceof Set
      ? options.excludeKeys
      : new Set(options.excludeKeys ?? []);
  const minRaters = options.minRaters ?? 1;
  const limit = options.limit ?? 12;

  // key -> (raterId -> latest signal)
  const byKey = new Map<string, Map<string, RatingSignal>>();
  for (const s of signals) {
    if (!s.key || exclude.has(s.key)) continue;
    if (!Number.isFinite(s.rating)) continue;
    let raters = byKey.get(s.key);
    if (!raters) {
      raters = new Map();
      byKey.set(s.key, raters);
    }
    const existing = raters.get(s.raterId);
    if (!existing || (s.ratedAt ?? '') > (existing.ratedAt ?? '')) {
      raters.set(s.raterId, s);
    }
  }

  const recs: GroupRecommendation[] = [];
  for (const [key, raters] of byKey) {
    const rows = [...raters.values()];
    if (rows.length < minRaters) continue;
    const raterCount = rows.length;
    const avgRating = rows.reduce((sum, r) => sum + r.rating, 0) / raterCount;
    const score = avgRating * Math.log(1 + raterCount);
    const latest = rows.reduce((a, b) => ((a.ratedAt ?? '') >= (b.ratedAt ?? '') ? a : b));
    recs.push({
      key,
      name: latest.name,
      avgRating,
      raterCount,
      score,
      address: latest.address ?? null,
      placeId: latest.placeId ?? null,
      primaryType: latest.primaryType ?? null,
      tmdbId: latest.tmdbId ?? null,
      mediaType: latest.mediaType ?? null,
      posterUrl: latest.posterUrl ?? null,
      year: latest.year ?? null,
    });
  }

  recs.sort(
    (a, b) =>
      b.score - a.score ||
      b.raterCount - a.raterCount ||
      b.avgRating - a.avgRating ||
      a.name.localeCompare(b.name),
  );

  return recs.slice(0, limit);
}
