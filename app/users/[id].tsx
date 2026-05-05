import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { UserPlus, UserMinus, ShieldOff } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useProfile } from '@/features/profile';
import { useSession } from '@/features/auth';
import {
  useFriends,
  useFriendRequests,
  useSendFriendRequest,
  useRemoveFriend,
  useBlockUser,
  useCancelFriendRequest,
} from '@/features/friends';

export default function UserProfileScreen(): React.ReactElement {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useSession();

  const profile = useProfile(id);
  const friends = useFriends();
  const outgoing = useFriendRequests('outgoing');
  const incoming = useFriendRequests('incoming');

  const sendReq = useSendFriendRequest();
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const cancelReq = useCancelFriendRequest();

  if (!id) {
    return (
      <Screen header={{ title: 'Profile', showBack: true }}>
        <EmptyState title="User not found" />
      </Screen>
    );
  }

  if (profile.isLoading) {
    return (
      <Screen header={{ title: '', showBack: true }}>
        <View style={styles.hero}>
          <Skeleton width={80} height={80} radius={40} />
          <Skeleton width={160} height={24} style={{ marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  if (!profile.data) {
    return (
      <Screen header={{ title: 'Profile', showBack: true }}>
        <EmptyState
          title="Profile not found"
          body="This user may have deleted their account or blocked you."
        />
      </Screen>
    );
  }

  const isMe = me?.id === profile.data.id;
  const isFriend = (friends.data ?? []).some((f) => f.id === profile.data!.id);
  const outgoingReq = (outgoing.data ?? []).find(
    (r) => r.recipient_id === profile.data!.id,
  );
  const incomingReq = (incoming.data ?? []).find(
    (r) => r.sender_id === profile.data!.id,
  );

  const handleAddFriend = (): void => {
    sendReq.mutate({ recipientId: profile.data!.id });
  };

  const handleRemove = (): void => {
    Alert.alert(
      'Remove friend?',
      `${profile.data!.display_name} won't be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriend.mutate(profile.data!.id),
        },
      ],
    );
  };

  const handleBlock = (): void => {
    Alert.alert(
      'Block user?',
      "They won't be able to see you, message you, or invite you.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            blockUser.mutate(profile.data!.id, {
              onSuccess: () => router.back(),
            }),
        },
      ],
    );
  };

  return (
    <Screen header={{ title: '', showBack: true }} scroll>
      <View style={styles.hero}>
        <Avatar
          id={profile.data.id}
          displayName={profile.data.display_name}
          uri={profile.data.avatar_url}
          size="xl"
        />
        <Text
          style={[
            theme.typography.h1,
            { color: theme.colors.text.primary, marginTop: 16, textAlign: 'center' },
          ]}
        >
          {profile.data.display_name}
        </Text>
        <Text
          style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}
        >
          @{profile.data.username}
        </Text>
        {profile.data.bio ? (
          <Text
            style={[
              theme.typography.body,
              {
                color: theme.colors.text.primary,
                textAlign: 'center',
                marginTop: 16,
                paddingHorizontal: 16,
              },
            ]}
          >
            {profile.data.bio}
          </Text>
        ) : null}
      </View>

      {!isMe && (
        <Card padding="md" style={{ marginTop: 24, gap: 8 }}>
          {isFriend ? (
            <>
              <Button
                label="Friends"
                variant="secondary"
                disabled
                leadingIcon={<UserPlus size={16} color={theme.colors.text.secondary} />}
                fullWidth
              />
              <Button
                label="Remove friend"
                variant="ghost"
                onPress={handleRemove}
                leadingIcon={<UserMinus size={16} color={theme.colors.danger} />}
                loading={removeFriend.isPending}
                fullWidth
              />
            </>
          ) : incomingReq ? (
            <Button
              label="Respond to request"
              variant="primary"
              onPress={() => router.push('/friends/requests')}
              fullWidth
            />
          ) : outgoingReq ? (
            <Button
              label="Cancel request"
              variant="secondary"
              onPress={() => cancelReq.mutate(outgoingReq.id)}
              loading={cancelReq.isPending}
              fullWidth
            />
          ) : (
            <Button
              label="Add friend"
              variant="primary"
              onPress={handleAddFriend}
              loading={sendReq.isPending}
              leadingIcon={<UserPlus size={16} color="#FFFFFF" />}
              fullWidth
            />
          )}

          <Button
            label="Block user"
            variant="ghost"
            onPress={handleBlock}
            leadingIcon={<ShieldOff size={16} color={theme.colors.danger} />}
            loading={blockUser.isPending}
            fullWidth
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: 16,
  },
});
