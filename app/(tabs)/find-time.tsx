import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Clock } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useOpenTimePolls } from '@/features/timepolls';
import type { OpenTimePollSummary } from '@/features/timepolls';

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.round((d.getTime() - now.getTime()) / 3_600_000);
  if (diffH < 0) return 'Deadline passed';
  if (diffH < 24) return `${diffH}h left to vote`;
  return `${Math.floor(diffH / 24)}d left to vote`;
}

function PollRow({ item }: { item: OpenTimePollSummary }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/hangout/${item.hangout_id}/time-poll` as any)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: theme.colors.accent + '20' }]}>
        <Clock size={20} color={theme.colors.accent} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
          numberOfLines={1}
        >
          {item.hangout?.title ?? 'Hangout'}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
          {formatDeadline(item.vote_deadline)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function FindTimeScreen(): React.ReactElement {
  const theme = useTheme();
  const polls = useOpenTimePolls();

  if (polls.isLoading) {
    return (
      <Screen header={{ title: 'Find Time' }}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!polls.data || polls.data.length === 0) {
    return (
      <Screen header={{ title: 'Find Time' }}>
        <EmptyState
          icon={<Calendar size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
          title="No open polls"
          body="Start a time poll from any hangout to help your group agree on when to meet."
        />
      </Screen>
    );
  }

  return (
    <Screen header={{ title: 'Find Time' }}>
      <FlatList
        data={polls.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PollRow item={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
