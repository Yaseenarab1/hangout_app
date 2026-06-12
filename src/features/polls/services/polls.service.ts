import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import { createHangout } from '@/features/hangouts/services/hangouts.service';
import { runIRV, type IRVBallot } from '../utils/irv';
import type {
  CreateActivityPollInput,
  CreateActivityHangoutInput,
  VoteInput,
  AddOptionInput,
  CastRankedVoteInput,
} from '../schemas';
import type {
  Poll,
  PollOption,
  PollWithOptions,
  Vote,
  RankedVote,
} from '../types';

/**
 * Polls service — supports both 'simple' and 'ranked' voting methods,
 * and includes batch option add for AddOptionSheet.
 */

export async function createActivityHangout(
  input: CreateActivityHangoutInput,
): Promise<{ hangoutId: string; pollId: string | null }> {
  const hangout = await createHangout({
    title: input.hangout.title,
    description: input.hangout.description,
    startTime: input.hangout.startTime,
    locationName: input.hangout.locationName,
    locationAddress: input.hangout.locationAddress,
    inviteUserIds: input.hangout.inviteUserIds,
  });

  if (!input.poll) return { hangoutId: hangout.id, pollId: null };

  const poll = await createActivityPoll(hangout.id, input.poll);
  return { hangoutId: hangout.id, pollId: poll.id };
}

export async function createActivityPoll(
  hangoutId: string,
  input: CreateActivityPollInput,
): Promise<Poll> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const phase = input.mode === 'suggest_then_vote' ? 'suggesting' : 'voting';
  const title = input.title ?? 'What should we do?';

  const { data: poll, error } = await supabase
    .from(TABLES.polls)
    .insert({
      hangout_id: hangoutId,
      created_by: auth.user.id,
      kind: 'activity' as const,
      mode: input.mode,
      voting_method: input.votingMethod,
      phase,
      title,
      suggest_deadline: input.suggestDeadline ?? null,
      vote_deadline: input.voteDeadline,
    } as any)
    .select()
    .single();

  if (error) throw error;
  if (!poll) throw new Error('Poll creation returned no row');

  if (input.options.length > 0) {
    const optionRows = input.options.map((opt) => ({
      poll_id: poll.id,
      added_by: auth.user!.id,
      label: opt.label,
      metadata: {
        emoji: opt.emoji ?? null,
        catalogId: opt.catalogId ?? null,
      },
    }));
    const { error: optErr } = await supabase
      .from(TABLES.poll_options)
      .insert(optionRows);
    if (optErr) throw optErr;
  }

  return poll as Poll;
}

export async function createPollOnHangout(input: {
  hangoutId: string;
  kind: 'activity' | 'cuisine' | 'restaurant';
  votingMethod: 'simple' | 'ranked';
  voteDeadline: string;
  options: Array<{ label: string; metadata?: Record<string, unknown> }>;
  title?: string;
}): Promise<Poll> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const titles = {
    activity: 'What should we do?',
    cuisine: 'What kind of food?',
    restaurant: 'Which restaurant?',
  };

  const { data: poll, error } = await supabase
    .from(TABLES.polls)
    .insert({
      hangout_id: input.hangoutId,
      created_by: auth.user.id,
      kind: input.kind,
      mode: 'simple_vote',
      voting_method: input.votingMethod,
      phase: 'voting',
      title: input.title ?? titles[input.kind],
      vote_deadline: input.voteDeadline,
    } as any)
    .select()
    .single();

  if (error) throw error;
  if (!poll) throw new Error('Poll creation returned no row');

  if (input.options.length > 0) {
    const rows = input.options.map((o) => ({
      poll_id: (poll as Poll).id,
      added_by: auth.user!.id,
      label: o.label,
      metadata: o.metadata ?? {},
    }));
    const { error: optErr } = await supabase
      .from(TABLES.poll_options)
      .insert(rows as any);
    if (optErr) throw optErr;
  }

  return poll as Poll;
}

