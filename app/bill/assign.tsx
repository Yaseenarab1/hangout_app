import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Users, Check } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useBillDraft } from '@/features/bills/context/BillDraftContext';
import { useCreateItemizedBill } from '@/features/bills/hooks/useCreateItemizedBill';
import { useUpdateItemizedBill } from '@/features/bills/hooks/useUpdateItemizedBill';
import { computeItemShares, type ItemAssignment } from '@/features/bills/utils/compute-item-shares';
import type { BillItem, BillParticipant } from '@/features/bills/types';

function participantKey(p: BillParticipant): string {
  return p.type === 'user' ? `user:${p.id}` : `guest:${p.tempId}`;
}

function participantName(p: BillParticipant): string {
  return p.type === 'user' ? p.display_name : p.name;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

type ViewMode = 'item' | 'person';

export default function AssignScreen() {
  const theme = useTheme();
  const { draft, setItemAssignees, setField } = useBillDraft();
  const createBill = useCreateItemizedBill(draft.hangoutId);
  const updateBill = useUpdateItemizedBill(draft.hangoutId);
  const isPending = createBill.isPending || updateBill.isPending;
  const [viewMode, setViewMode] = useState<ViewMode>('item');
  const [description, setDescription] = useState(draft.description || '');

  const subtotal = useMemo(
    () => draft.items.reduce((s, i) => s + i.amount_cents * i.quantity, 0),
    [draft.items],
  );
  const grandTotal = subtotal + draft.taxCents + draft.tipCents;

  const perPerson = useMemo<Map<string, number>>(() => {
    const itemAssignments: ItemAssignment[] = draft.items.map((item, i) => {
      const assignees = new Map(
        Object.entries(draft.assignments[String(i)] ?? {}).map(([k, w]) => [k, w]),
      );
      if (assignees.size === 0) {
        for (const p of draft.participants) assignees.set(participantKey(p), 1);
      }
      return { amountCents: item.amount_cents * item.quantity, assignees };
    });
    return computeItemShares({ items: itemAssignments, taxCents: draft.taxCents, tipCents: draft.tipCents });
  }, [draft]);

  function toggleAssignee(itemKey: string, pKey: string) {
    const current = draft.assignments[itemKey] ?? {};
    const next = { ...current };
    if (next[pKey]) { delete next[pKey]; } else { next[pKey] = 1; }
    setItemAssignees(itemKey, next);
  }

  function assignAll(itemKey: string) {
    const all: Record<string, number> = {};
    for (const p of draft.participants) all[participantKey(p)] = 1;
    setItemAssignees(itemKey, all);
  }

  function handleSave() {
    const desc = description.trim();
    if (!desc) {
      Alert.alert('Add a description', 'e.g. "Dinner at Shake Shack"');
      return;
    }

    const unassigned = draft.items.filter((_, i) => Object.keys(draft.assignments[String(i)] ?? {}).length === 0);
    if (unassigned.length > 0) {
      Alert.alert('Unassigned items', `${unassigned.length} item(s) have no one assigned.`);
      return;
    }

    setField('description', desc);

    const shares = draft.participants.map((p) => {
      const pKey = participantKey(p);
      const amount = perPerson.get(pKey) ?? 0;
      return p.type === 'user'
        ? { user_id: p.id, amount_cents: amount }
        : { guest_name: p.name, amount_cents: amount };
    });

    const billParams = {
      hangout_id: draft.hangoutId,
      payer_id: draft.payerId,
      description: desc,
      paid_at: draft.paidAt,
      tax_cents: draft.taxCents,
      tip_cents: draft.tipCents,
      items: draft.items,
      shares,
    };

    function onSuccess() {
      const hangoutId = draft.hangoutId;
      if (hangoutId) {
        router.navigate(`/hangout/${hangoutId}/bills` as any);
      } else {
        router.navigate('/profile/bills' as any);
      }
    }
    function onError(err: Error) {
      Alert.alert('Error', err.message);
    }

    if (draft.billId) {
      updateBill.mutate({ billId: draft.billId, params: billParams }, { onSuccess, onError });
    } else {
      createBill.mutate(billParams, { onSuccess, onError });
    }
  }

  const tabs: Array<{ id: ViewMode; label: string }> = [
    { id: 'item', label: 'By item' },
    { id: 'person', label: 'By person' },
  ];

  const SaveFooter = (
    <View style={{ gap: 12, paddingHorizontal: 0, paddingTop: 16 }}>
      {/* Payer picker */}
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>Who paid?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        {draft.participants.filter((p) => p.type === 'user').map((p) => {
          if (p.type !== 'user') return null;
          const isSelected = draft.payerId === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setField('payerId', p.id)}
              style={[
                styles.payerChip,
                { borderColor: isSelected ? theme.colors.accent : theme.colors.border.default, backgroundColor: isSelected ? theme.colors.accentSubtle : theme.colors.bg.surface },
              ]}
            >
              <Avatar id={p.id} displayName={p.display_name} uri={p.avatar_url} size="xs" />
              <Text style={[theme.typography.bodySmall, { color: isSelected ? theme.colors.accent : theme.colors.text.primary, marginLeft: 6 }]}>
                {p.display_name}
              </Text>
              {isSelected && <Check size={14} color={theme.colors.accent} style={{ marginLeft: 4 }} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Description */}
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>Description</Text>
      <TextInput
        style={[styles.descInput, theme.typography.body, { color: theme.colors.text.primary, borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.surface }]}
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Dinner at Shake Shack"
        placeholderTextColor={theme.colors.text.tertiary}
      />

      {/* Per-person summary */}
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Each person owes</Text>
      <View style={[styles.sharesCard, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
        {draft.participants.map((p, i) => {
          const pKey = participantKey(p);
          const amount = perPerson.get(pKey) ?? 0;
          const isLast = i === draft.participants.length - 1;
          return (
            <View key={pKey}>
              <View style={styles.shareRow}>
                {p.type === 'user' ? (
                  <Avatar id={p.id} displayName={p.display_name} uri={p.avatar_url} size="sm" />
                ) : (
                  <View style={styles.guestAvatar}>
                    <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>{p.name[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <Text style={[theme.typography.body, { flex: 1, color: theme.colors.text.primary }]}>
                  {p.type === 'user' ? p.display_name : `${p.name} (guest)`}
                </Text>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                  ${centsToDisplay(amount)}
                </Text>
              </View>
              {!isLast && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default, marginLeft: 48 }} />}
            </View>
          );
        })}
        <View style={[styles.totalLine, { borderTopColor: theme.colors.border.default }]}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.secondary }]}>Total</Text>
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>${centsToDisplay(grandTotal)}</Text>
        </View>
      </View>

      <Button label={draft.billId ? 'Update bill' : 'Save bill'} variant="primary" loading={isPending} onPress={handleSave} />
      <Button label="Cancel" variant="secondary" onPress={() => router.back()} style={{ marginBottom: 40 }} />
    </View>
  );

  return (
    <Screen header={{ title: 'Assign items', showBack: true }} contentPadding={0}>
      {/* Tab toggle */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border.default }]}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setViewMode(tab.id)}
            style={[styles.tab, { borderBottomColor: viewMode === tab.id ? theme.colors.accent : 'transparent' }]}
          >
            <Text style={[theme.typography.bodyMedium, { color: viewMode === tab.id ? theme.colors.accent : theme.colors.text.secondary }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {viewMode === 'item' ? (
        <FlatList
          data={draft.items}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: 0, gap: 12 }}
          renderItem={({ item, index }) => (
            <ItemAssignCard
              item={item}
              itemKey={String(index)}
              participants={draft.participants}
              assigned={draft.assignments[String(index)] ?? {}}
              onToggle={(pKey) => toggleAssignee(String(index), pKey)}
              onAssignAll={() => assignAll(String(index))}
              theme={theme}
            />
          )}
          ListFooterComponent={<View style={{ paddingHorizontal: 0 }}>{SaveFooter}</View>}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 0, gap: 12 }}>
          {draft.participants.map((participant) => {
            const pKey = participantKey(participant);
            const myItemCount = draft.items.filter((_, i) => !!draft.assignments[String(i)]?.[pKey]).length;
            const myTotal = draft.items.reduce((sum, item, i) => draft.assignments[String(i)]?.[pKey] ? sum + item.amount_cents : sum, 0);
            return (
              <PersonAssignCard
                key={pKey}
                participant={participant}
                pKey={pKey}
                items={draft.items}
                assignments={draft.assignments}
                onToggle={(itemKey) => toggleAssignee(itemKey, pKey)}
                myItemCount={myItemCount}
                myTotal={myTotal}
                theme={theme}
              />
            );
          })}
          {SaveFooter}
        </ScrollView>
      )}
    </Screen>
  );
}

