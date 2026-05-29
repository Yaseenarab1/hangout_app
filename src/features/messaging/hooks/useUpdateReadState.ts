import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { upsertReadState, fetchReadState } from '../services/messages.service';
import type { MessageReadState } from '../types';

export const readStateKey = (hangoutId: string) =>
  ['message-read-state', hangoutId] as const;

export function useReadState(hangoutId: string) {
  return useQuery({
    queryKey: readStateKey(hangoutId),
    queryFn: () => fetchReadState(hangoutId),
    staleTime: 1000 * 60,
  });
}

export function useUpdateReadState(hangoutId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (lastReadMessageId: string) =>
      upsertReadState(hangoutId, lastReadMessageId),
    onSuccess: (_, lastReadMessageId) => {
      qc.setQueryData<MessageReadState | null>(readStateKey(hangoutId), (prev) => ({
        hangout_id: hangoutId,
        user_id: prev?.user_id ?? '',
        last_read_message_id: lastReadMessageId,
        last_read_at: new Date().toISOString(),
      }));
      // Remove this hangout from the global unread set immediately
      qc.setQueryData<string[]>(['messages-unread-all'], (prev) =>
        prev ? prev.filter((id) => id !== hangoutId) : [],
      );
    },
  });
}
