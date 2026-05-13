import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Check, Plus, X, ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, Avatar, Skeleton } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useBillDraft } from '@/features/bills/context/BillDraftContext';
import { useFriends } from '@/features/friends';
import { useSession } from '@/features/auth';
import type { BillParticipant } from '@/features/bills/types';

export default function ParticipantsScreen() {
  const theme = useTheme();
  const { user } = useSession();
  const friends = useFriends();
  const { draft, setParticipants } = useBillDraft();
  const [guestName, setGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  // Participant keys: 'user:<id>' or 'guest:<tempId>'
  const selectedKeys = new Set(
    draft.participants.map((p) =>
      p.type === 'user' ? `user:${p.id}` : `guest:${p.tempId}`,
    ),
  );

  function toggleUser(friend: { id: string; display_name: string; avatar_url: string | null }) {
    const key = `user:${friend.id}`;
    if (selectedKeys.has(key)) {
      setParticipants(draft.participants.filter((p) => !(p.type === 'user' && p.id === friend.id)));
    } else {
      setParticipants([...draft.participants, { type: 'user', ...friend }]);
    }
  }

  function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    const tempId = `guest-${Date.now()}`;
    setParticipants([...draft.participants, { type: 'guest', tempId, name }]);
    setGuestName('');
    setShowGuestInput(false);
  }

  function removeParticipant(key: string) {
    setParticipants(
      draft.participants.filter((p) =>
        p.type === 'user' ? `user:${p.id}` !== key : `guest:${p.tempId}` !== key,
      ),
    );
  }

  function handleNext() {
    // Always include payer
    let participants = [...draft.participants];
    if (!participants.some((p) => p.type === 'user' && p.id === draft.payerId)) {
      const payer = friends.data?.find((f) => f.id === draft.payerId);
      if (payer) {
        participants = [
          { type: 'user', id: payer.id, display_name: payer.display_name, avatar_url: payer.avatar_url },
          ...participants,
        ];
      } else if (user) {
        participants = [
          { type: 'user', id: user.id, display_name: user.email ?? 'Me', avatar_url: null },
          ...participants,
        ];
      }
      setParticipants(participants);
    }

    if (participants.length === 0) {
      Alert.alert('No participants', 'Add at least one person to split with.');
      return;
    }
    router.push('/bill/assign');
  }

  // Always show "me" first in the list
  const meEntry: BillParticipant | null = user
    ? { type: 'user', id: user.id, display_name: 'Me', avatar_url: null }
    : null;

  const meSelected = user ? selectedKeys.has(`user:${user.id}`) : false;

  return (
    <Screen header={{ title: 'Participants', showBack: true }} contentPadding={0}>
      <FlatList
        data={friends.data ?? []}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            {/* Me */}
            {meEntry && (
              <PersonRow
                key="me"
                id={user!.id}
                name="Me (you)"
                avatarUri={null}
                selected={meSelected}
                onToggle={() => toggleUser({ id: user!.id, display_name: 'Me', avatar_url: null })}
                theme={theme}
              />
            )}
            {/* Selected guests */}
            {draft.participants
              .filter((p) => p.type === 'guest')
              .map((p) => {
                if (p.type !== 'guest') return null;
                return (
                  <View
                    key={p.tempId}
                    style={[
                      styles.row,
                      { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.accent },
                    ]}
                  >
                    <View style={styles.avatarPlaceholder}>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
                        {p.name[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[theme.typography.body, { flex: 1, color: theme.colors.text.primary }]}>
                      {p.name} (guest)
                    </Text>
                    <Pressable onPress={() => removeParticipant(`guest:${p.tempId}`)} hitSlop={8}>
                      <X size={16} color={theme.colors.text.tertiary} />
                    </Pressable>
                  </View>
                );
              })}
            {/* Add guest */}
            {showGuestInput ? (
              <View style={[styles.guestInput, { borderColor: theme.colors.border.default }]}>
                <TextInput
                  style={[theme.typography.body, { flex: 1, color: theme.colors.text.primary }]}
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Guest name"
                  placeholderTextColor={theme.colors.text.tertiary}
                  autoFocus
                  onSubmitEditing={addGuest}
                  returnKeyType="done"
                />
                <Button label="Add" variant="primary" size="sm" onPress={addGuest} />
                <Pressable onPress={() => setShowGuestInput(false)} hitSlop={8}>
                  <X size={16} color={theme.colors.text.tertiary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowGuestInput(true)}
                style={[styles.addGuest, { borderColor: theme.colors.accent }]}
              >
                <Plus size={16} color={theme.colors.accent} />
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>
                  Add guest
                </Text>
              </Pressable>
            )}
            {friends.isLoading && <Skeleton width="100%" height={52} radius={12} />}
            {(friends.data?.length ?? 0) > 0 && (
              <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 8 }]}>
                Friends
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <PersonRow
            id={item.id}
            name={item.display_name}
            avatarUri={item.avatar_url}
            selected={selectedKeys.has(`user:${item.id}`)}
            onToggle={() => toggleUser(item)}
            theme={theme}
          />
        )}
        ListFooterComponent={
          <View style={{ marginTop: 24 }}>
            <Button
              label={`Next: assign items (${draft.participants.length} selected)`}
              variant="primary"
              onPress={handleNext}
              trailingIcon={<ChevronRight size={16} color="#fff" />}
            />
          </View>
        }
      />
    </Screen>
  );
}

function PersonRow({
  id,
  name,
  avatarUri,
  selected,
  onToggle,
  theme,
}: {
  id: string;
  name: string;
  avatarUri: string | null;
  selected: boolean;
  onToggle: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border.default,
        },
      ]}
    >
      <Avatar id={id} displayName={name} uri={avatarUri} size="sm" />
      <Text style={[theme.typography.body, { flex: 1, color: theme.colors.text.primary }]}>
        {name}
      </Text>
      <View
        style={[
          styles.check,
          {
            backgroundColor: selected ? theme.colors.accent : 'transparent',
            borderColor: selected ? theme.colors.accent : theme.colors.border.strong,
          },
        ]}
      >
        {selected && <Check size={14} color="#fff" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  addGuest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    justifyContent: 'center',
  },
});
