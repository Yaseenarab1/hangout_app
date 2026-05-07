import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { updatePhotoCaption } from '../services/photos.service';
import { photosKey } from './usePhotos';
import { toast } from '@/stores/ui.store';
import type { HangoutPhoto } from '../types';

type PhotosData = InfiniteData<HangoutPhoto[], string | undefined>;

export function useUpdateCaption(hangoutId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ photoId, caption }: { photoId: string; caption: string }) =>
      updatePhotoCaption(photoId, caption),

    onMutate: ({ photoId, caption }) => {
      const prev = qc.getQueryData<PhotosData>(photosKey(hangoutId));
      qc.setQueryData<PhotosData>(photosKey(hangoutId), (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) =>
            page.map((p) =>
              p.id === photoId ? { ...p, caption: caption.trim() || null } : p,
            ),
          ),
        };
      });
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(photosKey(hangoutId), ctx.prev);
      toast.error('Failed to save caption.');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: photosKey(hangoutId) });
    },
  });
}
