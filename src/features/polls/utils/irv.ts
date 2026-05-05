/**
 * Instant-runoff voting tally.
 *
 * Algorithm:
 *   1. Each voter has a ballot — an ordered list of options they ranked.
 *   2. Initial round: each ballot's first-choice gets that voter's weight.
 *   3. If any option has > 50% of total weight, it wins.
 *   4. Otherwise: eliminate the option with the LOWEST score.
 *      - For each ballot whose top remaining choice was eliminated,
 *        their vote goes to their NEXT remaining choice.
 *   5. Repeat from step 3.
 *   6. If we get down to 1 option, it wins.
 *   7. If two options tie at the bottom, eliminate by stable order
 *      (the option created first stays — deterministic).
 *
 * Returns the round-by-round breakdown so the UI can show the full story.
 */

export type IRVBallot = {
  voterId: string;
  weight: number;
  /** Option IDs in rank order (index 0 = first choice). */
  rankedOptionIds: string[];
};

export type IRVRound = {
  round: number;
  /** option_id → weighted score in this round. */
  scores: Record<string, number>;
  /** Total weight in play this round (excludes exhausted ballots). */
  totalWeight: number;
  /** Option eliminated in this round (if any). */
  eliminated: string | null;
  /** Winner if found in this round. */
  winner: string | null;
};

export type IRVResult = {
  /** Winning option_id, or null if no winner could be determined. */
  winnerId: string | null;
  /** All rounds in order. */
  rounds: IRVRound[];
  /** Total ballots cast. */
  totalBallots: number;
};

/**
 * Run instant-runoff voting on a set of ballots.
 *
 * @param ballots The ranked ballots
 * @param allOptionIds All option IDs in stable creation order (for tie-breaking)
 */
export function runIRV(
  ballots: IRVBallot[],
  allOptionIds: string[],
): IRVResult {
  if (ballots.length === 0 || allOptionIds.length === 0) {
    return { winnerId: null, rounds: [], totalBallots: 0 };
  }

  // Single option: it wins.
  if (allOptionIds.length === 1) {
    return {
      winnerId: allOptionIds[0],
      rounds: [
        {
          round: 1,
          scores: { [allOptionIds[0]]: ballots.reduce((s, b) => s + b.weight, 0) },
          totalWeight: ballots.reduce((s, b) => s + b.weight, 0),
          eliminated: null,
          winner: allOptionIds[0],
        },
      ],
      totalBallots: ballots.length,
    };
  }

  const eliminated = new Set<string>();
  const rounds: IRVRound[] = [];
  let roundNum = 1;

  // Cap iterations as a safety belt.
  const maxRounds = allOptionIds.length;

  while (roundNum <= maxRounds) {
    // Active options this round.
    const active = allOptionIds.filter((id) => !eliminated.has(id));
    if (active.length === 0) break;

    // Tally each ballot's top remaining choice.
    const scores: Record<string, number> = {};
    for (const id of active) scores[id] = 0;

    let totalWeight = 0;
    for (const ballot of ballots) {
      const topRemaining = ballot.rankedOptionIds.find(
        (id) => !eliminated.has(id),
      );
      if (topRemaining) {
        scores[topRemaining] = (scores[topRemaining] ?? 0) + ballot.weight;
        totalWeight += ballot.weight;
      }
      // If their entire ballot is exhausted, they don't count this round.
    }

    // Check for majority winner.
    const majorityThreshold = totalWeight / 2;
    const sortedDesc = [...active].sort((a, b) => scores[b] - scores[a]);
    const topId = sortedDesc[0];
    const topScore = scores[topId];

    if (active.length === 1) {
      // Last one standing.
      rounds.push({
        round: roundNum,
        scores: { ...scores },
        totalWeight,
        eliminated: null,
        winner: topId,
      });
      return { winnerId: topId, rounds, totalBallots: ballots.length };
    }

    if (topScore > majorityThreshold) {
      rounds.push({
        round: roundNum,
        scores: { ...scores },
        totalWeight,
        eliminated: null,
        winner: topId,
      });
      return { winnerId: topId, rounds, totalBallots: ballots.length };
    }

    // No majority: eliminate the lowest. For ties, eliminate the option
    // that came LATER in allOptionIds (so earlier options are favored).
    const sortedAsc = [...active].sort((a, b) => {
      if (scores[a] !== scores[b]) return scores[a] - scores[b];
      // Tie: later in allOptionIds gets eliminated first
      return allOptionIds.indexOf(b) - allOptionIds.indexOf(a);
    });
    const toEliminate = sortedAsc[0];
    eliminated.add(toEliminate);

    rounds.push({
      round: roundNum,
      scores: { ...scores },
      totalWeight,
      eliminated: toEliminate,
      winner: null,
    });
    roundNum++;
  }

  // Shouldn't get here with valid input, but return null if we do.
  return {
    winnerId: rounds[rounds.length - 1]?.winner ?? null,
    rounds,
    totalBallots: ballots.length,
  };
}
