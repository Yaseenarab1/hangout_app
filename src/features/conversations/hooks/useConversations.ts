import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRealtimeChannel } from '@/services/realtime';
import { fetchConversations } from '../services/conversations.service';

export const conversationsKey = ['conversations'] as const;

export function useConversations() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: conversationsKey,
    queryFn: fetchConversations,
    staleTime: 1000 * 30,
  });

  // Realtime: when a new conversation_message arrives, refresh the list
  useRealtimeChannel({
    channelName: 'conv_list_updates',
    table: 'conversations',
    event: 'UPDATE',
    onUpdate: () => {
      qc.invalidateQueries({ queryKey: conversationsKey });
    },
  });

  // Refetch on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') query.refetch();
    });
    return () => sub.remove();
  }, [query]);

  return {
    conversations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
