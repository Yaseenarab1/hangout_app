import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { hangoutKeys, type HangoutWithParticipants } from '@/features/hangouts';
import { fetchGroupRecommendations } from '../services/recommendations.service';
import type { RecommendationKind } from '../types';

export type UseGroupRecommendationsInput = {
  kind: RecommendationKind;
  /** Explicit group. Wins over `hangoutId` when non-empty. */
  participantIds?: string[];
  /** Resolve the group from the cached hangout detail when `participantIds` is omitted. */
  hangoutId?: string;
  enabled?: boolean;
};

export const recommendationKeys = {
  group: (kind: RecommendationKind, groupIds: string[]) =>
    ['recommendations', kind, groupIds.join(',')] as const,
};

/**
 * Recommendations for the group around `hangoutId` (or an explicit participant
 * list). The current user is always part of the group, so a solo creator still
 * sees their own favorites before anyone is invited.
 *
 * Note: results are NOT filtered by already-selected options here — that's done
 * in the component so toggling a selection doesn't refetch.
 */
export function useGroupRecommendations({
  kind,
  participantIds,
  hangoutId,
  enabled = true,
}: UseGroupRecommendationsInput) {
  const qc = useQueryClient();
  const { user } = useSession();

  const groupIds = useMemo(() => {
    const ids = new Set<string>();
    if (user?.id) ids.add(user.id);
    if (participantIds && participantIds.length > 0) {
      participantIds.forEach((id) => ids.add(id));
    } else if (hangoutId) {
      const hangout = qc.getQueryData<HangoutWithParticipants>(hangoutKeys.detail(hangoutId));
      (hangout?.participants ?? [])
        .filter((p) => p.status !== 'removed')
        .forEach((p) => ids.add(p.user_id));
    }
    return [...ids].sort();
  }, [user?.id, participantIds, hangoutId, qc]);

  return useQuery({
    queryKey: recommendationKeys.group(kind, groupIds),
    queryFn: () => fetchGroupRecommendations({ participantIds: groupIds, kind }),
    enabled: enabled && groupIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
