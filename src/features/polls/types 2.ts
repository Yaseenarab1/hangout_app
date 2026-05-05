/**
 * Poll types — updated for 2C.1 with ranked-choice support.
 */

export type PollKind = 'activity' | 'cuisine' | 'restaurant';
export type PollMode = 'simple_vote' | 'suggest_then_vote';
export type PollPhase = 'suggesting' | 'voting' | 'closed';
export type VotingMethod = 'simple' | 'ranked';

export type Poll = {
  id: string;
  hangout_id: string;
  created_by: string;
  kind: PollKind;
  mode: PollMode;
  voting_method: VotingMethod;
  phase: PollPhase;
  title: string;
  suggest_deadline: string | null;
  vote_deadline: string;
  winning_option_id: string | null;
  created_at: string;
  closed_at: string | null;
};

export type PollOption = {
  id: string;
  poll_id: string;
  added_by: string;
  label: string;
  google_place_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Simple-vote ballot row (existing votes table). */
export type Vote = {
  id: string;
  poll_id: string;
  option_id: string;
  voter_id: string;
  weight: number;
  created_at: string;
};

/** Ranked-vote ballot row. */
export type RankedVote = {
  id: string;
  poll_id: string;
  voter_id: string;
  option_id: string;
  rank: number;
  weight: number;
  created_at: string;
};

/**
 * The unified UI shape for a poll, regardless of voting method. Built by
 * combining poll, options, and either votes or ranked_votes.
 */
export type PollWithOptions = Poll & {
  options: (PollOption & {
    /**
     * For simple polls: count of votes.
     * For ranked polls: weighted count of FIRST-choice votes (initial round).
     */
    voteCount: number;
    /**
     * For simple: sum of weights.
     * For ranked: same as voteCount (sum of weights of first-choice voters).
     */
    weightedScore: number;
    /** Whether the current user voted for / ranked this option. */
    isMyVote: boolean;
    /** For ranked polls: this user's rank for this option (1-based, null if not ranked). */
    myRank: number | null;
  })[];
  /** Total ballots cast (distinct voters). */
  totalVotes: number;
  /** For simple: my vote row. For ranked: null (use myRanks instead). */
  myVote: Vote | null;
  /** For ranked: array of {optionId, rank} for the current user. */
  myRanks: Array<{ optionId: string; rank: number }>;
};

export type ActivityCatalogItem = {
  id: string;
  label: string;
  emoji: string;
  category: 'social' | 'active' | 'chill' | 'culture' | 'food_adjacent' | 'outdoors';
};
