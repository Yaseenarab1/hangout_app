import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import type { Profile, FriendRequest } from '@/services/supabase/types.gen';

/**
 * Friend-related DB operations.
 *
 * Important: friendship rows are created EXCLUSIVELY by the
 * `accept-friend-request` Edge Function (RLS denies direct inserts).
 * Clients only ever update friend_requests.status to 'accepted'; the trigger
 * inserts the friendship row.
 */

// -----------------------------------------------------------------------------
// Friends list
// -----------------------------------------------------------------------------

export async function listFriends(): Promise<Profile[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const me = auth.user.id;

  // Friendships are stored canonically (user_a < user_b) so we OR over both columns.
  const { data: friendships, error: fErr } = await supabase
    .from(TABLES.friendships)
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${me},user_b_id.eq.${me}`);
  if (fErr) throw fErr;

  const friendIds = (friendships ?? []).map((row) =>
    row.user_a_id === me ? row.user_b_id : row.user_a_id,
  );
  if (friendIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from(TABLES.profiles)
    .select('*')
    .in('id', friendIds)
    .order('display_name');
  if (pErr) throw pErr;

  return profiles ?? [];
}

export async function removeFriend(friendId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Canonicalize ordering for the DELETE.
  const [a, b] =
    auth.user.id < friendId ? [auth.user.id, friendId] : [friendId, auth.user.id];

  const { error } = await supabase
    .from(TABLES.friendships)
    .delete()
    .match({ user_a_id: a, user_b_id: b });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Friend requests
// -----------------------------------------------------------------------------

type FriendRequestWithProfile = FriendRequest & {
  sender?: Profile;
  recipient?: Profile;
};

export async function listIncomingRequests(): Promise<FriendRequestWithProfile[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from(TABLES.friend_requests)
    .select(`*, sender:profiles!friend_requests_sender_id_fkey(*)`)
    .eq('recipient_id', auth.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FriendRequestWithProfile[];
}

export async function listOutgoingRequests(): Promise<FriendRequestWithProfile[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await supabase
    .from(TABLES.friend_requests)
    .select(`*, recipient:profiles!friend_requests_recipient_id_fkey(*)`)
    .eq('sender_id', auth.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FriendRequestWithProfile[];
}

export async function sendFriendRequest(
  recipientId: string,
  message?: string,
): Promise<FriendRequest> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Pre-check: are there any blocks in either direction?
  const blockStatus = await getBlockStatus(recipientId);
  if (blockStatus === 'blocked_them') {
    // Throw a typed error so the UI can offer to unblock.
    const err = new Error('You blocked this user.');
    (err as Error & { code?: string }).code = 'BLOCKED_THEM';
    throw err;
  }
  if (blockStatus === 'blocked_by') {
    // Don't reveal the block. Generic failure.
    throw new Error("Can't send request to this user.");
  }

  // Clean up any prior request from us to this person.
  await supabase
    .from(TABLES.friend_requests)
    .delete()
    .eq('sender_id', auth.user.id)
    .eq('recipient_id', recipientId);

  const { data, error } = await supabase
    .from(TABLES.friend_requests)
    .insert({
      sender_id: auth.user.id,
      recipient_id: recipientId,
      message: message ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
/**
 * Accept goes through an Edge Function because the friendship row insert is
 * service-role only (per our RLS policies — see db/002_rls_policies.sql).
 *
 * The Edge Function:
 *   1. Verifies the caller is the recipient.
 *   2. Updates friend_requests.status to 'accepted'.
 *   3. The DB trigger then inserts the friendship and notifies the sender.
 */
export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.friend_requests)
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.friend_requests)
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.friend_requests)
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Search
// -----------------------------------------------------------------------------

export async function searchUsers(query: string): Promise<Profile[]> {
  const cleaned = query.trim();
  if (cleaned.length < 2) return [];

  // Postgres `ilike` for both username and display_name. RLS hides blocked users.
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select('*')
    .or(`username.ilike.%${cleaned}%,display_name.ilike.%${cleaned}%`)
    .is('deleted_at', null)
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Blocks
// -----------------------------------------------------------------------------

export async function listBlockedUsers(): Promise<Profile[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data: blocks, error } = await supabase
    .from(TABLES.blocks)
    .select('blocked_id')
    .eq('blocker_id', auth.user.id);
  if (error) throw error;

  const ids = (blocks ?? []).map((b) => b.blocked_id);
  if (ids.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from(TABLES.profiles)
    .select('*')
    .in('id', ids);
  if (pErr) throw pErr;
  return profiles ?? [];
}


export async function blockUser(userId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from(TABLES.blocks)
    .insert({ blocker_id: auth.user.id, blocked_id: userId });
  if (error) throw error;
}


/**
 * Returns the block direction between current user and target, if any.
 *  - 'blocked_them'  → you blocked them
 *  - 'blocked_by'    → they blocked you
 *  - null            → no block in either direction
 *
 * Note: with our new RLS, both parties can see the block row, so this works
 * regardless of which side is calling.
 */
export async function getBlockStatus(
  targetUserId: string,
): Promise<'blocked_them' | 'blocked_by' | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const me = auth.user.id;

  const { data, error } = await supabase
    .from(TABLES.blocks)
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${me},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${me})`,
    );
  if (error) throw error;

  const row = (data ?? [])[0];
  if (!row) return null;
  return row.blocker_id === me ? 'blocked_them' : 'blocked_by';
}



export async function unblockUser(userId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from(TABLES.blocks)
    .delete()
    .match({ blocker_id: auth.user.id, blocked_id: userId });
  if (error) throw error;
}
