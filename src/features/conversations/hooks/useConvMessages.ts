import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRealtimeChannel } from '@/services/realtime';
import { fetchConvMessages } from '../services/conversations.service';
import { conversationsKey } from './useConversations';
import type { ConvMessage } from '../types';
import { CONV_PAGE_SIZE } from '../types';

type ConvMsgInfiniteData = InfiniteData<ConvMessage[], string | undefined>;

export const convMessagesKey = (convId: string) =>
  ['conv_messages', convId] as const;

export function useConvMessages(convId: string) {
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: convMessagesKey(convId),
    queryFn: ({ pageParam }) =>
      fetchConvMessages(convId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < CONV_PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    staleTime: 1000 * 30,
  });

  const messages: ConvMessage[] = (query.data?.pages ?? [])
    .flat()
    .slice()
    .reverse();

  // Realtime: new messages
  useRealtimeChannel<ConvMessage>({
    channelName: `conv:${convId}:messages`,
    table: 'conversation_messages',
    filter: `conversation_id=eq.${convId}`,
    event: 'INSERT',
    onInsert: (row) => {
      qc.setQueryData<ConvMsgInfiniteData>(convMessagesKey(convId), (prev) => {
        if (!prev) return prev;
        const allMsgs = prev.pages.flat();
        if (allMsgs.some((m) => m.id === row.id)) return prev;
        const newPages = [[row, ...(prev.pages[0] ?? [])], ...prev.pages.slice(1)];
        return { ...prev, pages: newPages };
      });
      // Refresh conversation list so last_message updates
      qc.invalidateQueries({ queryKey: conversationsKey });
    },
  });

  // Realtime: edits + soft-deletes
  useRealtimeChannel<ConvMessage>({
    channelName: `conv:${convId}:messages:updates`,
    table: 'conversation_messages',
    filter: `conversation_id=eq.${convId}`,
    event: 'UPDATE',
    onUpdate: (row) => {
      qc.setQueryData<ConvMsgInfiniteData>(convMessagesKey(convId), (prev) => {
        if (!prev) return prev;
        const newPages = prev.pages.map((page) =>
          page.map((m) => (m.id === row.id ? { ...m, ...row } : m)),
        );
        return { ...prev, pages: newPages };
      });
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
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    fetchOlder: () => query.fetchNextPage(),
    hasOlder: query.hasNextPage,
    isFetchingOlder: query.isFetchingNextPage,
  };
}
