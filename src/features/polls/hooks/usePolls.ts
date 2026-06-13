import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { hangoutKeys, type HangoutWithParticipants } from '@/features/hangouts';
import { useSession } from '@/features/auth';
import {
  createActivityHangout,
  createVenueHangout,
  createActivityPoll,
  createPollOnHangout,
  listPollsByHangout,
  getPollWithDetails,
  castVote,
  unvote,
  castRankedVote,
  clearRankedVote,
  addOption,
  addOptionsBatch,
  removeOption,
  startVoting,
  closePoll,
  reopenPoll,
  deletePoll,
  setParticipantVoteWeight,
} from '../services/polls.service';
import type {
  CreateActivityHangoutInput,
  CreateActivityPollInput,
  VoteInput,
  AddOptionInput,
  CastRankedVoteInput,
} from '../schemas';
import type { PollWithOptions } from '../types';

export const pollKeys = {
  all: ['polls'] as const,
  byHangout: (hangoutId: string) => ['polls', 'byHangout', hangoutId] as const,
  detail: (pollId: string) => ['polls', 'detail', pollId] as const,
};

/**
 * Read the current user's vote weight from the cached hangout detail so optimistic
 * vote updates move the weighted bar by the right amount (0.5×, 2×, …) instead of
 * always 1×. Falls back to 1 when the hangout isn't cached or the weight is unknown;
 * the onSettled refetch reconciles either way.
 */
function myVoteWeight(qc: QueryClient, hangoutId: string, userId: string | undefined): number {
  if (!userId) return 1;
  const hangout = qc.getQueryData<HangoutWithParticipants>(hangoutKeys.detail(hangoutId));
  const weight = hangout?.participants.find((p) => p.user_id === userId)?.vote_weight;
  return typeof weight === 'number' ? weight : 1;
}

export function usePollsByHangout(hangoutId: string | undefined) {
  return useQuery({
    queryKey: hangoutId ? pollKeys.byHangout(hangoutId) : ['polls', 'byHangout', 'noop'],
    queryFn: () => (hangoutId ? listPollsByHangout(hangoutId) : Promise.resolve([])),
    enabled: Boolean(hangoutId),
    staleTime: 15 * 1000,
  });
}

export function usePoll(pollId: string | undefined) {
  return useQuery({
    queryKey: pollId ? pollKeys.detail(pollId) : ['polls', 'detail', 'noop'],
    queryFn: () => (pollId ? getPollWithDetails(pollId) : Promise.resolve(null)),
    enabled: Boolean(pollId),
    staleTime: 5 * 1000,
  });
}

