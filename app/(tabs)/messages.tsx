import React from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, Skeleton, SectionHeader } from '@/components/ui';
import { useMyHangouts } from '@/features/hangouts';
import { UnreadBadge } from '@/features/messaging';
import { useTheme } from '@/hooks/useTheme';
import type { Hangout } from '@/features/hangouts';

export default function MessagesTab(): React.ReactElement {
  const theme = useTheme();
  const hangouts = useMyHangouts();

  const active = (hangouts.data ?? []).filter((h) => h.status !== 'cancelled');

  return (
    <Screen
      header={{ title: 'Messages' }}
      scroll
      refreshControl={
        <RefreshControl
          refreshing={hangouts.isRefetching}
          onRefresh={() => hangouts.refetch()}
          tintColor={theme.colors.text.tertiary}
        />
      }
    >
      {hangouts.isLoading ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={64} radius={12} />
          <Skeleton height={64} radius={12} />
          <Skeleton height={64} radius={12} />
        </View>
      ) : active.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
          title="No chats yet"
          body="Create a hangout to start a group chat with your friends."
        />
      ) : (
        <>
          <SectionHeader title="Hangout chats" />
          <View style={styles.list}>
            {active.map((h) => (
              <HangoutChatRow key={h.id} hangout={h} />
            ))}
          </View>
        </>
      )}
    </Screen>
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
