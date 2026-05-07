import { useQuery } from '@tanstack/react-query';
import { fetchHangoutBalances } from '../services/bills.service';
import { simplifyDebts } from '../utils/simplify';
import type { SimplifiedDebt, UserBalance } from '../types';

export function useSimplifiedDebts(hangoutId: string, profiles: Map<string, { id: string; display_name: string; avatar_url: string | null }>) {
  return useQuery({
    queryKey: ['simplified-debts', hangoutId],
    queryFn: async (): Promise<SimplifiedDebt[]> => {
      const balances = await fetchHangoutBalances(hangoutId);
      return simplifyDebts(balances, profiles);
    },
    staleTime: 15_000,
  });
}
