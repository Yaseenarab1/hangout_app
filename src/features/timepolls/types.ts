export type SlotResponse = 'yes' | 'maybe' | 'no';

export type TimePollSlotResponse = {
  slot_id: string;
  user_id: string;
  response: SlotResponse;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type TimePollSlot = {
  id: string;
  time_poll_id: string;
  starts_at: string;
  ends_at: string;
  responses: TimePollSlotResponse[];
  myResponse: SlotResponse | null;
  yesCount: number;
  maybeCount: number;
  noCount: number;
};

export type TimePoll = {
  id: string;
  hangout_id: string | null;
  created_by: string;
  title: string;
  vote_deadline: string;
  winning_slot_id: string | null;
  closed_at: string | null;
  created_at: string;
};

export type TimePollWithSlots = TimePoll & {
  slots: TimePollSlot[];
};

export type OpenTimePollSummary = TimePoll & {
  hangout: {
    id: string;
    title: string;
    cover_url: string | null;
  } | null;
};

export type CreateTimePollInput = {
  hangoutId: string;
  title?: string;
  voteDeadline: string;
  slots: Array<{ startsAt: string; endsAt: string }>;
};

export type VoteOnSlotInput = {
  slotId: string;
  response: SlotResponse;
  userId: string;
};
