import { runIRV, type IRVBallot } from '../irv';

function ballot(voterId: string, rankedOptionIds: string[], weight = 1): IRVBallot {
  return { voterId, weight, rankedOptionIds };
}

describe('runIRV', () => {
  it('returns no winner for empty ballots', () => {
    expect(runIRV([], ['A', 'B'])).toMatchObject({ winnerId: null, totalBallots: 0 });
  });

  it('a single option wins outright', () => {
    const result = runIRV([ballot('u1', ['A']), ballot('u2', ['A'])], ['A']);
    expect(result.winnerId).toBe('A');
  });

  it('declares a first-round majority winner', () => {
    const result = runIRV(
      [ballot('u1', ['A']), ballot('u2', ['A']), ballot('u3', ['B'])],
      ['A', 'B'],
    );
    expect(result.winnerId).toBe('A');
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]).toMatchObject({ winner: 'A', eliminated: null });
  });

  it('eliminates the lowest and redistributes to the next choice', () => {
    // A:2, B:2, C:1 first-choice. C is eliminated; C's voter's 2nd choice is A,
    // pushing A to a majority.
    const result = runIRV(
      [
        ballot('u1', ['A']),
        ballot('u2', ['A']),
        ballot('u3', ['B']),
        ballot('u4', ['B']),
        ballot('u5', ['C', 'A']),
      ],
      ['A', 'B', 'C'],
    );
    expect(result.winnerId).toBe('A');
    expect(result.rounds[0]).toMatchObject({ eliminated: 'C', winner: null });
    expect(result.rounds[result.rounds.length - 1]!.winner).toBe('A');
  });

  it('applies ballot weights', () => {
    // B carries weight 3 vs A's 1 → B wins despite fewer ballots.
    const result = runIRV([ballot('u1', ['A'], 1), ballot('u2', ['B'], 3)], ['A', 'B']);
    expect(result.winnerId).toBe('B');
    expect(result.rounds[0]!.scores).toMatchObject({ A: 1, B: 3 });
  });

  it('breaks elimination ties by eliminating the later option first', () => {
    // All tied at 1. Ties eliminate the option later in allOptionIds, so C then
    // B are removed, leaving A. Exhausted ballots drop out of totalWeight.
    const result = runIRV(
      [ballot('u1', ['A']), ballot('u2', ['B']), ballot('u3', ['C'])],
      ['A', 'B', 'C'],
    );
    expect(result.winnerId).toBe('A');
    expect(result.rounds[0]).toMatchObject({ eliminated: 'C' });
    expect(result.rounds[1]).toMatchObject({ eliminated: 'B' });
  });
});
