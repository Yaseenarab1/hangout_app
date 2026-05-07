import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import {
  EmptyState,
  Skeleton,
} from '@/components/ui';
import {
  FriendRequestCard,
  useFriendRequests,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useCancelFriendRequest,
} from '@/features/friends';
import { useTheme } from '@/hooks/useTheme';

type Tab = 'incoming' | 'outgoing';

export default function FriendRequestsScreen(): React.ReactElement {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('incoming');

  const incoming = useFriendRequests('incoming');
  const outgoing = useFriendRequests('outgoing');

  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const cancel = useCancelFriendRequest();

  const data = tab === 'incoming' ? incoming.data : outgoing.data;
  const isLoading = tab === 'incoming' ? incoming.isLoading : outgoing.isLoading;

  return (
    <Screen header={{ title: 'Friend requests', showBack: true }} contentPadding={0}>
      <View style={[styles.tabs, { borderBottomColor: theme.colors.border.default }]}>
        {(['incoming', 'outgoing'] as Tab[]).map((value) => {
          const active = tab === value;
          const count =
            value === 'incoming'
              ? incoming.data?.length ?? 0
              : outgoing.data?.length ?? 0;
          return (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              style={[
                styles.tab,
                {
                  borderBottomColor: active ? theme.colors.accent : 'transparent',
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  theme.typography.bodyMedium,
                  {
                    color: active ? theme.colors.text.primary : theme.colors.text.secondary,
                  },
                ]}
              >
                {value === 'incoming' ? 'Received' : 'Sent'}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        renderItem={({ item }) => {
          // Type narrowing: incoming has 'sender', outgoing has 'recipient'
          const otherUser =
            tab === 'incoming'
              ? (item as any).sender
              : (item as any).recipient;
          if (!otherUser) return null;

          return (
            <FriendRequestCard
              request={item}
              otherUser={otherUser}
              direction={tab}
              busy={
                (tab === 'incoming' &&
                  ((accept.isPending && accept.variables === item.id) ||
                    (decline.isPending && decline.variables === item.id))) ||
                (tab === 'outgoing' && cancel.isPending && cancel.variables === item.id)
              }
              onAccept={() => accept.mutate(item.id)}
              onDecline={() => decline.mutate(item.id)}
              onCancel={() => cancel.mutate(item.id)}
            />
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12 }}>
              <Skeleton height={120} radius={14} />
              <Skeleton height={120} radius={14} />
            </View>
          ) : (
            <EmptyState
              icon={<Inbox size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title={tab === 'incoming' ? 'No requests' : 'No pending sent'}
              body={
                tab === 'incoming'
                  ? "When someone wants to be your friend, you'll see it here."
                  : "Requests you've sent appear here until they're accepted."
              }
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
});
