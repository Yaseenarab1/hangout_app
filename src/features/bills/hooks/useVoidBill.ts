import { useMutation, useQueryClient } from '@tanstack/react-query';
import { voidBill } from '../services/bills.service';
import { billsKey } from './useBills';

export function useVoidBill(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ billId, reason }: { billId: string; reason?: string }) =>
      voidBill(billId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billsKey(hangoutId) });
      qc.invalidateQueries({ queryKey: ['user-balance', hangoutId] });
      qc.invalidateQueries({ queryKey: ['simplified-debts', hangoutId] });
    },
  });
}
