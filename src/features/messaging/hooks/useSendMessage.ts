import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '../services/messages.service';
import { messagesKey } from './useMessages';
import { toast } from '@/stores/ui.store';
import type { Message } from '../types';

type SendParams = {
  hangoutId: string;
  body: string;
  replyToMessageId?: string;
};

export function useSendMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: sendMessage,

    onMutate: async ({ hangoutId, body, replyToMessageId }: SendParams) => {
      await qc.cancelQueries({ queryKey: messagesKey(hangoutId) });

      const optimisticId = `optimistic-${Date.now()}`;
      const optimistic: Message = {
        id: optimisticId,
        hangout_id: hangoutId,
        sender_id: '',
        body,
        reply_to_message_id: replyToMessageId ?? null,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        reactions: [],
        pending: true,
      };

      qc.setQueryData<any>(messagesKey(hangoutId), (prev: any) => {
        if (!prev) return prev;
        const newPages = [[optimistic, ...prev.pages[0]], ...prev.pages.slice(1)];
        return { ...prev, pages: newPages };
      });

      return { optimisticId, hangoutId };
    },

    onSuccess: (realMessage, { hangoutId }, ctx) => {
      // Swap optimistic placeholder with the real server row
      qc.setQueryData<any>(messagesKey(hangoutId), (prev: any) => {
        if (!prev) return prev;
        const newPages = prev.pages.map((page: Message[]) =>
          page.map((m) =>
            m.id === ctx?.optimisticId ? { ...realMessage, pending: false } : m,
          ),
        );
        return { ...prev, pages: newPages };
      });
    },

    onError: (_err, { hangoutId }, ctx) => {
      // Mark the optimistic message as failed instead of removing it
      qc.setQueryData<any>(messagesKey(hangoutId), (prev: any) => {
        if (!prev) return prev;
        const newPages = prev.pages.map((page: Message[]) =>
          page.map((m) =>
            m.id === ctx?.optimisticId
              ? { ...m, pending: false, failed: true }
              : m,
          ),
        );
        return { ...prev, pages: newPages };
      });
      toast.error('Failed to send. Tap to retry.');
    },
  });
}
