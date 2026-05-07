export type MessageReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type Message = {
  id: string;
  hangout_id: string;
  sender_id: string;
  body: string;
  reply_to_message_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  // Joined fields (populated by service)
  sender?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  reply_to?: Pick<Message, 'id' | 'body' | 'deleted_at' | 'sender'>;
  reactions?: MessageReaction[];
  // Optimistic UI state
  pending?: boolean;
  failed?: boolean;
};

export type MessageReadState = {
  hangout_id: string;
  user_id: string;
  last_read_message_id: string | null;
  last_read_at: string;
};

export const MESSAGE_PAGE_SIZE = 50;
