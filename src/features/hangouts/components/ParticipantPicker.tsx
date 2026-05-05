import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Check, Search as SearchIcon, Users } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, Input, EmptyState, Skeleton } from '@/components/ui';
import { useFriends } from '@/features/friends';
import { useDebounce } from '@/hooks/useDebounce';
import type { Profile } from '@/services/supabase/types.gen';

export type ParticipantPickerProps = {
  /** Currently selected user IDs. */
  value: string[];
  onChange: (ids: string[]) => void;
  /** User IDs to filter out (e.g. existing participants). */
  excludeIds?: string[];
  /** Title to show above the picker (optional). */
  title?: string;
  /** Search placeholder (optional). */
  searchPlaceholder?: string;
};

/**
 * Multi-select friend picker. Renders the user's friends list with checkboxes.
 * Search filter is debounced.
 *
 * Used for: inviting friends when creating a hangout, adding participants
 * to an existing hangout, etc.
 */
export function ParticipantPicker({
  value,
  onChange,
  excludeIds = [],
  title,
  searchPlaceholder = 'Search your friends',
}: ParticipantPickerProps): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query.trim().toLowerCase(), 200);
  const friends = useFriends();

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);
  const valueSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const all = friends.data ?? [];
    const visible = all.filter((p) => !excludeSet.has(p.id));
    if (!debouncedQuery) return visible;
    return visible.filter(
      (p) =>
        p.username.toLowerCase().includes(debouncedQuery) ||
        p.display_name.toLowerCase().includes(debouncedQuery),
    );
  }, [friends.data, debouncedQuery, excludeSet]);

  const toggle = (id: string): void => {
    if (valueSet.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {title ? (
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.text.primary, marginBottom: 8 },
          ]}
        >
          {title}{' '}
          <Text style={{ color: theme.colors.text.tertiary, fontWeight: '400' }}>
            ({value.length})
          </Text>
        </Text>
      ) : null}

      <Input
        placeholder={searchPlaceholder}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        trailing={<SearchIcon size={18} color={theme.colors.text.tertiary} />}
        containerStyle={{ marginBottom: 12 }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.colors.border.default,
              marginLeft: 60,
            }}
          />
        )}
        renderItem={({ item }) => (
          <Row profile={item} selected={valueSet.has(item.id)} onToggle={() => toggle(item.id)} />
        )}
        ListEmptyComponent={
          friends.isLoading ? (
            <View style={{ gap: 8 }}>
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
              <Skeleton height={56} radius={12} />
            </View>
          ) : friends.data?.length === 0 ? (
            <EmptyState
              icon={<Users size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title="No friends yet"
              body="Add friends from the Friends tab, then come back."
            />
          ) : (
            <EmptyState
              icon={<SearchIcon size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title="No matches"
              body="Try a different search."
            />
          )
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Row({
  profile,
  selected,
  onToggle,
}: {
  profile: Profile;
  selected: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
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
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selected ? theme.colors.accent : 'transparent',
            borderColor: selected ? theme.colors.accent : theme.colors.border.strong,
          },
        ]}
      >
        {selected ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 60,
  },
  body: {
    flex: 1,
    marginLeft: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
