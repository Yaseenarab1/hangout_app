import React from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, ChevronRight, Users, Plus } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Avatar, EmptyState, Skeleton, SectionHeader } from '@/components/ui';
import { useMyHangouts } from '@/features/hangouts';
import { UnreadBadge } from '@/features/messaging';
import { useConversations } from '@/features/conversations';
import { useSession } from '@/features/auth';
import { useTheme } from '@/hooks/useTheme';
import type { Hangout } from '@/features/hangouts';
import type { Conversation } from '@/features/conversations';

export default function MessagesTab(): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const hangouts = useMyHangouts();
  const convs = useConversations();

  const active = (hangouts.data ?? []).filter((h) => h.status !== 'cancelled');
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
          {convs.conversations.length > 0 && (
            <>
              <SectionHeader title="Direct messages" />
              <View style={styles.list}>
                {convs.conversations.map((c) => (
                  <ConversationRow key={c.id} conv={c} myId={user?.id ?? ''} />
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
                  <HangoutChatRow key={h.id} hangout={h} />
                ))}
              </View>
            </>
          )}

          {/* Empty state when nothing at all */}
          {convs.conversations.length === 0 && active.length === 0 && (
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
}: {
  conv: Conversation;
  myId: string;
}): React.ReactElement {
  const theme = useTheme();

  // For DMs, show the other person. For groups, show group name.
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
          borderColor: theme.colors.border.default,
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
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
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
      <ChevronRight size={16} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

function HangoutChatRow({ hangout }: { hangout: Hangout }): React.ReactElement {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/hangout/${hangout.id}/chat` as any)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentSubtle }]}>
        <MessageCircle size={20} color={theme.colors.accent} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
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
});
