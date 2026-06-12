import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateItemizedBill } from '../services/bills.service';
import { billsKey } from './useBills';
import { myBillsKey } from './useMyBills';
import { billKey } from './useBill';
import type { CreateItemizedBillParams } from '../types';

export function useUpdateItemizedBill(hangoutId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ billId, params }: { billId: string; params: CreateItemizedBillParams }) =>
      updateItemizedBill(billId, params),
    onSuccess: (bill) => {
      qc.invalidateQueries({ queryKey: billKey(bill.id) });
      qc.invalidateQueries({ queryKey: myBillsKey() });
      if (hangoutId) {
        qc.invalidateQueries({ queryKey: billsKey(hangoutId) });
        qc.invalidateQueries({ queryKey: ['user-balance', hangoutId] });
        qc.invalidateQueries({ queryKey: ['simplified-debts', hangoutId] });
      }
    },
  });
}
