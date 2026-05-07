import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendConvMessage } from '../services/conversations.service';
import { convMessagesKey } from './useConvMessages';
import { conversationsKey } from './useConversations';
import { toast } from '@/stores/ui.store';
import type { ConvMessage } from '../types';

type SendParams = {
  convId: string;
  body: string;
  replyToId?: string;
  replyToMessage?: ConvMessage;
};

export function useSendConvMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ convId, body, replyToId }: SendParams) =>
      sendConvMessage({ convId, body, replyToId }),

    onMutate: async ({ convId, body, replyToId, replyToMessage }: SendParams) => {
      await qc.cancelQueries({ queryKey: convMessagesKey(convId) });

      const optimisticId = `optimistic-${Date.now()}`;
      const optimistic: ConvMessage = {
        id: optimisticId,
        conversation_id: convId,
        sender_id: '',
        body,
        reply_to_id: replyToId ?? null,
        reply_to: replyToMessage
          ? {
              id: replyToMessage.id,
              body: replyToMessage.body,
              deleted_at: replyToMessage.deleted_at,
              sender: replyToMessage.sender,
            }
          : undefined,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        pending: true,
      };

      qc.setQueryData<any>(convMessagesKey(convId), (prev: any) => {
        if (!prev) return prev;
        const newPages = [
          [optimistic, ...(prev.pages[0] ?? [])],
          ...prev.pages.slice(1),
        ];
        return { ...prev, pages: newPages };
      });

      return { optimisticId, convId };
    },

    onSuccess: (real, { convId }, ctx) => {
      qc.setQueryData<any>(convMessagesKey(convId), (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page: ConvMessage[]) => {
            // Remove any realtime-inserted copy before swapping optimistic
            const deduped = page.filter((m) => m.id !== real.id);
            return deduped.map((m) =>
              m.id === ctx?.optimisticId ? { ...real, pending: false } : m,
            );
          }),
        };
      });
    },

    onSettled: (_d, _e, { convId }) => {
      qc.invalidateQueries({ queryKey: convMessagesKey(convId) });
      qc.invalidateQueries({ queryKey: conversationsKey });
    },

    onError: (_err, { convId }, ctx) => {
      qc.setQueryData<any>(convMessagesKey(convId), (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: prev.pages.map((page: ConvMessage[]) =>
            page.map((m) =>
              m.id === ctx?.optimisticId
                ? { ...m, pending: false, failed: true }
                : m,
            ),
          ),
        };
      });
      toast.error('Failed to send. Tap to retry.');
    },
  });
}
