import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import {
  fetchMyRatings,
  upsertRating,
  deleteRating,
  fetchFriendRatings,
  fetchHangoutRestaurants,
} from '../services/ratings.service';
import type { RestaurantRating, UpsertRatingInput, PlaceCompatibility } from '../types';

export const ratingsKeys = {
  mine: ['ratings', 'mine'] as const,
  friendsForPlaces: (placeIds: string[], friendIds: string[]) =>
    ['ratings', 'friends', [...placeIds].sort().join(','), [...friendIds].sort().join(',')] as const,
};

export function useMyRatings() {
  return useQuery({
    queryKey: ratingsKeys.mine,
    queryFn: fetchMyRatings,
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpsertRating() {
  const qc = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: upsertRating,
    onMutate: async (input: UpsertRatingInput) => {
      await qc.cancelQueries({ queryKey: ratingsKeys.mine });
      const prev = qc.getQueryData<RestaurantRating[]>(ratingsKeys.mine);

      const optimistic: RestaurantRating = {
        id: `optimistic-${Date.now()}`,
        user_id: user?.id ?? '',
        place_id: input.place_id,
        place_name: input.place_name,
        place_address: input.place_address ?? null,
        place_photo: input.place_photo ?? null,
        place_type: input.place_type ?? null,
        rating: input.rating,
        notes: input.notes ?? null,
        visited_at: input.visited_at ?? new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      qc.setQueryData<RestaurantRating[]>(ratingsKeys.mine, (old) => {
        const filtered = (old ?? []).filter((r) => r.place_id !== input.place_id);
        return [optimistic, ...filtered];
      });

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ratingsKeys.mine, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ratingsKeys.mine });
    },
  });
}

export function useDeleteRating() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteRating,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ratingsKeys.mine });
      const prev = qc.getQueryData<RestaurantRating[]>(ratingsKeys.mine);
      qc.setQueryData<RestaurantRating[]>(ratingsKeys.mine, (old) =>
        (old ?? []).filter((r) => r.id !== id),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ratingsKeys.mine, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ratingsKeys.mine });
    },
  });
}

export function useHangoutPlaces(hangoutId?: string) {
  return useQuery({
    queryKey: ['ratings', 'hangout-places', hangoutId ?? 'all'],
    queryFn: () => fetchHangoutRestaurants(hangoutId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFriendCompatibility(
  placeIds: string[],
  participantIds: string[],
): Map<string, PlaceCompatibility> {
  const { user } = useSession();

  // Exclude self from friends list (self-rating fetched separately via useMyRatings)
  const friendIds = participantIds.filter((id) => id !== user?.id);

  const query = useQuery({
    queryKey: ratingsKeys.friendsForPlaces(placeIds, friendIds),
    queryFn: () => fetchFriendRatings(placeIds, friendIds),
    enabled: placeIds.length > 0 && friendIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const myRatings = useMyRatings();

  return useMemo(() => {
    const map = new Map<string, PlaceCompatibility>();
    if (!query.data && !myRatings.data) return map;

    const allRatings = [...(query.data ?? []), ...(myRatings.data ?? [])];
    const allParticipants = new Set(participantIds);

    placeIds.forEach((placeId) => {
      const relevant = allRatings.filter(
        (r) => r.place_id === placeId && allParticipants.has(r.user_id),
      );
      if (relevant.length === 0) return;
      const avg = relevant.reduce((s, r) => s + r.rating, 0) / relevant.length;
      const myRating = myRatings.data?.find((r) => r.place_id === placeId)?.rating ?? null;
      map.set(placeId, { place_id: placeId, raterCount: relevant.length, avgRating: avg, myRating });
    });

    return map;
  }, [query.data, myRatings.data, placeIds, participantIds]);
}
