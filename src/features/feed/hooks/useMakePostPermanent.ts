import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/services/supabase/tables';
import { toast } from '@/stores/ui.store';
import { logError } from '@/services/errors';
import { makePostPermanent } from '../services/feed.service';

export function useMakePostPermanent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => makePostPermanent(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.feedPosts() });
      toast.success('Post saved to your profile.');
    },
    onError: (error) => {
      logError(error, { where: 'makePostPermanent' });
      toast.error('Could not save post. Try again.');
    },
  });
}
