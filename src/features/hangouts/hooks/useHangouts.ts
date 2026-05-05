import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import {
  listMyHangouts,
  getHangout,
  createHangout,
  updateHangout,
  cancelHangout,
  deleteHangout,
  inviteParticipants,
  updateParticipant,
  removeParticipant,
} from '../services/hangouts.service';
import type {
  CreateHangoutInput,
  UpdateHangoutInput,
  InviteParticipantsInput,
  UpdateParticipantInput,
} from '../schemas';

/** Query keys for hangout-related caches. */
export const hangoutKeys = {
  all: ['hangouts'] as const,
  list: () => ['hangouts', 'list'] as const,
  detail: (id: string) => ['hangouts', 'detail', id] as const,
};

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export function useMyHangouts() {
  return useQuery({
    queryKey: hangoutKeys.list(),
    queryFn: listMyHangouts,
    staleTime: 30 * 1000, // 30s
  });
}

export function useHangout(id: string | undefined) {
  return useQuery({
    queryKey: id ? hangoutKeys.detail(id) : ['hangouts', 'detail', 'noop'],
    queryFn: () => (id ? getHangout(id) : Promise.resolve(null)),
    enabled: Boolean(id),
    staleTime: 15 * 1000,
  });
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export function useCreateHangout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHangoutInput) => createHangout(input),
    onSuccess: (hangout) => {
      qc.invalidateQueries({ queryKey: hangoutKeys.list() });
      qc.setQueryData(hangoutKeys.detail(hangout.id), null); // force re-fetch on navigate
      toast.success('Hangout created!');
    },
    onError: (error) => {
      logError(error, { where: 'createHangout' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useUpdateHangout(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateHangoutInput) => updateHangout(hangoutId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      qc.invalidateQueries({ queryKey: hangoutKeys.list() });
      toast.success('Hangout updated.');
    },
    onError: (error) => {
      logError(error, { where: 'updateHangout' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useCancelHangout(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cancelHangout(hangoutId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      qc.invalidateQueries({ queryKey: hangoutKeys.list() });
      toast.success('Hangout cancelled.');
    },
    onError: (error) => {
      logError(error, { where: 'cancelHangout' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useDeleteHangout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHangout(id),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: hangoutKeys.detail(id) });
      qc.invalidateQueries({ queryKey: hangoutKeys.list() });
      toast.success('Hangout deleted.');
    },
    onError: (error) => {
      logError(error, { where: 'deleteHangout' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useInviteParticipants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteParticipantsInput) => inviteParticipants(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(input.hangoutId) });
      toast.success('Invites sent.');
    },
    onError: (error) => {
      logError(error, { where: 'inviteParticipants' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useUpdateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateParticipantInput) => updateParticipant(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({
        queryKey: hangoutKeys.detail(input.hangoutId),
        refetchType: 'active',
      });
      qc.invalidateQueries({
        queryKey: hangoutKeys.list(),
        refetchType: 'active',
      });
    },
    onError: (error) => {
      logError(error, { where: 'updateParticipant' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useRemoveParticipant(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeParticipant(hangoutId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      toast.success('Participant removed.');
    },
    onError: (error) => {
      logError(error, { where: 'removeParticipant' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
