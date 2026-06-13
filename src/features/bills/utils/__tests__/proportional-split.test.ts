import { proportionalSplit } from '../proportional-split';

/** proportionalSplit returns a Map keyed by the same participant ids passed in. */
function shares(got: Map<string, number>): Record<string, number> {
  return Object.fromEntries(got);
}

describe('proportionalSplit', () => {
  it('splits tax evenly across equal subtotals', () => {
    expect(shares(proportionalSplit(600, new Map([['A', 4000], ['B', 4000]])))).toEqual({
      A: 300,
      B: 300,
    });
  });

  it('splits $6.84 tax in a 2:1 ratio', () => {
    expect(shares(proportionalSplit(684, new Map([['Mike', 4000], ['Sarah', 2000]])))).toEqual({
      Mike: 456,
      Sarah: 228,
    });
  });

  it('splits $11.40 tip 4 ways with equal subtotals', () => {
    expect(
      shares(proportionalSplit(1140, new Map([['A', 1000], ['B', 1000], ['C', 1000], ['D', 1000]]))),
    ).toEqual({ A: 285, B: 285, C: 285, D: 285 });
  });

  it('distributes remainder cents to the largest subtotal first ($0.07 / 3)', () => {
    expect(shares(proportionalSplit(7, new Map([['A', 100], ['B', 100], ['C', 100]])))).toEqual({
      A: 3,
      B: 2,
      C: 2,
    });
  });

  it('falls back to an even split when all subtotals are 0', () => {
    expect(shares(proportionalSplit(300, new Map([['A', 0], ['B', 0], ['C', 0]])))).toEqual({
      A: 100,
      B: 100,
      C: 100,
    });
  });

  it('gives everyone 0 when tax is 0', () => {
    expect(shares(proportionalSplit(0, new Map([['A', 5000], ['B', 3000]])))).toEqual({
      A: 0,
      B: 0,
    });
  });

  it('assigns the whole amount to a single participant', () => {
    expect(shares(proportionalSplit(684, new Map([['A', 7600]])))).toEqual({ A: 684 });
  });

  it('loses no cents on an uneven 3-way $6.84 tax', () => {
    expect(
      shares(proportionalSplit(684, new Map([['Mike', 4000], ['Sarah', 2000], ['Tom', 1600]]))),
    ).toEqual({ Mike: 360, Sarah: 180, Tom: 144 });
  });
});
