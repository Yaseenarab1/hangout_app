import type { SimplifiedDebt, UserBalance } from '../types';

type NetBalance = { user_id: string; net_cents: number };

/**
 * Greedy debt simplification.
 * Given net balances (positive = owed money, negative = owes money),
 * returns the minimum set of payments to settle all debts.
 */
export function simplifyDebts(
  balances: UserBalance[],
  profiles: Map<string, { id: string; display_name: string; avatar_url: string | null }>,
): SimplifiedDebt[] {
  const nets: NetBalance[] = balances
    .map((b) => ({ user_id: b.user_id, net_cents: b.net_cents }))
    .filter((b) => b.net_cents !== 0);

  const creditors = nets.filter((b) => b.net_cents > 0).sort((a, b) => b.net_cents - a.net_cents);
  const debtors = nets.filter((b) => b.net_cents < 0).sort((a, b) => a.net_cents - b.net_cents);

  const result: SimplifiedDebt[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const amount = Math.min(creditor.net_cents, -debtor.net_cents);

    if (amount > 0) {
      result.push({
        from_user_id: debtor.user_id,
        to_user_id: creditor.user_id,
        amount_cents: amount,
        from_user: profiles.get(debtor.user_id),
        to_user: profiles.get(creditor.user_id),
      });
    }

    creditor.net_cents -= amount;
    debtor.net_cents += amount;

    if (creditor.net_cents === 0) ci++;
    if (debtor.net_cents === 0) di++;
  }

  return result;
}
