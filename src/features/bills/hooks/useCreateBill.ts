import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBill } from '../services/bills.service';
import { billsKey } from './useBills';
import type { CreateBillParams } from '../types';

export function useCreateBill(hangoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateBillParams) => createBill(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billsKey(hangoutId) });
      qc.invalidateQueries({ queryKey: ['user-balance', hangoutId] });
      qc.invalidateQueries({ queryKey: ['simplified-debts', hangoutId] });
    },
  });
}
