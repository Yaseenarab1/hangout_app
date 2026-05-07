import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRealtimeChannel } from '@/services/realtime';
import { fetchPhotos } from '../services/photos.service';
import type { HangoutPhoto } from '../types';
import { PHOTO_PAGE_SIZE } from '../types';

type PhotosData = InfiniteData<HangoutPhoto[], string | undefined>;

export const photosKey = (hangoutId: string) => ['photos', hangoutId] as const;

export function usePhotos(hangoutId: string) {
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: photosKey(hangoutId),
    queryFn: ({ pageParam }) =>
      fetchPhotos(hangoutId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PHOTO_PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    staleTime: 1000 * 60,
  });

  // Photos sorted oldest-first for display (pages are newest-first from DB)
  const photos: HangoutPhoto[] = (query.data?.pages ?? []).flat().slice().reverse();

  // Realtime: new photos → invalidate so signed URLs are hydrated
  useRealtimeChannel<HangoutPhoto>({
    channelName: `hangout:${hangoutId}:photos`,
    table: 'hangout_photos',
    filter: `hangout_id=eq.${hangoutId}`,
    event: 'INSERT',
    onInsert: () => {
      qc.invalidateQueries({ queryKey: photosKey(hangoutId) });
    },
  });

  // Realtime: caption edits
  useRealtimeChannel<HangoutPhoto>({
    channelName: `hangout:${hangoutId}:photos:updates`,
    table: 'hangout_photos',
    filter: `hangout_id=eq.${hangoutId}`,
    event: 'UPDATE',
    onUpdate: (row) => {
      qc.setQueryData<PhotosData>(photosKey(hangoutId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) =>
            page.map((p) => (p.id === row.id ? { ...p, ...row } : p)),
          ),
        };
      });
    },
  });

  // Realtime: deletes
  useRealtimeChannel<{ id: string }>({
    channelName: `hangout:${hangoutId}:photos:deletes`,
    table: 'hangout_photos',
    filter: `hangout_id=eq.${hangoutId}`,
    event: 'DELETE',
    onDelete: (row) => {
      qc.setQueryData<PhotosData>(photosKey(hangoutId), (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page) => page.filter((p) => p.id !== row.id)),
        };
      });
    },
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') query.refetch();
    });
    return () => sub.remove();
  }, [query]);

  return {
    photos,
    isLoading: query.isLoading,
    isError: query.isError,
    fetchOlder: () => query.fetchNextPage(),
    hasOlder: query.hasNextPage,
    isFetchingOlder: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}
