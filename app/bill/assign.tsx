import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Users } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useBillDraft } from '@/features/bills/context/BillDraftContext';
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
  const { draft, setItemAssignees } = useBillDraft();
  const [viewMode, setViewMode] = useState<ViewMode>('item');

  function toggleAssignee(itemKey: string, pKey: string) {
    const current = draft.assignments[itemKey] ?? {};
    const next = { ...current };
    if (next[pKey]) {
      delete next[pKey];
    } else {
      next[pKey] = 1;
    }
    setItemAssignees(itemKey, next);
  }

  function assignAll(itemKey: string) {
    const all: Record<string, number> = {};
    for (const p of draft.participants) {
      all[participantKey(p)] = 1;
    }
    setItemAssignees(itemKey, all);
  }

  function handleNext() {
    const unassigned = draft.items.filter((_, i) => {
      const assignees = draft.assignments[String(i)] ?? {};
      return Object.keys(assignees).length === 0;
    });
    if (unassigned.length > 0) {
      Alert.alert(
        'Unassigned items',
        `${unassigned.length} item(s) have no one assigned. Assign all items before continuing.`,
      );
      return;
    }
    router.push('/bill/totals');
  }

  const tabs: Array<{ id: ViewMode; label: string }> = [
    { id: 'item', label: 'By item' },
    { id: 'person', label: 'By person' },
  ];

  return (
    <Screen header={{ title: 'Assign items', showBack: true }} contentPadding={0}>
      {/* Tab toggle */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border.default }]}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setViewMode(tab.id)}
            style={[
              styles.tab,
              {
                borderBottomColor:
                  viewMode === tab.id ? theme.colors.accent : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                theme.typography.bodyMedium,
                {
                  color:
                    viewMode === tab.id
                      ? theme.colors.accent
                      : theme.colors.text.secondary,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {viewMode === 'item' ? (
        <FlatList
          data={draft.items}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}
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
          ListFooterComponent={
            <Button
              label="Next: review totals"
              variant="primary"
              onPress={handleNext}
              trailingIcon={<ChevronRight size={16} color="#fff" />}
              style={{ marginTop: 8 }}
            />
          }
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}>
          {draft.participants.map((participant) => {
            const pKey = participantKey(participant);
            const myItemCount = draft.items.filter(
              (_, i) => !!draft.assignments[String(i)]?.[pKey],
            ).length;
            const myTotal = draft.items.reduce((sum, item, i) => {
              return draft.assignments[String(i)]?.[pKey] ? sum + item.amount_cents : sum;
            }, 0);
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
          <Button
            label="Next: review totals"
            variant="primary"
            onPress={handleNext}
            trailingIcon={<ChevronRight size={16} color="#fff" />}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

function ItemAssignCard({
  item,
  itemKey,
  participants,
  assigned,
  onToggle,
  onAssignAll,
  theme,
}: {
  item: BillItem;
  itemKey: string;
  participants: BillParticipant[];
  assigned: Record<string, number>;
  onToggle: (pKey: string) => void;
  onAssignAll: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const assigneeCount = Object.keys(assigned).length;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: assigneeCount > 0 ? theme.colors.border.default : theme.colors.warning,
        },
      ]}
    >
      {/* Item header */}
      <View style={styles.itemHeader}>
        <Text
          style={[theme.typography.bodyMedium, { flex: 1, color: theme.colors.text.primary }]}
          numberOfLines={2}
        >
          {item.quantity > 1 ? `${item.quantity}× ` : ''}
          {item.description || 'Item'}
        </Text>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          ${centsToDisplay(item.amount_cents)}
        </Text>
      </View>

      {/* Assignee chips */}
      <View style={styles.chips}>
        {participants.map((p) => {
          const pKey = participantKey(p);
          const isAssigned = !!assigned[pKey];
          return (
            <Pressable
              key={pKey}
              onPress={() => onToggle(pKey)}
              style={[
                styles.chip,
                {
                  backgroundColor: isAssigned ? theme.colors.accent : theme.colors.bg.subtle,
                  borderColor: isAssigned ? theme.colors.accent : theme.colors.border.default,
                },
              ]}
            >
              {p.type === 'user' && (
                <Avatar id={p.id} displayName={p.display_name} uri={p.avatar_url} size="xs" />
              )}
              <Text
                style={[
                  theme.typography.caption,
                  { color: isAssigned ? '#fff' : theme.colors.text.secondary },
                ]}
              >
                {participantName(p)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Quick-assign all */}
      <Pressable onPress={onAssignAll} style={styles.assignAll}>
        <Users size={12} color={theme.colors.text.tertiary} />
        <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
          Assign to everyone
        </Text>
      </Pressable>
    </View>
  );
}

function PersonAssignCard({
  participant,
  pKey,
  items,
  assignments,
  onToggle,
  myItemCount,
  myTotal,
  theme,
}: {
  participant: BillParticipant;
  pKey: string;
  items: BillItem[];
  assignments: Record<string, Record<string, number>>;
  onToggle: (itemKey: string) => void;
  myItemCount: number;
  myTotal: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const name = participantName(participant);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
      ]}
    >
      {/* Person header */}
      <View style={styles.personHeader}>
        {participant.type === 'user' && (
          <Avatar
            id={participant.id}
            displayName={participant.display_name}
            uri={participant.avatar_url}
            size="sm"
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
            {name}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
            {myItemCount} item{myItemCount === 1 ? '' : 's'} · ${centsToDisplay(myTotal)}
          </Text>
        </View>
      </View>

      {/* Item list with checkboxes */}
      {items.map((item, index) => {
        const iKey = String(index);
        const isChecked = !!assignments[iKey]?.[pKey];
        return (
          <Pressable
            key={iKey}
            onPress={() => onToggle(iKey)}
            style={[
              styles.itemRow,
              { borderTopColor: theme.colors.border.default },
            ]}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: isChecked ? theme.colors.accent : 'transparent',
                  borderColor: isChecked ? theme.colors.accent : theme.colors.border.default,
                },
              ]}
            >
              {isChecked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
            </View>
            <Text
              style={[
                theme.typography.body,
                { flex: 1, color: isChecked ? theme.colors.text.primary : theme.colors.text.secondary },
              ]}
              numberOfLines={1}
            >
              {item.quantity > 1 ? `${item.quantity}× ` : ''}
              {item.description || 'Item'}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
              ${centsToDisplay(item.amount_cents)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  assignAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
