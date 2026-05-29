import React from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, ChevronRight, Users, Plus } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Avatar, EmptyState, Skeleton, SectionHeader } from '@/components/ui';
import { useMyHangouts } from '@/features/hangouts';
import { UnreadBadge, useUnreadHangoutIds } from '@/features/messaging';
import { useConversations } from '@/features/conversations';
import { useSession } from '@/features/auth';
import { useTheme } from '@/hooks/useTheme';
import type { Hangout } from '@/features/hangouts';
import type { Conversation } from '@/features/conversations';

function isConvUnread(conv: Conversation, myId: string): boolean {
  if (!conv.last_message_at) return false;
  // Don't count your own last message as unread
  if (conv.last_message?.sender_id === myId) return false;
  const me = conv.participants.find((p) => p.user_id === myId);
  if (!me?.last_read_at) return true;
  return conv.last_message_at > me.last_read_at;
}

export default function MessagesTab(): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const hangouts = useMyHangouts();
  const convs = useConversations();
  const unreadHangoutIds = useUnreadHangoutIds();

  const myId = user?.id ?? '';

  const allActive = (hangouts.data ?? []).filter((h) => h.status !== 'cancelled');
  // Sort: unread first, then by last_message_at desc (hangouts without messages go to end)
  const active = [...allActive].sort((a, b) => {
    const aUnread = unreadHangoutIds.has(a.id);
    const bUnread = unreadHangoutIds.has(b.id);
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    return 0;
  });

  const allConvs = convs.conversations;
  const sortedConvs = [...allConvs].sort((a, b) => {
    const aUnread = isConvUnread(a, myId);
    const bUnread = isConvUnread(b, myId);
    if (aUnread !== bUnread) return aUnread ? -1 : 1;
    // Secondary sort: most recent first
    if (a.last_message_at && b.last_message_at) {
      return b.last_message_at.localeCompare(a.last_message_at);
    }
    return 0;
  });

  const isLoading = hangouts.isLoading || convs.isLoading;
  const isRefreshing = hangouts.isRefetching || convs.isRefetching;

  const handleRefresh = () => {
    hangouts.refetch();
    convs.refetch();
  };

  return (
    <Screen
      header={{
        title: 'Messages',
        right: (
          <Pressable
            hitSlop={12}
            onPress={() => router.push('/conversations/new' as any)}
            accessibilityLabel="New group"
            style={{ padding: 8 }}
          >
            <Plus size={22} color={theme.colors.text.primary} />
          </Pressable>
        ),
      }}
      scroll
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.text.tertiary}
        />
      }
    >
      {isLoading ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={64} radius={12} />
          <Skeleton height={64} radius={12} />
          <Skeleton height={64} radius={12} />
        </View>
      ) : (
        <>
          {/* DMs + Groups */}
          {sortedConvs.length > 0 && (
            <>
              <SectionHeader title="Direct messages" />
              <View style={styles.list}>
                {sortedConvs.map((c) => (
                  <ConversationRow key={c.id} conv={c} myId={myId} isUnread={isConvUnread(c, myId)} />
                ))}
              </View>
            </>
          )}

          {/* Hangout chats */}
          {active.length > 0 && (
            <>
              <SectionHeader title="Hangout chats" />
              <View style={styles.list}>
                {active.map((h) => (
                  <HangoutChatRow key={h.id} hangout={h} isUnread={unreadHangoutIds.has(h.id)} />
                ))}
              </View>
            </>
          )}

          {/* Empty state when nothing at all */}
          {sortedConvs.length === 0 && active.length === 0 && (
            <EmptyState
              icon={<MessageCircle size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title="No chats yet"
              body="Message a friend directly or create a hangout to start a group chat."
            />
          )}
        </>
      )}
    </Screen>
  );
}

function ConversationRow({
  conv,
  myId,
  isUnread,
}: {
  conv: Conversation;
  myId: string;
  isUnread: boolean;
}): React.ReactElement {
  const theme = useTheme();

  const otherParticipant =
    conv.type === 'dm'
      ? conv.participants.find((p) => p.user_id !== myId)
      : null;

  const displayName =
    conv.type === 'group'
      ? (conv.name ?? 'Group')
      : (otherParticipant?.profile?.display_name ?? 'Direct message');

  const lastMsgText = conv.last_message
    ? conv.last_message.deleted_at
      ? 'Message deleted'
      : conv.last_message.body
    : 'No messages yet';

  const navigate = () => {
    router.push(`/conversations/${conv.id}?title=${encodeURIComponent(displayName)}` as any);
  };

  return (
    <Pressable
      onPress={navigate}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: isUnread ? theme.colors.accent : theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      {conv.type === 'dm' && otherParticipant?.profile ? (
        <Avatar
          id={otherParticipant.profile.id}
          displayName={otherParticipant.profile.display_name}
          uri={otherParticipant.profile.avatar_url}
          size="md"
        />
      ) : (
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentSubtle }]}>
          <Users size={20} color={theme.colors.accent} strokeWidth={1.5} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.text.primary, fontWeight: isUnread ? '700' : '400' },
          ]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text
          style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 2 }]}
          numberOfLines={1}
        >
          {lastMsgText}
        </Text>
      </View>

      {conv.last_message_at && (
        <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginRight: 4 }]}>
          {formatTime(conv.last_message_at)}
        </Text>
      )}
      {isUnread && <View style={styles.unreadDot} />}
      <ChevronRight size={16} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

function HangoutChatRow({ hangout, isUnread }: { hangout: Hangout; isUnread: boolean }): React.ReactElement {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/hangout/${hangout.id}/chat` as any)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: isUnread ? theme.colors.accent : theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentSubtle }]}>
        <MessageCircle size={20} color={theme.colors.accent} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.text.primary, fontWeight: isUnread ? '700' : '400' },
          ]}
          numberOfLines={1}
        >
          {hangout.title}
        </Text>
        <Text
          style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 2 }]}
          numberOfLines={1}
        >
          {hangout.status === 'planning' ? 'Planning' : 'Scheduled'}
          {hangout.start_time
            ? ` · ${new Date(hangout.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : ''}
        </Text>
      </View>
      <UnreadBadge hangoutId={hangout.id} />
      <ChevronRight size={16} color={theme.colors.text.tertiary} style={{ marginLeft: 4 }} />
    </Pressable>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
  },
});
