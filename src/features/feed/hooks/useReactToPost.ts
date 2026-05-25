import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reactToPost, reactToComment } from '../services/feed.service';
import { QUERY_KEYS } from '@/services/supabase/tables';
import type { ReactionType, FeedPostWithUrl } from '../types';

export function useReactToPost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      reactionType,
      currentReaction,
    }: {
      postId: string;
      reactionType: ReactionType;
      currentReaction: ReactionType | null;
    }) => reactToPost(postId, reactionType, currentReaction),

    onMutate: async ({ postId, reactionType, currentReaction }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.feedPosts() });
      const prev = qc.getQueryData<FeedPostWithUrl[]>(QUERY_KEYS.feedPosts());

      const isToggleOff = currentReaction === reactionType;

      qc.setQueryData<FeedPostWithUrl[]>(QUERY_KEYS.feedPosts(), (old) =>
        (old ?? []).map((p) => {
          if (p.id !== postId) return p;
          const newReaction = isToggleOff ? null : reactionType;
          const likeDelta = isToggleOff ? -1 : currentReaction ? 0 : 1;
          return {
            ...p,
            viewer_has_liked: !isToggleOff,
            viewer_reaction: newReaction,
            like_count: Math.max(0, (p.like_count ?? 0) + likeDelta),
          };
        }),
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.feedPosts(), ctx.prev);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.feedPosts() });
    },
  });
}

export function useReactToComment(postId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      reactionType,
      currentReaction,
    }: {
      commentId: string;
      reactionType: ReactionType;
      currentReaction: ReactionType | null;
    }) => reactToComment(commentId, reactionType, currentReaction),

    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.feedComments(postId) });
    },
  });
}
