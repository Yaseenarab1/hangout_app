import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { ShieldOff } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, Skeleton, Button } from '@/components/ui';
import { FriendListItem, useBlockedUsers, useUnblockUser } from '@/features/friends';
import { useTheme } from '@/hooks/useTheme';

export default function BlockedUsersScreen(): React.ReactElement {
  const theme = useTheme();
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();

  return (
    <Screen header={{ title: 'Blocked users', showBack: true }} contentPadding={0}>
      <FlatList
        data={blocked.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.colors.border.default,
              marginLeft: 68,
            }}
          />
        )}
        renderItem={({ item }) => (
          <FriendListItem
            profile={item}
            trailing={
              <Button
                label="Unblock"
                variant="secondary"
                size="sm"
                onPress={() => unblock.mutate(item.id)}
                loading={unblock.isPending && unblock.variables === item.id}
              />
            }
          />
        )}
        ListEmptyComponent={
          blocked.isLoading ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
            </View>
          ) : (
            <EmptyState
              icon={<ShieldOff size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title="No blocked users"
              body="People you block won't be able to see you, message you, or invite you anywhere."
            />
          )
        }
      />
    </Screen>
  );
}
