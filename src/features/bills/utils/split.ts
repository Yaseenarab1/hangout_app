import type { ShareInput } from '../types';

type EqualConfig = { method: 'equal'; participants: Array<{ user_id: string }> };
type PercentConfig = { method: 'percent'; participants: Array<{ user_id: string; percent: number }> };
type ExactConfig = { method: 'exact'; participants: Array<{ user_id: string; amount_cents: number }> };
type SharesConfig = { method: 'shares'; participants: Array<{ user_id: string; weight: number }> };

export type SplitConfig = EqualConfig | PercentConfig | ExactConfig | SharesConfig;

function distributeWithRemainder(totalCents: number, n: number): number[] {
  const base = Math.floor(totalCents / n);
  const remainder = totalCents % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function computeShares(totalCents: number, config: SplitConfig): ShareInput[] {
  if (config.method === 'equal') {
    const amounts = distributeWithRemainder(totalCents, config.participants.length);
    return config.participants.map((p, i) => ({
      user_id: p.user_id,
      amount_cents: amounts[i]!,
      split_method: 'equal' as const,
    }));
  }

  if (config.method === 'percent') {
    const sorted = [...config.participants].sort((a, b) => b.percent - a.percent);
    const raw = sorted.map((p) => Math.floor((totalCents * p.percent) / 100));
    const sumRaw = raw.reduce((a, b) => a + b, 0);
    let remainder = totalCents - sumRaw;
    const amounts = raw.map((a) => {
      if (remainder > 0) { remainder--; return a + 1; }
      return a;
    });
    return sorted.map((p, i) => ({
      user_id: p.user_id,
      amount_cents: amounts[i]!,
      split_method: 'percent' as const,
      weight: p.percent,
    }));
  }

  if (config.method === 'exact') {
    return config.participants.map((p) => ({
      user_id: p.user_id,
      amount_cents: p.amount_cents,
      split_method: 'exact' as const,
    }));
  }

  // shares
  const totalWeight = config.participants.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) {
    return config.participants.map((p) => ({
      user_id: p.user_id,
      amount_cents: 0,
      split_method: 'shares' as const,
      weight: 0,
    }));
  }
  const sorted = [...config.participants].sort((a, b) => b.weight - a.weight);
  const raw = sorted.map((p) => Math.floor((totalCents * p.weight) / totalWeight));
  const sumRaw = raw.reduce((a, b) => a + b, 0);
  let remainder = totalCents - sumRaw;
  const amounts = raw.map((a) => {
    if (remainder > 0) { remainder--; return a + 1; }
    return a;
  });
  return sorted.map((p, i) => ({
    user_id: p.user_id,
    amount_cents: amounts[i]!,
    split_method: 'shares' as const,
    weight: p.weight,
  }));
}

export function validateShares(totalCents: number, shares: ShareInput[]): string | null {
  const sum = shares.reduce((s, sh) => s + sh.amount_cents, 0);
  if (sum !== totalCents) return `Shares sum to ${sum} but bill is ${totalCents}`;
  return null;
}

export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const c = abs % 100;
  const formatted = `$${dollars}.${c.toString().padStart(2, '0')}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

export function parseDollarsToCents(value: string): number | null {
  const n = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}
