import { supabase } from '@/services/supabase/client';

/**
 * Per-user saved activity suggestions.
 *
 * When a user adds a custom option in any poll, we save it here so it
 * appears as a chip in their picker for future polls.
 *
 * Scope: per-user. RLS ensures only the owner sees their own custom items.
 */

export type UserCustomActivity = {
  id: string;
  user_id: string;
  label: string;
  emoji: string | null;
  created_at: string;
};

export async function listMyCustomActivities(): Promise<UserCustomActivity[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from('user_custom_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []) as UserCustomActivity[];
}

/**
 * Save a custom activity to the user's recommendations.
 * Idempotent — duplicates (same label) are silently ignored via the unique constraint.
 */
export async function saveCustomActivity(
  label: string,
  emoji?: string,
): Promise<UserCustomActivity | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const trimmed = label.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('user_custom_activities')
    .upsert(
      {
        user_id: auth.user.id,
        label: trimmed,
        emoji: emoji ?? null,
      },
      { onConflict: 'user_id,label', ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error) {
    // If the conflict-ignore returns no row, silently treat as success.
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as UserCustomActivity;
}

export async function deleteCustomActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_custom_activities')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
