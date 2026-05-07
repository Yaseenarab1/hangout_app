import { useQuery } from '@tanstack/react-query';
import { fetchUserBalance } from '../services/bills.service';
import { useSession } from '@/features/auth';

export function useUserBalance(hangoutId: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['user-balance', hangoutId, user?.id],
    queryFn: () => fetchUserBalance(hangoutId, user!.id),
    enabled: !!user,
    staleTime: 15_000,
  });
}
