import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRealtimeChannel } from '@/services/realtime';
import { fetchMessages } from '../services/messages.service';
import type { Message } from '../types';
import { MESSAGE_PAGE_SIZE } from '../types';

type MessagesInfiniteData = InfiniteData<Message[], string | undefined>;

export const messagesKey = (hangoutId: string) =>
  ['messages', hangoutId] as const;

export function useMessages(hangoutId: string) {
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: messagesKey(hangoutId),
    queryFn: ({ pageParam }) =>
      fetchMessages(hangoutId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < MESSAGE_PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    staleTime: 1000 * 30,
  });

  // Flatten pages into a single ascending list for rendering
  const messages: Message[] = (query.data?.pages ?? [])
    .flat()
    .slice()
    .reverse();

  // Realtime: new messages
  useRealtimeChannel<Message>({
    channelName: `hangout:${hangoutId}:messages`,
    table: 'messages',
    filter: `hangout_id=eq.${hangoutId}`,
    event: 'INSERT',
    onInsert: (row) => {
      qc.setQueryData<MessagesInfiniteData>(
        messagesKey(hangoutId),
        (prev) => {
          if (!prev) return prev;
          const allMsgs = prev.pages.flat();
          const exists = allMsgs.some((m: Message) => m.id === row.id);
          if (exists) return prev;
          const newPages = [[row, ...(prev.pages[0] ?? [])], ...prev.pages.slice(1)];
          return { ...prev, pages: newPages };
        },
      );
    },
  });

  // Realtime: edits + soft-deletes
  useRealtimeChannel<Message>({
    channelName: `hangout:${hangoutId}:messages:updates`,
    table: 'messages',
    filter: `hangout_id=eq.${hangoutId}`,
    event: 'UPDATE',
    onUpdate: (row) => {
      qc.setQueryData<MessagesInfiniteData>(
        messagesKey(hangoutId),
        (prev) => {
          if (!prev) return prev;
          const newPages = prev.pages.map((page: Message[]) =>
            page.map((m: Message) => (m.id === row.id ? { ...m, ...row } : m)),
          );
          return { ...prev, pages: newPages };
        },
      );
    },
  });

  // Refetch on foreground in case we missed events while backgrounded
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
    refetch: query.refetch,
  };
}