function ItemAssignCard({ item, itemKey, participants, assigned, onToggle, onAssignAll, theme }: {
  item: BillItem; itemKey: string; participants: BillParticipant[];
  assigned: Record<string, number>; onToggle: (pKey: string) => void;
  onAssignAll: () => void; theme: ReturnType<typeof useTheme>;
}) {
  const assigneeCount = Object.keys(assigned).length;
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.bg.surface, borderColor: assigneeCount > 0 ? theme.colors.border.default : theme.colors.warning }]}>
      <View style={styles.itemHeader}>
        <Text style={[theme.typography.bodyMedium, { flex: 1, color: theme.colors.text.primary }]} numberOfLines={2}>
          {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.description || 'Item'}
        </Text>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>${centsToDisplay(item.amount_cents)}</Text>
      </View>
      <View style={styles.chips}>
        {participants.map((p) => {
          const pKey = participantKey(p);
          const isAssigned = !!assigned[pKey];
          return (
            <Pressable key={pKey} onPress={() => onToggle(pKey)} style={[styles.chip, { backgroundColor: isAssigned ? theme.colors.accent : theme.colors.bg.subtle, borderColor: isAssigned ? theme.colors.accent : theme.colors.border.default }]}>
              {p.type === 'user' && <Avatar id={p.id} displayName={p.display_name} uri={p.avatar_url} size="xs" />}
              <Text style={[theme.typography.caption, { color: isAssigned ? '#fff' : theme.colors.text.secondary }]}>
                {participantName(p)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={onAssignAll} style={styles.assignAll}>
        <Users size={12} color={theme.colors.text.tertiary} />
        <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>Assign to everyone</Text>
      </Pressable>
    </View>
  );
}

function PersonAssignCard({ participant, pKey, items, assignments, onToggle, myItemCount, myTotal, theme }: {
  participant: BillParticipant; pKey: string; items: BillItem[];
  assignments: Record<string, Record<string, number>>; onToggle: (itemKey: string) => void;
  myItemCount: number; myTotal: number; theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
      <View style={styles.personHeader}>
        {participant.type === 'user' && <Avatar id={participant.id} displayName={participant.display_name} uri={participant.avatar_url} size="sm" />}
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>{participantName(participant)}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
            {myItemCount} item{myItemCount === 1 ? '' : 's'} · ${centsToDisplay(myTotal)}
          </Text>
        </View>
      </View>
      {items.map((item, index) => {
        const iKey = String(index);
        const isChecked = !!assignments[iKey]?.[pKey];
        return (
          <Pressable key={iKey} onPress={() => onToggle(iKey)} style={[styles.itemRow, { borderTopColor: theme.colors.border.default }]}>
            <View style={[styles.checkbox, { backgroundColor: isChecked ? theme.colors.accent : 'transparent', borderColor: isChecked ? theme.colors.accent : theme.colors.border.default }]}>
              {isChecked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text style={[theme.typography.body, { flex: 1, color: isChecked ? theme.colors.text.primary : theme.colors.text.secondary }]} numberOfLines={1}>
              {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.description || 'Item'}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>${centsToDisplay(item.amount_cents)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
  assignAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  payerChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  descInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  sharesCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  guestAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center' },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
