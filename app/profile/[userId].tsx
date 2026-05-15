import React from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Settings as SettingsIcon,
  Pencil,
  UserPlus,
  UserMinus,
  ShieldOff,
} from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Skeleton,
  ListItem,
  SectionHeader,
} from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useMyProfile, useProfile } from '@/features/profile';
import { useSession } from '@/features/auth';
import { useMyHangouts } from '@/features/hangouts';
import {
  useFriends,
  useFriendRequests,
  useSendFriendRequest,
  useRemoveFriend,
  useBlockUser,
  useCancelFriendRequest,
} from '@/features/friends';

export default function ProfileScreen(): React.ReactElement {
  const theme = useTheme();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user: me } = useSession();
  const isMe = userId === me?.id;

  const myProfileQuery = useMyProfile();
  const otherProfileQuery = useProfile(isMe ? undefined : userId);
  const profile = isMe ? myProfileQuery : otherProfileQuery;

  const friends = useFriends();
  const hangouts = useMyHangouts();
  const outgoing = useFriendRequests('outgoing');
  const incoming = useFriendRequests('incoming');

  const sendReq = useSendFriendRequest();
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const cancelReq = useCancelFriendRequest();

  if (!userId) {
    return (
      <Screen header={{ title: 'Profile', showBack: true }}>
        <EmptyState title="User not found" />
      </Screen>
    );
  }

  if (profile.isLoading || !profile.data) {
    if (profile.isLoading) {
      return (
        <Screen header={{ title: '', showBack: !isMe }}>
          <View style={styles.hero}>
            <Skeleton width={80} height={80} radius={40} />
            <Skeleton width={160} height={24} style={{ marginTop: 16 }} />
            <Skeleton width={120} height={16} style={{ marginTop: 8 }} />
          </View>
        </Screen>
      );
    }
    return (
      <Screen header={{ title: 'Profile', showBack: !isMe }}>
        <EmptyState
          title="Profile not found"
          body="This user may have deleted their account or blocked you."
        />
      </Screen>
    );
  }

  const p = profile.data;
  const visibility = (p as any).profile_visibility as
    | 'everyone'
    | 'friends_only'
    | 'nobody'
    | undefined;

  // Non-author visibility check
  if (!isMe && visibility === 'nobody') {
    return (
      <Screen header={{ title: '', showBack: true }} scroll>
        <View style={styles.hero}>
          <Avatar id={p.id} displayName={p.display_name} size="xl" />
          <Text
            style={[
              theme.typography.h1,
              { color: theme.colors.text.primary, marginTop: 16, textAlign: 'center' },
            ]}
          >
            {p.display_name}
          </Text>
          <Text
            style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}
          >
            @{p.username}
          </Text>
        </View>
        <EmptyState title="Private profile" body="This user has set their profile to private." />
      </Screen>
    );
  }

  const isFriend = !isMe && (friends.data ?? []).some((f) => f.id === p.id);
  const outgoingReq = !isMe
    ? (outgoing.data ?? []).find((r) => r.recipient_id === p.id)
    : undefined;
  const incomingReq = !isMe
    ? (incoming.data ?? []).find((r) => r.sender_id === p.id)
    : undefined;

  const handleRemove = (): void => {
    Alert.alert('Remove friend?', `${p.display_name} won't be notified.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeFriend.mutate(p.id),
      },
    ]);
  };

  const handleBlock = (): void => {
    Alert.alert('Block user?', "They won't be able to see you, message you, or invite you.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => blockUser.mutate(p.id, { onSuccess: () => router.back() }),
      },
    ]);
  };

  return (
    <Screen
      scroll
      header={{
        title: '',
        showBack: !isMe,
        right: isMe ? (
          <Pressable
            onPress={() => router.push('/profile/settings')}
            hitSlop={12}
            accessibilityLabel="Settings"
            style={{ padding: 8 }}
          >
            <SettingsIcon size={22} color={theme.colors.text.primary} />
          </Pressable>
        ) : undefined,
      }}
    >
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <Avatar id={p.id} displayName={p.display_name} uri={p.avatar_url} size="xl" />
        <Text
          style={[
            theme.typography.h1,
            { color: theme.colors.text.primary, marginTop: 16, textAlign: 'center' },
          ]}
        >
          {p.display_name}
        </Text>
        <Text
          style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}
        >
          @{p.username}
        </Text>
        {p.bio ? (
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
            {p.bio}
          </Text>
        ) : null}

        {isMe && (
          <Button
            label="Edit profile"
            variant="secondary"
            size="sm"
            leadingIcon={<Pencil size={14} color={theme.colors.text.primary} />}
            onPress={() => router.push('/profile/edit')}
            style={{ marginTop: 20 }}
          />
        )}
      </View>

      {/* ── My profile sections ── */}
      {isMe && (
        <>
          <View style={styles.statsRow}>
            <StatBox
              label="Friends"
              value={String(friends.data?.length ?? 0)}
              onPress={() => router.push('/(tabs)/friends')}
            />
            <StatBox label="Hangouts" value={String(hangouts.data?.length ?? 0)} />
            <StatBox label="Posts" value="0" />
          </View>

          <SectionHeader title="Social" />
          <Card padding="none">
            <ListItem
              title="Friends"
              subtitle="Manage your friends list"
              onPress={() => router.push('/(tabs)/friends')}
            />
          </Card>

          <SectionHeader title="Bills" />
          <Card padding="none">
            <ListItem
              title="My bills"
              subtitle="Bills you created outside hangouts"
              onPress={() => router.push('/profile/bills')}
            />
          </Card>

          <SectionHeader title="Account" />
          <Card padding="none">
            <ListItem title="Settings" onPress={() => router.push('/profile/settings')} />
            <Divider />
            <ListItem
              title="Notifications"
              onPress={() => router.push('/profile/settings/notifications')}
            />
            <Divider />
            <ListItem
              title="Privacy"
              onPress={() => router.push('/profile/settings/privacy')}
            />
            <Divider />
            <ListItem title="About" onPress={() => router.push('/profile/settings/about')} />
          </Card>
        </>
      )}

      {/* ── Other user actions ── */}
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
              onPress={() => sendReq.mutate({ recipientId: p.id })}
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

function StatBox({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.stat,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && onPress ? { opacity: 0.7 } : undefined,
      ]}
    >
      <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>{value}</Text>
      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Divider(): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border.default,
        marginLeft: 16,
      }}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
});
