import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useFriends } from '@/features/friends';
import { useOpenDM, useCreateGroup } from '@/features/conversations';
import type { Profile } from '@/services/supabase/types.gen';

export default function NewConversationScreen(): React.ReactElement {
  const theme = useTheme();
  const friends = useFriends();
  const openDM = useOpenDM();
  const createGroup = useCreateGroup();

  const [selected, setSelected] = useState<Map<string, Profile>>(new Map());
  const [groupName, setGroupName] = useState('');

  const selectedCount = selected.size;
  const isGroup = selectedCount >= 2;
  const isPending = openDM.isPending || createGroup.isPending;

  const toggle = (profile: Profile) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(profile.id)) next.delete(profile.id);
      else next.set(profile.id, profile);
      return next;
    });
  };

  const handleAction = () => {
    if (selectedCount === 0) return;
    if (isGroup) {
      const name = groupName.trim() || [...selected.values()].map((p) => p.display_name).join(', ');
      createGroup.mutate({ name, memberIds: [...selected.keys()] });
    } else {
      const friend = [...selected.values()][0]!;
      openDM.mutate({ friendId: friend.id, friendName: friend.display_name });
    }
  };

  const firstSelected = selected.size === 1 ? [...selected.values()][0] : null;
  const actionLabel = isGroup
    ? groupName.trim()
      ? `Create "${groupName.trim()}"`
      : 'Create group'
    : firstSelected
    ? `Message ${firstSelected.display_name}`
    : 'Select someone';

  const renderFriend = ({ item }: { item: Profile }) => {
    const isSelected = selected.has(item.id);
    return (
      <Pressable
        onPress={() => toggle(item)}
        style={({ pressed }) => [
          styles.friendRow,
          { borderBottomColor: theme.colors.border.default },
          pressed && { backgroundColor: theme.colors.bg.subtle },
        ]}
      >
        <Avatar
          id={item.id}
          displayName={item.display_name}
          uri={item.avatar_url}
          size="md"
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={[theme.typography.body, { color: theme.colors.text.primary }]}
            numberOfLines={1}
          >
            {item.display_name}
          </Text>
          <Text
            style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            @{item.username}
          </Text>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isSelected ? theme.colors.accent : theme.colors.border.default,
              backgroundColor: isSelected ? theme.colors.accent : 'transparent',
            },
          ]}
        >
          {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={2.5} />}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen
      header={{ title: 'New message', showBack: true }}
      contentPadding={0}
    >
      {/* Group name input — only shows when 2+ selected */}
      {isGroup && (
        <View
          style={[
            styles.nameWrap,
            {
              borderBottomColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.surface,
            },
          ]}
        >
          <TextInput
            placeholder="Group name (optional)"
            placeholderTextColor={theme.colors.text.tertiary}
            value={groupName}
            onChangeText={setGroupName}
            style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}
            maxLength={60}
            returnKeyType="done"
          />
        </View>
      )}

      {friends.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={friends.data ?? []}
          keyExtractor={(f) => f.id}
          renderItem={renderFriend}
          ListHeaderComponent={
            <Text
              style={[
                theme.typography.caption,
                {
                  color: theme.colors.text.tertiary,
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                },
              ]}
            >
              Friends
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      {/* Bottom action bar */}
      {selectedCount > 0 && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.bg.canvas,
              borderTopColor: theme.colors.border.default,
            },
          ]}
        >
          <Button
            label={actionLabel}
            variant="primary"
            onPress={handleAction}
            disabled={isPending}
            style={{ flex: 1 }}
          />
        </View>
      )}

      {isPending && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nameWrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
