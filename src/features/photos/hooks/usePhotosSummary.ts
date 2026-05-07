import { useQuery } from '@tanstack/react-query';
import { fetchPhotos } from '../services/photos.service';
import type { HangoutPhoto } from '../types';

// Lightweight query — no realtime — for preview strips in the hangout detail screen.
// Only used where we need count + a few thumbnails without duplicating the
// realtime channels that PhotosScreen already owns.
export function usePhotosSummary(hangoutId: string): {
  photos: HangoutPhoto[];
  count: number;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ['photos-summary', hangoutId],
    queryFn: () => fetchPhotos(hangoutId),
    staleTime: 1000 * 60,
    select: (data) => data.slice(0, 3), // only need preview thumbnails
  });

  return {
    photos: query.data ?? [],
    count: query.data?.length ?? 0,
    isLoading: query.isLoading,
  };
}