export async function listPollsByHangout(hangoutId: string): Promise<Poll[]> {
  const { data, error } = await supabase
    .from(TABLES.polls)
    .select('*')
    .eq('hangout_id', hangoutId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Poll[];
}

export async function getPollWithDetails(
  pollId: string,
): Promise<PollWithOptions | null> {
  const { data: auth } = await supabase.auth.getUser();
  const myUserId = auth.user?.id;

  const { data: poll, error } = await supabase
    .from(TABLES.polls)
    .select('*')
    .eq('id', pollId)
    .maybeSingle();

  if (error) throw error;
  if (!poll) return null;

  const { data: options, error: optErr } = await supabase
    .from(TABLES.poll_options)
    .select('*')
    .eq('poll_id', pollId)
    .order('created_at', { ascending: true });

  if (optErr) throw optErr;

  const optionsList = (options ?? []) as PollOption[];

  if ((poll as Poll).voting_method === 'ranked') {
    return buildRankedPollDetail(poll as Poll, optionsList, myUserId);
  } else {
    return buildSimplePollDetail(poll as Poll, optionsList, myUserId);
  }
}

async function buildSimplePollDetail(
  poll: Poll,
  options: PollOption[],
  myUserId: string | undefined,
): Promise<PollWithOptions> {
  const { data: votes, error } = await supabase
    .from(TABLES.votes)
    .select('*')
    .eq('poll_id', poll.id);

  if (error) throw error;
  const votesList = (votes ?? []) as Vote[];

  const enriched = options.map((opt) => {
    const optionVotes = votesList.filter((v) => v.option_id === opt.id);
    const weightedScore = optionVotes.reduce((s, v) => s + Number(v.weight), 0);
    return {
      ...opt,
      voteCount: optionVotes.length,
      weightedScore,
      isMyVote: myUserId
        ? optionVotes.some((v) => v.voter_id === myUserId)
        : false,
      myRank: null,
    };
  });

  const myVote = myUserId
    ? votesList.find((v) => v.voter_id === myUserId) ?? null
    : null;

  return {
    ...poll,
    options: enriched,
    totalVotes: votesList.length,
    myVote,
    myRanks: [],
  };
}

async function buildRankedPollDetail(
  poll: Poll,
  options: PollOption[],
  myUserId: string | undefined,
): Promise<PollWithOptions> {
  const { data: rankedVotes, error } = await (supabase as any)
    .from('ranked_votes')
    .select('*')
    .eq('poll_id', poll.id);

  if (error) throw error;
  const rankedList = (rankedVotes ?? []) as RankedVote[];

  const voterIds = new Set(rankedList.map((r) => r.voter_id));

  const enriched = options.map((opt) => {
    const firstChoiceFor = rankedList.filter(
      (r) => r.option_id === opt.id && r.rank === 1,
    );
    const myVote = myUserId
      ? rankedList.find((r) => r.option_id === opt.id && r.voter_id === myUserId)
      : null;

    return {
      ...opt,
      voteCount: firstChoiceFor.length,
      weightedScore: firstChoiceFor.reduce((s, r) => s + Number(r.weight), 0),
      isMyVote: !!myVote,
      myRank: myVote?.rank ?? null,
    };
  });

  const myRanks = myUserId
    ? rankedList
        .filter((r) => r.voter_id === myUserId)
        .map((r) => ({ optionId: r.option_id, rank: r.rank }))
    : [];

  return {
    ...poll,
    options: enriched,
    totalVotes: voterIds.size,
    myVote: null,
    myRanks,
  };
}

export async function castVote(input: VoteInput): Promise<Vote> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data: poll, error: pollErr } = await supabase
    .from(TABLES.polls)
    .select('hangout_id')
    .eq('id', input.pollId)
    .maybeSingle();
  if (pollErr) throw pollErr;
  if (!poll) throw new Error('Poll not found');

  const { data: participant, error: pErr } = await supabase
    .from(TABLES.hangout_participants)
    .select('vote_weight')
    .eq('hangout_id', poll.hangout_id)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (pErr) throw pErr;
  const weight = participant?.vote_weight ?? 1.0;

  const { data, error } = await supabase
    .from(TABLES.votes)
    .upsert(
      {
        poll_id: input.pollId,
        option_id: input.optionId,
        voter_id: auth.user.id,
        weight,
      },
      { onConflict: 'poll_id,voter_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as Vote;
}

export async function unvote(pollId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from(TABLES.votes)
    .delete()
    .eq('poll_id', pollId)
    .eq('voter_id', auth.user.id);

  if (error) throw error;
}

export async function castRankedVote(input: CastRankedVoteInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data: poll, error: pollErr } = await supabase
    .from(TABLES.polls)
    .select('hangout_id')
    .eq('id', input.pollId)
    .maybeSingle();
  if (pollErr) throw pollErr;
  if (!poll) throw new Error('Poll not found');

  const { data: participant, error: pErr } = await supabase
    .from(TABLES.hangout_participants)
    .select('vote_weight')
    .eq('hangout_id', poll.hangout_id)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (pErr) throw pErr;
  const weight = participant?.vote_weight ?? 1.0;

  const { error: delErr } = await (supabase as any)
    .from('ranked_votes')
    .delete()
    .eq('poll_id', input.pollId)
    .eq('voter_id', auth.user.id);
  if (delErr) throw delErr;

  if (input.rankedOptionIds.length === 0) return;

  const rows = input.rankedOptionIds.map((optionId, idx) => ({
    poll_id: input.pollId,
    voter_id: auth.user!.id,
    option_id: optionId,
    rank: idx + 1,
    weight,
  }));

  const { error: insErr } = await (supabase as any).from('ranked_votes').insert(rows);
  if (insErr) throw insErr;
}

export async function clearRankedVote(pollId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await (supabase as any)
    .from('ranked_votes')
    .delete()
    .eq('poll_id', pollId)
    .eq('voter_id', auth.user.id);

  if (error) throw error;
}

