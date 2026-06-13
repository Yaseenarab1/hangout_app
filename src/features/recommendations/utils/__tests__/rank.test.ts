import { rankGroupRecommendations } from '../rank';
import type { RatingSignal } from '../../types';

function signal(partial: Partial<RatingSignal> & Pick<RatingSignal, 'key' | 'raterId' | 'rating'>): RatingSignal {
  return {
    ratedAt: '2024-01-01T00:00:00Z',
    name: partial.key,
    ...partial,
  };
}

describe('rankGroupRecommendations', () => {
  it('returns nothing for an empty signal list', () => {
    expect(rankGroupRecommendations([])).toEqual([]);
  });

  it('favors places multiple members liked over a single high outlier', () => {
    // X: 4.0 from three raters → 4 × ln(4) ≈ 5.55
    // Y: 5.0 from one rater   → 5 × ln(2) ≈ 3.47
    const signals: RatingSignal[] = [
      signal({ key: 'X', raterId: 'a', rating: 4 }),
      signal({ key: 'X', raterId: 'b', rating: 4 }),
      signal({ key: 'X', raterId: 'c', rating: 4 }),
      signal({ key: 'Y', raterId: 'd', rating: 5 }),
    ];
    const recs = rankGroupRecommendations(signals);
    expect(recs.map((r) => r.key)).toEqual(['X', 'Y']);
    expect(recs[0]).toMatchObject({ key: 'X', raterCount: 3, avgRating: 4 });
  });

  it('counts one rating per rater (latest wins)', () => {
    const signals: RatingSignal[] = [
      signal({ key: 'X', raterId: 'a', rating: 3, ratedAt: '2024-01-01T00:00:00Z' }),
      signal({ key: 'X', raterId: 'a', rating: 5, ratedAt: '2024-06-01T00:00:00Z' }),
    ];
    const recs = rankGroupRecommendations(signals);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ raterCount: 1, avgRating: 5 });
  });

  it('drops excluded keys', () => {
    const signals: RatingSignal[] = [
      signal({ key: 'X', raterId: 'a', rating: 5 }),
      signal({ key: 'Y', raterId: 'b', rating: 5 }),
    ];
    const recs = rankGroupRecommendations(signals, { excludeKeys: ['X'] });
    expect(recs.map((r) => r.key)).toEqual(['Y']);
  });

  it('honors minRaters', () => {
    const signals: RatingSignal[] = [
      signal({ key: 'X', raterId: 'a', rating: 5 }),
      signal({ key: 'Y', raterId: 'b', rating: 5 }),
      signal({ key: 'Y', raterId: 'c', rating: 4 }),
    ];
    const recs = rankGroupRecommendations(signals, { minRaters: 2 });
    expect(recs.map((r) => r.key)).toEqual(['Y']);
  });

  it('respects the limit', () => {
    const signals: RatingSignal[] = ['X', 'Y', 'Z'].map((key) =>
      signal({ key, raterId: 'a', rating: 5 }),
    );
    expect(rankGroupRecommendations(signals, { limit: 2 })).toHaveLength(2);
  });

  it('carries the display payload from the latest rating', () => {
    const signals: RatingSignal[] = [
      signal({
        key: 'place-1',
        raterId: 'a',
        rating: 5,
        name: 'Joe’s Pizza',
        placeId: 'place-1',
        address: '7 Carmine St',
        primaryType: 'pizza_restaurant',
      }),
    ];
    const [rec] = rankGroupRecommendations(signals);
    expect(rec).toMatchObject({
      name: 'Joe’s Pizza',
      placeId: 'place-1',
      address: '7 Carmine St',
      primaryType: 'pizza_restaurant',
    });
  });
});
