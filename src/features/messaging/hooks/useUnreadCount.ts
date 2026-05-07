import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase/client';

export const unreadCountKey = (hangoutId: string) =>
  ['messages-unread', hangoutId] as const;

async function fetchUnreadCount(hangoutId: string): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  // Get last read timestamp for this hangout
  const { data: readState } = await (supabase as any)
    .from('message_read_state')
    .select('last_read_at')
    .eq('hangout_id', hangoutId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!readState) {
    // Never read — count all messages not sent by self
    const { count } = await (supabase as any)
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('hangout_id', hangoutId)
      .neq('sender_id', auth.user.id)
      .is('deleted_at', null);
    return count ?? 0;
  }

  const { count } = await (supabase as any)
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('hangout_id', hangoutId)
    .neq('sender_id', auth.user.id)
    .is('deleted_at', null)
    .gt('created_at', readState.last_read_at);

  return count ?? 0;
}

export function useUnreadCount(hangoutId: string) {
  return useQuery({
    queryKey: unreadCountKey(hangoutId),
    queryFn: () => fetchUnreadCount(hangoutId),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60, // fallback poll every minute
  });
}
