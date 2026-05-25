import { useQuery } from '@tanstack/react-query';
import { fetchCrossHangoutBalances } from '../services/bills.service';
import { useSession } from '@/features/auth';

export const crossBalancesKey = () => ['cross-hangout-balances'];

export function useCrossHangoutBalances() {
  const { user } = useSession();
  return useQuery({
    queryKey: crossBalancesKey(),
    queryFn: fetchCrossHangoutBalances,
    enabled: !!user,
    staleTime: 30_000,
  });
}