export function useCreateActivityHangout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateActivityHangoutInput) => createActivityHangout(input),
    onSuccess: ({ hangoutId }) => {
      qc.invalidateQueries({ queryKey: hangoutKeys.list() });
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      qc.invalidateQueries({ queryKey: pollKeys.byHangout(hangoutId) });
      toast.success('Hangout created!');
    },
    onError: (error) => {
      logError(error, { where: 'createActivityHangout' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useCreateVenueHangout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createVenueHangout>[0]) => createVenueHangout(input),
    onSuccess: ({ hangoutId }) => {
      qc.invalidateQueries({ queryKey: hangoutKeys.list() });
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      qc.invalidateQueries({ queryKey: pollKeys.byHangout(hangoutId) });
      toast.success('Hangout created!');
    },
    onError: (error) => {
      logError(error, { where: 'createVenueHangout' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useCreateActivityPoll(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateActivityPollInput) => createActivityPoll(hangoutId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pollKeys.byHangout(hangoutId) });
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      toast.success('Poll started.');
    },
    onError: (error) => {
      logError(error, { where: 'createActivityPoll' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

/**
 * Cast vote with optimistic update — UI flips instantly, reverts if server fails.
 * Handles edge cases:
 *   - Tap option A then B fast → final state is B (no flicker)
 *   - Server failure → revert to old state, show error
 *   - Tap same option already voted → existing unvote behavior
 */
export function useCastVote() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (input: VoteInput) => castVote(input),
    onMutate: async (input) => {
      const key = pollKeys.detail(input.pollId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PollWithOptions>(key);
      if (!prev) return { prev };

      const myWeight = myVoteWeight(qc, prev.hangout_id, user?.id);

      // Build new state: remove old vote (if any), add vote on input.optionId
      const oldVotedOptionId = prev.options.find((o) => o.isMyVote)?.id ?? null;
      const updated: PollWithOptions = {
        ...prev,
        options: prev.options.map((o) => {
          let voteCount = o.voteCount;
          let weightedScore = o.weightedScore;
          let isMyVote = o.isMyVote;

          if (o.id === oldVotedOptionId && oldVotedOptionId !== input.optionId) {
            voteCount = Math.max(0, voteCount - 1);
            weightedScore = Math.max(0, weightedScore - myWeight);
            isMyVote = false;
          }
          if (o.id === input.optionId) {
            if (!isMyVote) {
              voteCount += 1;
              weightedScore += myWeight;
              isMyVote = true;
            }
          }
          return { ...o, voteCount, weightedScore, isMyVote };
        }),
        // recompute total: count distinct voters but optimistically that's just incrementing if we didn't have a vote yet
        totalVotes: oldVotedOptionId ? prev.totalVotes : prev.totalVotes + 1,
        myVote: { ...(prev.myVote ?? {}), option_id: input.optionId } as PollWithOptions['myVote'],
      };
      qc.setQueryData(key, updated);
      return { prev };
    },
    onError: (error, input, context) => {
      const key = pollKeys.detail(input.pollId);
      if (context?.prev) qc.setQueryData(key, context.prev);
      logError(error, { where: 'castVote' });
      toast.error(friendlyErrorMessage(error));
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(input.pollId) });
    },
  });
}

/**
 * Unvote with optimistic update.
 */
export function useUnvote() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (pollId: string) => unvote(pollId),
    onMutate: async (pollId) => {
      const key = pollKeys.detail(pollId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PollWithOptions>(key);
      if (!prev) return { prev };
      const myWeight = myVoteWeight(qc, prev.hangout_id, user?.id);
      const updated: PollWithOptions = {
        ...prev,
        options: prev.options.map((o) =>
          o.isMyVote
            ? {
                ...o,
                voteCount: Math.max(0, o.voteCount - 1),
                weightedScore: Math.max(0, o.weightedScore - myWeight),
                isMyVote: false,
              }
            : o,
        ),
        totalVotes: Math.max(0, prev.totalVotes - 1),
        myVote: null,
      };
      qc.setQueryData(key, updated);
      return { prev };
    },
    onError: (error, pollId, context) => {
      const key = pollKeys.detail(pollId);
      if (context?.prev) qc.setQueryData(key, context.prev);
      logError(error, { where: 'unvote' });
      toast.error(friendlyErrorMessage(error));
    },
    onSettled: (_data, _err, pollId) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(pollId) });
    },
  });
}

/**
 * Cast ranked vote with optimistic update.
 * Replaces all my rankings with the new list at once.
 */
export function useCastRankedVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CastRankedVoteInput) => castRankedVote(input),
    onMutate: async (input) => {
      const key = pollKeys.detail(input.pollId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PollWithOptions>(key);
      if (!prev) return { prev };

      const myRankMap = new Map<string, number>();
      input.rankedOptionIds.forEach((id, idx) => myRankMap.set(id, idx + 1));

      // Recount voters: was I a voter before? am I now?
      const wasVoter = prev.myRanks.length > 0;
      const isNowVoter = input.rankedOptionIds.length > 0;
      const totalVotes = prev.totalVotes + (isNowVoter ? 1 : 0) - (wasVoter ? 1 : 0);

      const updated: PollWithOptions = {
        ...prev,
        options: prev.options.map((o) => {
          const newRank = myRankMap.get(o.id) ?? null;
          const wasFirstChoice = o.myRank === 1;
          const isFirstChoice = newRank === 1;
          let voteCount = o.voteCount;
          if (wasFirstChoice && !isFirstChoice) voteCount = Math.max(0, voteCount - 1);
          if (!wasFirstChoice && isFirstChoice) voteCount += 1;
          return { ...o, myRank: newRank, voteCount };
        }),
        myRanks: input.rankedOptionIds.map((optionId, idx) => ({
          optionId,
          rank: idx + 1,
        })),
        totalVotes,
      };
      qc.setQueryData(key, updated);
      return { prev };
    },
    onError: (error, input, context) => {
      const key = pollKeys.detail(input.pollId);
      if (context?.prev) qc.setQueryData(key, context.prev);
      logError(error, { where: 'castRankedVote' });
      toast.error(friendlyErrorMessage(error));
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(input.pollId) });
    },
  });
}

