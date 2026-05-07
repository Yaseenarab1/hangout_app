import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase/client';
import { addReaction, removeReaction } from '../services/messages.service';
import { messagesKey } from './useMessages';
import { toast } from '@/stores/ui.store';
import type { Message, MessageReaction } from '../types';

export function useReactToMessage(hangoutId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
      hasReacted,
    }: {
      messageId: string;
      emoji: string;
      hasReacted: boolean;
    }) => {
      if (hasReacted) {
        await removeReaction(messageId, emoji);
      } else {
        await addReaction(messageId, emoji);
      }
    },

    onMutate: async ({ messageId, emoji, hasReacted }) => {
      await qc.cancelQueries({ queryKey: messagesKey(hangoutId) });

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? '';

      const prev = qc.getQueryData<any>(messagesKey(hangoutId));

      qc.setQueryData<any>(messagesKey(hangoutId), (data: any) => {
        if (!data) return data;
        const newPages = data.pages.map((page: Message[]) =>
          page.map((m) => {
            if (m.id !== messageId) return m;
            const reactions = m.reactions ?? [];
            const updated = hasReacted
              ? reactions.filter(
                  (r) => !(r.user_id === userId && r.emoji === emoji),
                )
              : [
                  ...reactions,
                  {
                    message_id: messageId,
                    user_id: userId,
                    emoji,
                    created_at: new Date().toISOString(),
                  } satisfies MessageReaction,
                ];
            return { ...m, reactions: updated };
          }),
        );
        return { ...data, pages: newPages };
      });

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(messagesKey(hangoutId), ctx.prev);
      }
      toast.error('Could not update reaction. Try again.');
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: messagesKey(hangoutId) });
    },
  });
}
