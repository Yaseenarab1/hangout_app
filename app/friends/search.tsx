import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Search as SearchIcon, Users } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Input, EmptyState, Skeleton, Button } from '@/components/ui';
import {
  FriendListItem,
  useFriendSearch,
  useFriends,
  useFriendRequests,
  useSendFriendRequest,
} from '@/features/friends';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';

export default function FriendSearchScreen(): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const search = useFriendSearch(query);
  const friends = useFriends();
  const outgoing = useFriendRequests('outgoing');
  const sendReq = useSendFriendRequest();
  const { user } = useSession();

  const friendIds = new Set((friends.data ?? []).map((f) => f.id));
  const requestedIds = new Set((outgoing.data ?? []).map((r) => r.recipient_id));

  const results = (search.data ?? []).filter((p) => p.id !== user?.id);

  return (
    <Screen header={{ title: 'Find friends', showClose: true }} contentPadding={0}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Input
          placeholder="Search by name or @username"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          trailing={<SearchIcon size={18} color={theme.colors.text.tertiary} />}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isFriend = friendIds.has(item.id);
          const isRequested = requestedIds.has(item.id);

          return (
            <FriendListItem
              profile={item}
              trailing={
                isFriend ? (
                  <Text
                    style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}
                  >
                    Friend
                  </Text>
                ) : isRequested ? (
                  <Text
                    style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}
                  >
                    Pending
                  </Text>
                ) : (
                  <Button
                    label="Add"
                    variant="primary"
                    size="sm"
                    onPress={() => sendReq.mutate({ recipientId: item.id })}
                    loading={sendReq.isPending && sendReq.variables?.recipientId === item.id}
                  />
                )
              }
            />
          );
        }}
        ListEmptyComponent={
          search.isFetching ? (
            <View style={{ padding: 16, gap: 12 }}>
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
            </View>
          ) : query.trim().length < 2 ? (
            <EmptyState
              icon={<SearchIcon size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title="Search for friends"
              body="Type someone's name or @username to find them."
            />
          ) : (
            <EmptyState
              icon={<Users size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title="No matches"
              body="Try a different name or username."
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}

const _styles = StyleSheet.create({});
