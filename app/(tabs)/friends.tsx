import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Search, UserPlus, Users } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import {
  EmptyState,
  Card,
  Skeleton,
  Badge,
  ListItem,
  SectionHeader,
} from '@/components/ui';
import { FriendListItem, useFriends, useFriendRequests } from '@/features/friends';
import { useTheme } from '@/hooks/useTheme';

export default function FriendsScreen(): React.ReactElement {
  const theme = useTheme();
  const friends = useFriends();
  const incoming = useFriendRequests('incoming');

  const incomingCount = incoming.data?.length ?? 0;

  return (
    <Screen
      header={{
        title: 'Friends',
        right: (
          <Pressable
            hitSlop={12}
            onPress={() => router.push('/friends/search')}
            accessibilityLabel="Search for friends"
            style={{ padding: 8 }}
          >
            <Search size={22} color={theme.colors.text.primary} />
          </Pressable>
        ),
      }}
      contentPadding={0}
    >
      <FlatList
        data={friends.data ?? []}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.colors.border.default,
              marginLeft: 68,
            }}
          />
        )}
        ListHeaderComponent={
          <View style={{ paddingTop: 8 }}>
            {/* Pending requests action */}
            <View style={{ paddingHorizontal: 16 }}>
              <Card padding="none">
                <ListItem
                  title="Friend requests"
                  subtitle={
                    incomingCount > 0
                      ? `${incomingCount} pending`
                      : 'No pending requests'
                  }
                  leading={
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: theme.colors.accentSubtle },
                      ]}
                    >
                      <UserPlus size={20} color={theme.colors.accent} />
                    </View>
                  }
                  trailing={
                    incomingCount > 0 ? (
                      <Badge label={String(incomingCount)} variant="brand" />
                    ) : undefined
                  }
                  onPress={() => router.push('/friends/requests')}
                />
              </Card>
            </View>

            <SectionHeader
              title="Your friends"
              count={friends.data?.length}
            />
          </View>
        }
        renderItem={({ item }) => <FriendListItem profile={item} />}
        ListEmptyComponent={
          friends.isLoading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
            </View>
          ) : (
            <EmptyState
              icon={<Users size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title="No friends yet"
              body="Plans are better together. Search for someone you know."
              actionLabel="Find friends"
              onAction={() => router.push('/friends/search')}
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
