import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { supabase } from '@/services/supabase/client';
import { deletePhotoRow } from '../services/photos.service';
import { PHOTO_BUCKET } from '../types';
import { photosKey } from './usePhotos';
import { toast } from '@/stores/ui.store';
import type { HangoutPhoto } from '../types';

type PhotosData = InfiniteData<HangoutPhoto[], string | undefined>;

export function useDeletePhoto(hangoutId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      storagePath,
      thumbnailPath,
    }: {
      photoId: string;
      storagePath: string;
      thumbnailPath: string | null;
    }) => {
      await deletePhotoRow(photoId);
      const paths = [storagePath, thumbnailPath].filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from(PHOTO_BUCKET).remove(paths);
      }
    },

    onMutate: async ({ photoId }) => {
      await qc.cancelQueries({ queryKey: photosKey(hangoutId) });
      const prev = qc.getQueryData<PhotosData>(photosKey(hangoutId));
      qc.setQueryData<PhotosData>(photosKey(hangoutId), (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => page.filter((p) => p.id !== photoId)),
        };
      });
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(photosKey(hangoutId), ctx.prev);
      toast.error('Failed to delete photo.');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: photosKey(hangoutId) });
    },
  });
}
