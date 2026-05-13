import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createItemizedBill } from '../services/bills.service';
import { billsKey } from './useBills';
import { myBillsKey } from './useMyBills';
import type { CreateItemizedBillParams } from '../types';

export function useCreateItemizedBill(hangoutId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateItemizedBillParams) => createItemizedBill(params),
    onSuccess: () => {
      if (hangoutId) {
        qc.invalidateQueries({ queryKey: billsKey(hangoutId) });
        qc.invalidateQueries({ queryKey: ['user-balance', hangoutId] });
        qc.invalidateQueries({ queryKey: ['simplified-debts', hangoutId] });
      }
      qc.invalidateQueries({ queryKey: myBillsKey() });
    },
  });
}
