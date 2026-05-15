import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/services/supabase/tables';
import { toast } from '@/stores/ui.store';
import { logError, friendlyErrorMessage } from '@/services/errors';
import { deleteFeedPost } from '../services/feed.service';

export function useDeletePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deleteFeedPost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.feedPosts() });
      toast.success('Post deleted.');
    },
    onError: (error) => {
      logError(error, { where: 'deletePost' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
