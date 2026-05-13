import { proportionalSplit } from './proportional-split';

export type ParticipantId = string; // uuid or 'guest:<uuid>'

export type ItemAssignment = {
  /** Amount in cents for this item */
  amountCents: number;
  /** Map of participantId → weight (1.0 = equal share) */
  assignees: Map<ParticipantId, number>;
};

export type ItemizedBillInput = {
  items: ItemAssignment[];
  taxCents: number;
  tipCents: number;
};

export type ShareTotals = Map<ParticipantId, number>;

/**
 * Given an itemized bill (items with assignments, tax, tip), compute each
 * participant's total owed in cents. Tax and tip are split proportionally
 * based on each person's item subtotal.
 *
 * Returns a Map of participantId → total cents owed.
 * Guarantees: sum of all values === sum(items) + taxCents + tipCents
 */
export function computeItemShares(input: ItemizedBillInput): ShareTotals {
  const { items, taxCents, tipCents } = input;

  // Step 1: compute each person's item subtotal
  const subtotals = new Map<ParticipantId, number>();

  for (const item of items) {
    const totalWeight = Array.from(item.assignees.values()).reduce((a, b) => a + b, 0);
    if (totalWeight === 0 || item.assignees.size === 0) continue;

    // Distribute item amount proportionally by weight using largest-remainder
    const itemSubtotals = new Map<ParticipantId, number>();
    for (const [id, w] of item.assignees) {
      itemSubtotals.set(id, w);
    }
    const shares = proportionalSplit(item.amountCents, itemSubtotals);
    for (const [id, cents] of shares) {
      subtotals.set(id, (subtotals.get(id) ?? 0) + cents);
    }
  }

  // Step 2: distribute tax proportionally to item subtotals
  const taxShares = proportionalSplit(taxCents, subtotals);

  // Step 3: distribute tip proportionally to item subtotals
  const tipShares = proportionalSplit(tipCents, subtotals);

  // Step 4: sum everything per person
  const totals = new Map<ParticipantId, number>();
  for (const [id, sub] of subtotals) {
    totals.set(
      id,
      sub + (taxShares.get(id) ?? 0) + (tipShares.get(id) ?? 0),
    );
  }

  return totals;
}
