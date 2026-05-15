import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/services/supabase/tables';
import { logError } from '@/services/errors';
import { likePost, unlikePost } from '../services/feed.service';
import type { FeedPostWithUrl } from '../types';

export function useLikePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      liked ? likePost(postId) : unlikePost(postId),

    onMutate: async ({ postId, liked }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.feedPosts() });
      const prev = qc.getQueryData<FeedPostWithUrl[]>(QUERY_KEYS.feedPosts());

      qc.setQueryData<FeedPostWithUrl[]>(QUERY_KEYS.feedPosts(), (old) =>
        old?.map((p) =>
          p.id === postId
            ? {
                ...p,
                viewer_has_liked: liked,
                like_count: (p.like_count ?? 0) + (liked ? 1 : -1),
              }
            : p,
        ),
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(QUERY_KEYS.feedPosts(), ctx.prev);
      }
      logError(_err, { where: 'useLikePost' });
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.feedPosts() });
    },
  });
}