/**
 * Clear ranked vote with optimistic update.
 */
export function useClearRankedVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pollId: string) => clearRankedVote(pollId),
    onMutate: async (pollId) => {
      const key = pollKeys.detail(pollId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PollWithOptions>(key);
      if (!prev) return { prev };
      const wasVoter = prev.myRanks.length > 0;
      const updated: PollWithOptions = {
        ...prev,
        options: prev.options.map((o) => ({
          ...o,
          myRank: null,
          voteCount: o.myRank === 1 ? Math.max(0, o.voteCount - 1) : o.voteCount,
        })),
        myRanks: [],
        totalVotes: wasVoter ? Math.max(0, prev.totalVotes - 1) : prev.totalVotes,
      };
      qc.setQueryData(key, updated);
      return { prev };
    },
    onError: (error, pollId, context) => {
      const key = pollKeys.detail(pollId);
      if (context?.prev) qc.setQueryData(key, context.prev);
      logError(error, { where: 'clearRankedVote' });
      toast.error(friendlyErrorMessage(error));
    },
    onSettled: (_data, _err, pollId) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(pollId) });
    },
  });
}

export function useCreatePollOnHangout(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: 'activity' | 'cuisine' | 'restaurant' | 'venue';
      votingMethod: 'simple' | 'ranked';
      voteDeadline: string;
      options: { label: string; metadata?: Record<string, unknown> }[];
      title?: string;
    }) => createPollOnHangout({ ...input, hangoutId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pollKeys.byHangout(hangoutId) });
      toast.success('Vote started!');
    },
    onError: (error) => {
      logError(error, { where: 'createPollOnHangout' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useAddOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddOptionInput) => addOption(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(input.pollId), refetchType: 'active' });
    },
    onError: (error) => {
      logError(error, { where: 'addOption' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useAddOptionsBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      pollId: string;
      options: { label: string; metadata?: Record<string, unknown> }[];
    }) => addOptionsBatch(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(vars.pollId), refetchType: 'active' });
      toast.success('Options added.');
    },
    onError: (error) => {
      logError(error, { where: 'addOptionsBatch' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useRemoveOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ optionId }: { pollId: string; optionId: string }) => removeOption(optionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(vars.pollId), refetchType: 'active' });
    },
    onError: (error) => {
      logError(error, { where: 'removeOption' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useStartVoting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pollId: string) => startVoting(pollId),
    onSuccess: (_data, pollId) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(pollId) });
      toast.success('Voting started.');
    },
    onError: (error) => {
      logError(error, { where: 'startVoting' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useClosePoll(hangoutId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pollId,
      forcedWinnerOptionId,
    }: {
      pollId: string;
      forcedWinnerOptionId?: string;
    }) => closePoll(pollId, forcedWinnerOptionId),
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(vars.pollId) });
      if (hangoutId) {
        qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      }
      const msg = result.updatedLocation
        ? 'Poll closed — hangout location updated!'
        : 'Poll closed.';
      toast.success(msg);
    },
    onError: (error) => {
      logError(error, { where: 'closePoll' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useReopenPoll(hangoutId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pollId: string) => reopenPoll(pollId),
    onSuccess: (_data, pollId) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(pollId) });
      if (hangoutId) qc.invalidateQueries({ queryKey: pollKeys.byHangout(hangoutId) });
      toast.success('Poll reopened for voting.');
    },
    onError: (error) => {
      logError(error, { where: 'reopenPoll' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useDeletePoll(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pollId: string) => deletePoll(pollId),
    onSuccess: (_data, pollId) => {
      qc.removeQueries({ queryKey: pollKeys.detail(pollId) });
      qc.invalidateQueries({ queryKey: pollKeys.byHangout(hangoutId) });
      toast.success('Poll deleted.');
    },
    onError: (error) => {
      logError(error, { where: 'deletePoll' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useSetParticipantVoteWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      hangoutId,
      userId,
      weight,
    }: {
      hangoutId: string;
      userId: string;
      weight: number;
    }) => setParticipantVoteWeight(hangoutId, userId, weight),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(vars.hangoutId) });
      toast.success('Vote weight updated.');
    },
    onError: (error) => {
      logError(error, { where: 'setParticipantVoteWeight' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
