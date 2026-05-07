import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/services/supabase/client';
import { fetchBills } from '../services/bills.service';
import type { Bill } from '../types';

export const billsKey = (hangoutId: string) => ['bills', hangoutId];

export function useBills(hangoutId: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: billsKey(hangoutId),
    queryFn: () => fetchBills(hangoutId),
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`hangout:${hangoutId}:bills`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills', filter: `hangout_id=eq.${hangoutId}` },
        () => { qc.invalidateQueries({ queryKey: billsKey(hangoutId) }); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bill_shares' },
        () => { qc.invalidateQueries({ queryKey: billsKey(hangoutId) }); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hangoutId, qc]);

  return query;
}
