import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { addPhotoReaction, removePhotoReaction } from '../services/photos.service';
import { photosKey } from './usePhotos';
import { toast } from '@/stores/ui.store';
import type { HangoutPhoto } from '../types';

type PhotosData = InfiniteData<HangoutPhoto[], string | undefined>;

export function useReactToPhoto(hangoutId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      emoji,
      myUserId,
    }: {
      photoId: string;
      emoji: string;
      myUserId: string;
    }) => {
      const data = qc.getQueryData<PhotosData>(photosKey(hangoutId));
      const photo = data?.pages.flat().find((p) => p.id === photoId);
      const existing = photo?.reactions?.find(
        (r) => r.user_id === myUserId && r.emoji === emoji,
      );
      if (existing) {
        await removePhotoReaction(photoId, emoji);
        return 'removed';
      }
      await addPhotoReaction(photoId, emoji);
      return 'added';
    },

    onMutate: ({ photoId, emoji, myUserId }) => {
      const prev = qc.getQueryData<PhotosData>(photosKey(hangoutId));
      qc.setQueryData<PhotosData>(photosKey(hangoutId), (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) =>
            page.map((p) => {
              if (p.id !== photoId) return p;
              const reactions = p.reactions ?? [];
              const exists = reactions.some(
                (r) => r.user_id === myUserId && r.emoji === emoji,
              );
              return {
                ...p,
                reactions: exists
                  ? reactions.filter(
                      (r) => !(r.user_id === myUserId && r.emoji === emoji),
                    )
                  : [
                      ...reactions,
                      {
                        photo_id: photoId,
                        user_id: myUserId,
                        emoji,
                        created_at: new Date().toISOString(),
                      },
                    ],
              };
            }),
          ),
        };
      });
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(photosKey(hangoutId), ctx.prev);
      toast.error('Failed to react.');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: photosKey(hangoutId) });
    },
  });
}
