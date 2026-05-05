import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { hangoutKeys } from '@/features/hangouts';
import {
  createActivityHangout,
  createActivityPoll,
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
  setParticipantVoteWeight,
} from '../services/polls.service';
import type {
  CreateActivityHangoutInput,
  CreateActivityPollInput,
  VoteInput,
  AddOptionInput,
  CastRankedVoteInput,
} from '../schemas';

export const pollKeys = {
  all: ['polls'] as const,
  byHangout: (hangoutId: string) => ['polls', 'byHangout', hangoutId] as const,
  detail: (pollId: string) => ['polls', 'detail', pollId] as const,
};

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

export function useCastVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VoteInput) => castVote(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(input.pollId), refetchType: 'active' });
    },
    onError: (error) => {
      logError(error, { where: 'castVote' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useUnvote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pollId: string) => unvote(pollId),
    onSuccess: (_data, pollId) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(pollId), refetchType: 'active' });
    },
    onError: (error) => {
      logError(error, { where: 'unvote' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useCastRankedVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CastRankedVoteInput) => castRankedVote(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(input.pollId), refetchType: 'active' });
    },
    onError: (error) => {
      logError(error, { where: 'castRankedVote' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useClearRankedVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pollId: string) => clearRankedVote(pollId),
    onSuccess: (_data, pollId) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(pollId), refetchType: 'active' });
    },
    onError: (error) => {
      logError(error, { where: 'clearRankedVote' });
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
      options: Array<{ label: string; metadata?: Record<string, unknown> }>;
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
    mutationFn: ({ optionId }: { pollId: string; optionId: string }) =>
      removeOption(optionId),
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

export function useClosePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pollId,
      forcedWinnerOptionId,
    }: {
      pollId: string;
      forcedWinnerOptionId?: string;
    }) => closePoll(pollId, forcedWinnerOptionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: pollKeys.detail(vars.pollId) });
      toast.success('Poll closed.');
    },
    onError: (error) => {
      logError(error, { where: 'closePoll' });
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
