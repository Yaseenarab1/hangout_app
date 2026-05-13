import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/services/supabase/client';
import { fetchMyBills } from '../services/bills.service';
import { useSession } from '@/features/auth';

export const myBillsKey = () => ['my-bills'];

export function useMyBills() {
  const { user } = useSession();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: myBillsKey(),
    queryFn: fetchMyBills,
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('my-bills-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills', filter: `created_by=eq.${user.id}` },
        () => { qc.invalidateQueries({ queryKey: myBillsKey() }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  return query;
}
