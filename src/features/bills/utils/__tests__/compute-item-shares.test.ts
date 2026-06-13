import { computeItemShares, ItemAssignment } from '../compute-item-shares';

function shares(got: Map<string, number>): Record<string, number> {
  return Object.fromEntries(got);
}

function total(got: Map<string, number>): number {
  return Array.from(got.values()).reduce((a, b) => a + b, 0);
}

describe('computeItemShares', () => {
  // Plan's worked example — $76 items, $6.84 tax, $11.40 tip, 4 people.
  // Item subtotals (cents): Mike 1000, Sarah 1800, You 1100, Tom 3700.
  // Tax + tip are distributed proportionally to those subtotals.
  it('matches the plan example (4 people, $76 + $6.84 tax + $11.40 tip)', () => {
    const items: ItemAssignment[] = [
      { amountCents: 1400, assignees: new Map([['Mike', 1], ['Sarah', 1]]) },
      { amountCents: 1600, assignees: new Map([['You', 1], ['Sarah', 1]]) },
      { amountCents: 1200, assignees: new Map([['Mike', 1], ['Sarah', 1], ['You', 1], ['Tom', 1]]) },
      { amountCents: 3400, assignees: new Map([['Tom', 1]]) },
    ];
    const result = computeItemShares({ items, taxCents: 684, tipCents: 1140 });
    expect(shares(result)).toEqual({ Mike: 1240, Sarah: 2232, You: 1364, Tom: 4588 });
    expect(total(result)).toBe(7600 + 684 + 1140);
  });

  it('charges a single person for everything', () => {
    const items: ItemAssignment[] = [{ amountCents: 5000, assignees: new Map([['Alice', 1]]) }];
    expect(shares(computeItemShares({ items, taxCents: 450, tipCents: 750 }))).toEqual({
      Alice: 6200,
    });
  });

  it('handles no tax or tip', () => {
    const items: ItemAssignment[] = [{ amountCents: 2000, assignees: new Map([['A', 1], ['B', 1]]) }];
    expect(shares(computeItemShares({ items, taxCents: 0, tipCents: 0 }))).toEqual({
      A: 1000,
      B: 1000,
    });
  });

  it('allows a negative (discount) item', () => {
    const items: ItemAssignment[] = [
      { amountCents: 800, assignees: new Map([['Alice', 1]]) },
      { amountCents: -200, assignees: new Map([['Alice', 1]]) },
    ];
    // Net subtotal 600 + proportional tax 60 = 660.
    expect(shares(computeItemShares({ items, taxCents: 60, tipCents: 0 }))).toEqual({ Alice: 660 });
  });

  it('splits an item by custom weights (2:1)', () => {
    const items: ItemAssignment[] = [
      { amountCents: 3000, assignees: new Map([['Alice', 2], ['Bob', 1]]) },
    ];
    expect(shares(computeItemShares({ items, taxCents: 300, tipCents: 0 }))).toEqual({
      Alice: 2200,
      Bob: 1100,
    });
  });

  it('never loses a cent — shares sum to the grand total', () => {
    const items: ItemAssignment[] = [
      { amountCents: 1499, assignees: new Map([['A', 1], ['B', 1], ['C', 1]]) },
      { amountCents: 2501, assignees: new Map([['B', 1], ['C', 1]]) },
    ];
    const result = computeItemShares({ items, taxCents: 337, tipCents: 563 });
    expect(total(result)).toBe(1499 + 2501 + 337 + 563);
  });
});
