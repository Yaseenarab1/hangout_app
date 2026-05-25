import { supabase } from '@/services/supabase/client';
import type {
  TimePoll,
  TimePollWithSlots,
  TimePollSlot,
  TimePollSlotResponse,
  SlotResponse,
  OpenTimePollSummary,
  CreateTimePollInput,
} from '../types';

export async function getTimePollByHangout(hangoutId: string): Promise<TimePollWithSlots | null> {
  const { data: poll, error: pollError } = await (supabase as any)
    .from('time_polls')
    .select('*')
    .eq('hangout_id', hangoutId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pollError) throw pollError;
  if (!poll) return null;

  const { data: rawSlots, error: slotsError } = await (supabase as any)
    .from('time_poll_slots')
    .select('*, responses:time_poll_responses(*, profile:profiles(full_name, avatar_url))')
    .eq('time_poll_id', poll.id)
    .order('starts_at', { ascending: true });

  if (slotsError) throw slotsError;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myUserId = user?.id ?? '';

  const slots: TimePollSlot[] = (rawSlots ?? []).map((s: any) => {
    const responses: TimePollSlotResponse[] = s.responses ?? [];
    const myResp = responses.find((r) => r.user_id === myUserId)?.response as
      | SlotResponse
      | undefined;
    return {
      id: s.id,
      time_poll_id: s.time_poll_id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      responses,
      myResponse: myResp ?? null,
      yesCount: responses.filter((r) => r.response === 'yes').length,
      maybeCount: responses.filter((r) => r.response === 'maybe').length,
      noCount: responses.filter((r) => r.response === 'no').length,
    };
  });

  return { ...(poll as TimePoll), slots };
}

export async function getOpenTimePollsForUser(): Promise<OpenTimePollSummary[]> {
  const { data, error } = await (supabase as any)
    .from('time_polls')
    .select('*, hangout:hangouts(id, title, cover_url)')
    .is('closed_at', null)
    .not('hangout_id', 'is', null)
    .order('vote_deadline', { ascending: true });

  if (error) throw error;
  return (data ?? []) as OpenTimePollSummary[];
}

export async function createTimePoll(input: CreateTimePollInput): Promise<TimePollWithSlots> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: poll, error: pollError } = await (supabase as any)
    .from('time_polls')
    .insert({
      hangout_id: input.hangoutId,
      created_by: user.id,
      title: input.title ?? 'When works?',
      vote_deadline: input.voteDeadline,
    })
    .select()
    .single();

  if (pollError) throw pollError;
  if (!poll) throw new Error('Time poll creation returned no row');

  const slotsPayload = input.slots.map((s) => ({
    time_poll_id: poll.id,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
  }));

  const { data: rawSlots, error: slotsError } = await (supabase as any)
    .from('time_poll_slots')
    .insert(slotsPayload)
    .select();

  if (slotsError) throw slotsError;

  const slots: TimePollSlot[] = (rawSlots ?? []).map((s: any) => ({
    id: s.id,
    time_poll_id: s.time_poll_id,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    responses: [],
    myResponse: null,
    yesCount: 0,
    maybeCount: 0,
    noCount: 0,
  }));

  return { ...(poll as TimePoll), slots };
}

export async function voteOnSlot(slotId: string, response: SlotResponse): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await (supabase as any)
    .from('time_poll_responses')
    .upsert({ slot_id: slotId, user_id: user.id, response }, { onConflict: 'slot_id,user_id' });

  if (error) throw error;
}

export async function closeTimePoll(pollId: string, winningSlotId?: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('time_polls')
    .update({
      closed_at: new Date().toISOString(),
      winning_slot_id: winningSlotId ?? null,
    })
    .eq('id', pollId);

  if (error) throw error;
}
