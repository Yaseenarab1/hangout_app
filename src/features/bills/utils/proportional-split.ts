/**
 * Distribute a tax or tip amount proportionally across subtotals.
 * Uses largest-remainder method so cents always add up exactly.
 *
 * @param totalCents   The tax or tip amount to distribute (e.g. 684 for $6.84)
 * @param subtotals    Map of participantId → their item subtotal in cents
 * @returns            Map of participantId → their share of totalCents
 */
export function proportionalSplit(
  totalCents: number,
  subtotals: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>();

  if (totalCents === 0) {
    for (const [id] of subtotals) result.set(id, 0);
    return result;
  }

  const grandTotal = Array.from(subtotals.values()).reduce((a, b) => a + b, 0);

  if (grandTotal === 0) {
    // All items are $0 — split equally
    const n = subtotals.size;
    if (n === 0) return result;
    const base = Math.floor(totalCents / n);
    const remainder = totalCents % n;
    let idx = 0;
    for (const [id] of subtotals) {
      result.set(id, base + (idx < remainder ? 1 : 0));
      idx++;
    }
    return result;
  }

  // Compute exact (fractional) shares and floor them
  const entries = Array.from(subtotals.entries());
  const raw = entries.map(([, sub]) => (totalCents * sub) / grandTotal);
  const floored = raw.map(Math.floor);
  const distributed = floored.reduce((a, b) => a + b, 0);
  const remainder = totalCents - distributed;

  // Compute fractional parts for largest-remainder method
  const fractions = raw.map((r, i) => ({ id: entries[i]![0], frac: r - floored[i]! }));
  fractions.sort((a, b) => b.frac - a.frac); // descending

  const shares = new Map(entries.map(([id], i) => [id, floored[i]!]));
  for (let i = 0; i < remainder; i++) {
    const { id } = fractions[i]!;
    shares.set(id, shares.get(id)! + 1);
  }

  return shares;
}
