export type ConversationParticipant = {
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  last_read_at: string | null;
  profile?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    username: string;
  };
};

export type ConvLastMessage = {
  id: string;
  conversation_id: string;
  body: string;
  sender_id: string;
  created_at: string;
  deleted_at: string | null;
};

export type Conversation = {
  id: string;
  type: 'dm' | 'group';
  name: string | null;
  created_by: string | null;
  last_message_at: string | null;
  created_at: string;
  participants: ConversationParticipant[];
  last_message?: ConvLastMessage;
};

export type ConvMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  sender?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  reply_to?: Pick<ConvMessage, 'id' | 'body' | 'deleted_at' | 'sender'>;
  pending?: boolean;
  failed?: boolean;
};

export const CONV_PAGE_SIZE = 50;
