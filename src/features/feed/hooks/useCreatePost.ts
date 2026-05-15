import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/services/supabase/tables';
import { toast } from '@/stores/ui.store';
import { logError, friendlyErrorMessage } from '@/services/errors';
import { createFeedPost } from '../services/feed.service';
import type { CreatePostParams } from '../types';

export function useCreatePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: CreatePostParams) => createFeedPost(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.feedPosts() });
    },
    onError: (error) => {
      logError(error, { where: 'createFeedPost' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
