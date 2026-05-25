import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/services/supabase/client';
import { QUERY_KEYS } from '@/services/supabase/tables';
import { toast } from '@/stores/ui.store';
import { logError, friendlyErrorMessage } from '@/services/errors';
import { getComments, createComment, deleteComment } from '../services/feed.service';
import type { FeedPostComment } from '../types';

export function useComments(postId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: postId ? QUERY_KEYS.feedComments(postId) : ['feed', 'comments', 'noop'],
    queryFn: () => (postId ? getComments(postId) : Promise.resolve<FeedPostComment[]>([])),
    enabled: Boolean(postId),
    staleTime: 15 * 1000,
  });

  // Realtime: merge new comments into cache
  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`post:${postId}:comments`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_post_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          qc.setQueryData<FeedPostComment[]>(QUERY_KEYS.feedComments(postId), (prev) => {
            if (!prev) return prev;
            const already = prev.some((c) => c.id === payload.new.id);
            return already ? prev : [...prev, payload.new as FeedPostComment];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.realtime.channels = supabase.realtime.channels.filter((c) => c !== channel);
      supabase.removeChannel(channel);
    };
  }, [postId, qc]);

  return query;
}

export function useCreateComment(postId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => createComment(postId, body),

    // Optimistic: append immediately
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.feedComments(postId) });
      const prev = qc.getQueryData<FeedPostComment[]>(QUERY_KEYS.feedComments(postId));

      const optimistic: FeedPostComment = {
        id: `optimistic-${Date.now()}`,
        post_id: postId,
        user_id: '',
        body,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
      };

      qc.setQueryData<FeedPostComment[]>(QUERY_KEYS.feedComments(postId), (old) => [
        ...(old ?? []),
        optimistic,
      ]);

      return { prev };
    },

    onError: (_err, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.feedComments(postId), ctx.prev);
      toast.error(friendlyErrorMessage(_err));
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.feedComments(postId) });
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.feedComments(postId) });
    },
    onError: (error) => {
      logError(error, { where: 'deleteComment' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
