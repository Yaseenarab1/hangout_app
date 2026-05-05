import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import {
  listMyCustomActivities,
  saveCustomActivity,
  deleteCustomActivity,
  type UserCustomActivity,
} from '../services/customActivities.service';

const customActivityKeys = {
  list: ['customActivities', 'list'] as const,
};

export function useMyCustomActivities() {
  return useQuery({
    queryKey: customActivityKeys.list,
    queryFn: listMyCustomActivities,
    staleTime: 60 * 1000, // 1 min — these don't change often
  });
}

export function useSaveCustomActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ label, emoji }: { label: string; emoji?: string }) =>
      saveCustomActivity(label, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customActivityKeys.list });
    },
    onError: (error) => {
      logError(error, { where: 'saveCustomActivity' });
      // Non-critical — don't toast since it's a side effect
    },
  });
}

export function useDeleteCustomActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomActivity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customActivityKeys.list });
    },
    onError: (error) => {
      logError(error, { where: 'deleteCustomActivity' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export type { UserCustomActivity };
