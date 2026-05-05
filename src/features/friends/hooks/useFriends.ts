import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { QUERY_KEYS } from '@/services/supabase/tables';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { ANALYTICS_EVENTS, track } from '@/services/analytics';
import {
  listFriends,
  removeFriend,
  listIncomingRequests,
  listOutgoingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  searchUsers,
  listBlockedUsers,
  blockUser,
  unblockUser,
} from '../services/friends.service';

export function useFriends() {
  return useQuery({
    queryKey: QUERY_KEYS.friends,
    queryFn: listFriends,
    staleTime: 60 * 1000,
  });
}

export function useFriendRequests(direction: 'incoming' | 'outgoing') {
  return useQuery({
    queryKey: QUERY_KEYS.friendRequests(direction),
    queryFn: direction === 'incoming' ? listIncomingRequests : listOutgoingRequests,
    staleTime: 30 * 1000,
  });
}

export function useFriendSearch(query: string) {
  const debounced = useDebounce(query.trim(), 300);

  return useQuery({
    queryKey: QUERY_KEYS.friendSearch(debounced),
    queryFn: () => searchUsers(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30 * 1000,
  });
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: QUERY_KEYS.blockedUsers,
    queryFn: listBlockedUsers,
    staleTime: 60 * 1000,
  });
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

import { Alert } from 'react-native';

export function useSendFriendRequest() {
  const qc = useQueryClient();
  const unblock = useUnblockUser();

  return useMutation({
    mutationFn: ({ recipientId, message }: { recipientId: string; message?: string }) =>
      sendFriendRequest(recipientId, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests('outgoing') });
      track(ANALYTICS_EVENTS.friendRequestSent);
      toast.success('Friend request sent.');
    },
    onError: (error, variables) => {
      const code = (error as Error & { code?: string }).code;

      if (code === 'BLOCKED_THEM') {
        // Special-case the "you blocked them" error with an unblock prompt.
        Alert.alert(
          "You've blocked this user",
          'Unblock them to send a friend request?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unblock & send',
              onPress: () => {
                unblock.mutate(variables.recipientId, {
                  onSuccess: () => {
                    // Retry the friend request after a short delay so RLS state settles
                    setTimeout(() => {
                      sendFriendRequest(variables.recipientId, variables.message)
                        .then(() => {
                          qc.invalidateQueries({
                            queryKey: QUERY_KEYS.friendRequests('outgoing'),
                          });
                          toast.success('Friend request sent.');
                        })
                        .catch((retryErr) => {
                          logError(retryErr, { where: 'sendFriendRequest.afterUnblock' });
                          toast.error(friendlyErrorMessage(retryErr));
                        });
                    }, 250);
                  },
                });
              },
            },
          ],
        );
        return;
      }

      // Default error handling
      logError(error, { where: 'sendFriendRequest' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useAcceptFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => acceptFriendRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests('incoming') });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friends });
      track(ANALYTICS_EVENTS.friendRequestAccepted);
      toast.success("You're friends!");
    },
    onError: (error) => {
      logError(error, { where: 'acceptFriendRequest' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useDeclineFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => declineFriendRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests('incoming') });
    },
    onError: (error) => {
      logError(error, { where: 'declineFriendRequest' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useCancelFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => cancelFriendRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests('outgoing') });
    },
    onError: (error) => {
      logError(error, { where: 'cancelFriendRequest' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) => removeFriend(friendId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friends });
      track(ANALYTICS_EVENTS.friendRemoved);
      toast.success('Friend removed.');
    },
    onError: (error) => {
      logError(error, { where: 'removeFriend' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friends });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.blockedUsers });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests('incoming') });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.friendRequests('outgoing') });
      track(ANALYTICS_EVENTS.userBlocked);
      toast.success('User blocked.');
    },
    onError: (error) => {
      logError(error, { where: 'blockUser' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.blockedUsers });
      track(ANALYTICS_EVENTS.userUnblocked);
      toast.success('User unblocked.');
    },
    onError: (error) => {
      logError(error, { where: 'unblockUser' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}