export async function addOption(input: AddOptionInput): Promise<PollOption> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from(TABLES.poll_options)
    .insert({
      poll_id: input.pollId,
      added_by: auth.user.id,
      label: input.label,
      metadata: { emoji: input.emoji ?? null },
    })
    .select()
    .single();

  if (error) throw error;
  return data as PollOption;
}

/**
 * Add multiple options at once. Used by AddOptionSheet so users can pick
 * a batch of options from the catalog and add them all in one operation.
 */
export async function addOptionsBatch(input: {
  pollId: string;
  options: Array<{
    label: string;
    metadata?: Record<string, unknown>;
  }>;
}): Promise<PollOption[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  if (input.options.length === 0) return [];

  const rows = input.options.map((o) => ({
    poll_id: input.pollId,
    added_by: auth.user!.id,
    label: o.label,
    metadata: o.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from(TABLES.poll_options)
    .insert(rows as any)
    .select();

  if (error) throw error;
  return (data ?? []) as PollOption[];
}

export async function removeOption(optionId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.poll_options)
    .delete()
    .eq('id', optionId);
  if (error) throw error;
}

export async function startVoting(pollId: string): Promise<Poll> {
  const { data, error } = await supabase
    .from(TABLES.polls)
    .update({ phase: 'voting' })
    .eq('id', pollId)
    .select()
    .single();

  if (error) throw error;
  return data as Poll;
}

export async function closePoll(
  pollId: string,
  forcedWinnerOptionId?: string,
): Promise<{ poll: Poll; updatedLocation: boolean }> {
  let winnerId = forcedWinnerOptionId ?? null;
  let detailed: PollWithOptions | null = null;

  if (!winnerId) {
    detailed = await getPollWithDetails(pollId);
    if (!detailed) throw new Error('Poll not found');

    if (detailed.voting_method === 'ranked') {
      const { data: rankedRows } = await (supabase as any)
        .from('ranked_votes')
        .select('*')
        .eq('poll_id', pollId);

      const ballots = buildBallotsFromRows((rankedRows ?? []) as RankedVote[]);
      const optionIds = detailed.options.map((o) => o.id);
      const result = runIRV(ballots, optionIds);
      winnerId = result.winnerId;
    } else {
      if (detailed.totalVotes > 0) {
        const sorted = [...detailed.options].sort(
          (a, b) => b.weightedScore - a.weightedScore,
        );
        winnerId = sorted[0]?.id ?? null;
      }
    }
  } else {
    detailed = await getPollWithDetails(pollId);
  }

  const { data, error } = await supabase
    .from(TABLES.polls)
    .update({
      phase: 'closed',
      winning_option_id: winnerId,
      closed_at: new Date().toISOString(),
    })
    .eq('id', pollId)
    .select()
    .single();

  if (error) throw error;
  const poll = data as Poll;

  // Auto-update hangout location when a restaurant poll closes with a winner
  let updatedLocation = false;
  if (winnerId && detailed && detailed.hangout_id &&
      (detailed.kind === 'restaurant' || detailed.kind === 'activity')) {
    const winner = detailed.options.find((o) => o.id === winnerId);
    const meta = (winner?.metadata as { placeId?: string; address?: string; primaryType?: string } | null) ?? {};
    if (winner?.label) {
      const update: { primary_location_name: string; primary_location_address?: string } = {
        primary_location_name: winner.label,
      };
      if (meta.address) update.primary_location_address = meta.address;
      const { error: locErr } = await (supabase as any)
        .from(TABLES.hangouts)
        .update(update)
        .eq('id', detailed.hangout_id);
      if (!locErr) updatedLocation = true;
    }
  }

  return { poll, updatedLocation };
}

export async function reopenPoll(pollId: string): Promise<Poll> {
  const { data, error } = await supabase
    .from(TABLES.polls)
    .update({ phase: 'voting', winning_option_id: null, closed_at: null })
    .eq('id', pollId)
    .select()
    .single();
  if (error) throw error;
  return data as Poll;
}

export async function deletePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from(TABLES.polls).delete().eq('id', pollId);
  if (error) throw error;
}

function buildBallotsFromRows(rows: RankedVote[]): IRVBallot[] {
  const byVoter = new Map<string, RankedVote[]>();
  for (const r of rows) {
    const list = byVoter.get(r.voter_id) ?? [];
    list.push(r);
    byVoter.set(r.voter_id, list);
  }
  const ballots: IRVBallot[] = [];
  for (const [voterId, voterRows] of byVoter) {
    voterRows.sort((a, b) => a.rank - b.rank);
    ballots.push({
      voterId,
      weight: Number(voterRows[0]?.weight ?? 1),
      rankedOptionIds: voterRows.map((r) => r.option_id),
    });
  }
  return ballots;
}

export async function setParticipantVoteWeight(
  hangoutId: string,
  userId: string,
  weight: number,
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.hangout_participants)
    .update({ vote_weight: weight })
    .eq('hangout_id', hangoutId)
    .eq('user_id', userId);

  if (error) throw error;
}
