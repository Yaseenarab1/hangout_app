import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase/client';

/** Returns the set of hangout IDs that have messages the current user hasn't read yet.
 *  Single query — safe to call once at the screen level. */
export function useUnreadHangoutIds(): Set<string> {
  const { data } = useQuery({
    queryKey: ['messages-unread-all'],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [] as string[];

      // Find hangout_ids where there are unread messages from other users
      const { data: rows } = await (supabase as any)
        .from('messages')
        .select('hangout_id, created_at')
        .neq('sender_id', auth.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (!rows || rows.length === 0) return [] as string[];

      // Get this user's read state for all hangouts at once
      const hangoutIds = [...new Set((rows as { hangout_id: string }[]).map((r) => r.hangout_id))];

      const { data: readStates } = await (supabase as any)
        .from('message_read_state')
        .select('hangout_id, last_read_at')
        .eq('user_id', auth.user.id)
        .in('hangout_id', hangoutIds);

      const readMap = new Map<string, string>(
        ((readStates ?? []) as { hangout_id: string; last_read_at: string }[]).map((r) => [
          r.hangout_id,
          r.last_read_at,
        ]),
      );

      // A hangout is "unread" if any message is newer than last_read_at (or never read)
      const unread = new Set<string>();
      for (const row of rows as { hangout_id: string; created_at: string }[]) {
        if (unread.has(row.hangout_id)) continue;
        const lastRead = readMap.get(row.hangout_id);
        if (!lastRead || row.created_at > lastRead) {
          unread.add(row.hangout_id);
        }
      }
      return [...unread];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    select: (ids) => new Set(ids),
  });

  return data ?? new Set();
}
