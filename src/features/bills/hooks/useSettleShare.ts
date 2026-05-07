import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settleShare } from '../services/bills.service';
import { billsKey } from './useBills';

export function useSettleShare(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId, note }: { shareId: string; note?: string }) =>
      settleShare(shareId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billsKey(hangoutId) });
      qc.invalidateQueries({ queryKey: ['user-balance', hangoutId] });
      qc.invalidateQueries({ queryKey: ['simplified-debts', hangoutId] });
    },
  });
}
