import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { fetchOrCreateDM, createGroup } from '../services/conversations.service';
import { conversationsKey } from './useConversations';
import { toast } from '@/stores/ui.store';

export function useOpenDM() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ friendId }: { friendId: string; friendName: string }) =>
      fetchOrCreateDM(friendId),
    onSuccess: (conv, { friendName }) => {
      qc.invalidateQueries({ queryKey: conversationsKey });
      // replace so the "new message" modal is removed from history
      router.replace(`/conversations/${conv.id}?title=${encodeURIComponent(friendName)}` as any);
    },
    onError: () => {
      toast.error('Could not open chat.');
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ name, memberIds }: { name: string; memberIds: string[] }) =>
      createGroup(name, memberIds),
    onSuccess: (conv, { name }) => {
      qc.invalidateQueries({ queryKey: conversationsKey });
      router.replace(`/conversations/${conv.id}?title=${encodeURIComponent(name)}` as any);
    },
    onError: () => {
      toast.error('Could not create group.');
    },
  });
}
