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
import { Plus, Trash2, ChevronRight, Check, X } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, Avatar, Skeleton } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useBillDraft } from '@/features/bills/context/BillDraftContext';
import { useFriends } from '@/features/friends';
import { useSession } from '@/features/auth';
import { parseMoney } from '@/features/bills/utils/parse-money';
import type { BillItem, BillParticipant } from '@/features/bills/types';

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function participantKey(p: BillParticipant): string {
  return p.type === 'user' ? `user:${p.id}` : `guest:${p.tempId}`;
}

export default function ReviewItemsScreen() {
  const theme = useTheme();
  const { user } = useSession();
  const friends = useFriends();
  const { draft, setItems, setField, setParticipants } = useBillDraft();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [guestName, setGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  // ── Items ──────────────────────────────────────────────

  function addItem() {
    const next = [
      ...draft.items,
      { description: '', amount_cents: 0, quantity: 1, source: 'manual' as const },
    ];
    setItems(next);
    setEditingIndex(next.length - 1);
  }

  function updateItem(index: number, patch: Partial<BillItem>) {
    const next = draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    setItems(next);
  }

  function deleteItem(index: number) {
    const next = draft.items.filter((_, i) => i !== index);
    setItems(next);
    if (editingIndex === index) setEditingIndex(null);
  }

  const subtotal = draft.items.reduce((s, i) => s + i.amount_cents * i.quantity, 0);

  // ── Participants ───────────────────────────────────────

  const selectedKeys = new Set(
    draft.participants.map((p) => participantKey(p)),
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
      draft.participants.filter((p) => participantKey(p) !== key),
    );
  }

  // ── Next ───────────────────────────────────────────────

  function handleNext() {
    const valid = draft.items.filter((i) => i.description.trim() && i.amount_cents > 0);
    if (valid.length === 0) {
      Alert.alert('No items', 'Add at least one item with a price.');
      return;
    }
    if (valid.length < draft.items.length) setItems(valid);

    // Ensure payer is in participants
    let participants = [...draft.participants];
    if (!participants.some((p) => p.type === 'user' && p.id === draft.payerId)) {
      const payer = friends.data?.find((f) => f.id === draft.payerId);
      if (payer) {
        participants = [{ type: 'user', id: payer.id, display_name: payer.display_name, avatar_url: payer.avatar_url }, ...participants];
      } else if (user) {
        participants = [{ type: 'user', id: user.id, display_name: 'Me', avatar_url: null }, ...participants];
      }
      setParticipants(participants);
    }

    if (draft.participants.length === 0) {
      Alert.alert('No people', 'Add at least one person to split with.');
      return;
    }

    router.push('/bill/assign');
  }

  const meSelected = user ? selectedKeys.has(`user:${user.id}`) : false;

  return (
    <Screen header={{ title: 'Set up bill', showBack: true }} contentPadding={0} scroll={false}>
      <FlatList
        data={draft.items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 0 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[theme.typography.body, { color: theme.colors.text.tertiary }]}>
              No items yet — tap + to add one.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <ItemRow
            item={item}
            isEditing={editingIndex === index}
            onPress={() => setEditingIndex(editingIndex === index ? null : index)}
            onUpdate={(patch) => updateItem(index, patch)}
            onDelete={() => deleteItem(index)}
            theme={theme}
          />
        )}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 8 }}>
            {/* Add item */}
            <Pressable onPress={addItem} style={[styles.addRow, { borderColor: theme.colors.accent }]}>
              <Plus size={16} color={theme.colors.accent} />
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>Add item</Text>
            </Pressable>

            {/* Tax / Tip */}
            <View style={[styles.taxTipCard, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
              <SummaryRow label="Tax" value={draft.taxCents} onChange={(v) => setField('taxCents', v)} theme={theme} />
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default }} />
              <SummaryRow label="Tip" value={draft.tipCents} onChange={(v) => setField('tipCents', v)} theme={theme} />
              <View style={[styles.totalRow, { borderTopColor: theme.colors.border.default }]}>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Total</Text>
                <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
                  ${((subtotal + draft.taxCents + draft.tipCents) / 100).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Who's splitting? */}
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              Who's splitting?
            </Text>

            {/* Me */}
            {user && (
              <PersonRow
                id={user.id}
                name="Me (you)"
                avatarUri={null}
                selected={meSelected}
                onToggle={() => toggleUser({ id: user.id, display_name: 'Me', avatar_url: null })}
                theme={theme}
              />
            )}

            {/* Guest chips */}
            {draft.participants.filter((p) => p.type === 'guest').map((p) => {
              if (p.type !== 'guest') return null;
              return (
                <View
                  key={p.tempId}
                  style={[styles.row, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.accent }]}
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
                style={[styles.addRow, { borderColor: theme.colors.accent }]}
              >
                <Plus size={16} color={theme.colors.accent} />
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>Add guest</Text>
              </Pressable>
            )}

            {/* Friends */}
            {friends.isLoading && <Skeleton width="100%" height={52} radius={12} />}
            {(friends.data ?? []).length > 0 && (
              <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>Friends</Text>
            )}
            {(friends.data ?? []).map((friend) => (
              <PersonRow
                key={friend.id}
                id={friend.id}
                name={friend.display_name}
                avatarUri={friend.avatar_url}
                selected={selectedKeys.has(`user:${friend.id}`)}
                onToggle={() => toggleUser(friend)}
                theme={theme}
              />
            ))}

            {/* Next */}
            <Button
              label={`Next: assign items (${draft.participants.length} selected)`}
              variant="primary"
              onPress={handleNext}
              trailingIcon={<ChevronRight size={16} color="#fff" />}
              style={{ marginTop: 8, marginBottom: 40 }}
            />
          </View>
        }
      />
    </Screen>
  );
}

