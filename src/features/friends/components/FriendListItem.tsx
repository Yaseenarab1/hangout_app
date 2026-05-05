import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/hooks/useTheme';
import type { Profile } from '@/services/supabase/types.gen';

export type FriendListItemProps = {
  profile: Profile;
  trailing?: React.ReactNode;
};

/**
 * Tap to view profile. Use `trailing` for action buttons (Add, Pending, etc.).
 */
export function FriendListItem({
  profile,
  trailing,
}: FriendListItemProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/users/${profile.id}`)}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.colors.bg.subtle },
      ]}
    >
      <Avatar
        id={profile.id}
        displayName={profile.display_name}
        uri={profile.avatar_url}
        size="md"
      />
      <View style={styles.body}>
        <Text
          style={[theme.typography.body, { color: theme.colors.text.primary }]}
          numberOfLines={1}
        >
          {profile.display_name}
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.secondary, marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          @{profile.username}
        </Text>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 60,
  },
  body: {
    flex: 1,
    marginLeft: 12,
  },
  trailing: {
    marginLeft: 12,
  },
});
