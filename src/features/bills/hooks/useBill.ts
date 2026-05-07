import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBill } from '../services/bills.service';

export const billKey = (billId: string) => ['bill', billId];

export function useBill(billId: string | null) {
  return useQuery({
    queryKey: billKey(billId ?? ''),
    queryFn: () => fetchBill(billId!),
    enabled: !!billId,
    staleTime: 30_000,
  });
}