function ItemRow({
  item, isEditing, onPress, onUpdate, onDelete, theme,
}: {
  item: BillItem;
  isEditing: boolean;
  onPress: () => void;
  onUpdate: (patch: Partial<BillItem>) => void;
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.itemCard, { backgroundColor: theme.colors.bg.surface, borderColor: isEditing ? theme.colors.accent : theme.colors.border.default }]}
    >
      {isEditing ? (
        <View style={styles.editRow}>
          <TextInput
            style={[styles.descInput, theme.typography.body, { color: theme.colors.text.primary, borderColor: theme.colors.border.default }]}
            value={item.description}
            onChangeText={(t) => onUpdate({ description: t })}
            placeholder="Item description"
            placeholderTextColor={theme.colors.text.tertiary}
            autoFocus
          />
          <View style={styles.editMeta}>
            <View style={styles.qtyRow}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>Qty</Text>
              <TextInput
                style={[styles.qtyInput, theme.typography.body, { color: theme.colors.text.primary, borderColor: theme.colors.border.default }]}
                value={String(item.quantity)}
                onChangeText={(t) => { const n = parseInt(t, 10); if (!isNaN(n) && n > 0) onUpdate({ quantity: n }); }}
                keyboardType="numeric"
              />
            </View>
            <TextInput
              style={[styles.priceInput, theme.typography.body, { color: theme.colors.text.primary, borderColor: theme.colors.border.default }]}
              value={centsToDisplay(item.amount_cents)}
              onChangeText={(t) => { const cents = parseMoney(t); if (cents !== null) onUpdate({ amount_cents: cents }); }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.colors.text.tertiary}
            />
            <Pressable onPress={onDelete} hitSlop={8}>
              <Trash2 size={18} color={theme.colors.danger} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.displayRow}>
          <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]} numberOfLines={1}>
            {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.description || 'Unnamed item'}
          </Text>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
            ${centsToDisplay(item.amount_cents)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function SummaryRow({ label, value, onChange, theme }: { label: string; value: number; onChange: (v: number) => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>{label}</Text>
      <TextInput
        style={[styles.summaryInput, theme.typography.body, { color: theme.colors.text.primary, borderColor: theme.colors.border.default }]}
        value={centsToDisplay(value)}
        onChangeText={(t) => { const cents = parseMoney(t); if (cents !== null && cents >= 0) onChange(cents); }}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={theme.colors.text.tertiary}
      />
    </View>
  );
}

function PersonRow({ id, name, avatarUri, selected, onToggle, theme }: { id: string; name: string; avatarUri: string | null; selected: boolean; onToggle: () => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.row, { backgroundColor: theme.colors.bg.surface, borderColor: selected ? theme.colors.accent : theme.colors.border.default }]}
    >
      <Avatar id={id} displayName={name} uri={avatarUri} size="sm" />
      <Text style={[theme.typography.body, { flex: 1, color: theme.colors.text.primary }]}>{name}</Text>
      <View style={[styles.check, { backgroundColor: selected ? theme.colors.accent : 'transparent', borderColor: selected ? theme.colors.accent : theme.colors.border.strong }]}>
        {selected && <Check size={14} color="#fff" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 48 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 14, justifyContent: 'center' },
  taxTipCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, width: 100, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2 },
  itemCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  displayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editRow: { gap: 10 },
  editMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  descInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, width: 44, textAlign: 'center' },
  priceInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, gap: 12 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center' },
  guestInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
});
