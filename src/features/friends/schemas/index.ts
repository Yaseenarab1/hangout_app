import { z } from 'zod';

export const friendSearchSchema = z.object({
  query: z.string().trim().min(2, 'Type at least 2 characters.').max(40),
});

export const sendFriendRequestSchema = z.object({
  recipientId: z.string().uuid(),
  message: z.string().trim().max(200).optional(),
});

export type FriendSearchInput = z.infer<typeof friendSearchSchema>;
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
