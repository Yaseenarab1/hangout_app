import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useBillDraft } from '@/features/bills/context/BillDraftContext';
import { useCreateItemizedBill } from '@/features/bills/hooks/useCreateItemizedBill';
import { computeItemShares, type ItemAssignment } from '@/features/bills/utils/compute-item-shares';
import type { BillParticipant } from '@/features/bills/types';

function participantKey(p: BillParticipant): string {
  return p.type === 'user' ? `user:${p.id}` : `guest:${p.tempId}`;
}

function participantName(p: BillParticipant): string {
  return p.type === 'user' ? p.display_name : `${p.name} (guest)`;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function TotalsScreen() {
  const theme = useTheme();
  const { draft, setField } = useBillDraft();
  const createBill = useCreateItemizedBill(draft.hangoutId);
  const [description, setDescription] = useState(draft.description || '');

  const subtotal = useMemo(
    () => draft.items.reduce((s, i) => s + i.amount_cents * i.quantity, 0),
    [draft.items],
  );
  const grandTotal = subtotal + draft.taxCents + draft.tipCents;

  // Compute per-person totals using computeItemShares
  const perPerson = useMemo<Map<string, number>>(() => {
    const itemAssignments: ItemAssignment[] = draft.items.map((item, i) => {
      const assignees = new Map(
        Object.entries(draft.assignments[String(i)] ?? {}).map(([k, w]) => [k, w]),
      );
      if (assignees.size === 0) {
        // Fallback: split among all
        for (const p of draft.participants) {
          assignees.set(participantKey(p), 1);
        }
      }
      return { amountCents: item.amount_cents * item.quantity, assignees };
    });

    return computeItemShares({
      items: itemAssignments,
      taxCents: draft.taxCents,
      tipCents: draft.tipCents,
    });
  }, [draft]);

  function handleSave() {
    const desc = description.trim();
    if (!desc) {
      Alert.alert('Add a description', 'e.g. "Dinner at Shake Shack"');
      return;
    }

    setField('description', desc);

    const shares = draft.participants.map((p) => {
      const pKey = participantKey(p);
      const amount = perPerson.get(pKey) ?? 0;
      if (p.type === 'user') {
        return { user_id: p.id, amount_cents: amount };
      } else {
        return { guest_name: p.name, amount_cents: amount };
      }
    });

    createBill.mutate(
      {
        hangout_id: draft.hangoutId,
        payer_id: draft.payerId,
        description: desc,
        paid_at: draft.paidAt,
        tax_cents: draft.taxCents,
        tip_cents: draft.tipCents,
        items: draft.items,
        shares,
      },
      {
        onSuccess() {
          if (draft.hangoutId) {
            router.dismiss(5); // pop back to hangout bills
          } else {
            router.replace('/profile/bills');
          }
        },
        onError(err) {
          Alert.alert('Error', err.message);
        },
      },
    );
  }

  return (
    <Screen header={{ title: 'Review & save', showBack: true }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Who paid? */}
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.secondary, marginBottom: 8 }]}>
          Who paid?
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
        >
          {draft.participants
            .filter((p) => p.type === 'user')
            .map((p) => {
              if (p.type !== 'user') return null;
              const isSelected = draft.payerId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setField('payerId', p.id)}
                  style={[
                    styles.payerChip,
                    {
                      borderColor: isSelected ? theme.colors.accent : theme.colors.border.default,
                      backgroundColor: isSelected ? theme.colors.accentSubtle : theme.colors.bg.surface,
                    },
                  ]}
                >
                  <Avatar id={p.id} displayName={p.display_name} uri={p.avatar_url} size="xs" />
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      { color: isSelected ? theme.colors.accent : theme.colors.text.primary, marginLeft: 6 },
                    ]}
                  >
                    {p.display_name}
                  </Text>
                  {isSelected && <Check size={14} color={theme.colors.accent} style={{ marginLeft: 4 }} />}
                </Pressable>
              );
            })}
        </ScrollView>

        {/* Description */}
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.secondary, marginBottom: 6 }]}>
          Bill description
        </Text>
        <TextInput
          style={[
            styles.descInput,
            theme.typography.body,
            {
              color: theme.colors.text.primary,
              borderColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.surface,
            },
          ]}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Dinner at Shake Shack"
          placeholderTextColor={theme.colors.text.tertiary}
        />

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
          <SummaryLine label="Subtotal" cents={subtotal} theme={theme} />
          {draft.taxCents > 0 && <SummaryLine label="Tax" cents={draft.taxCents} theme={theme} />}
          {draft.tipCents > 0 && <SummaryLine label="Tip" cents={draft.tipCents} theme={theme} />}
          <View style={[styles.totalLine, { borderTopColor: theme.colors.border.default }]}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Total</Text>
            <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
              ${centsToDisplay(grandTotal)}
            </Text>
          </View>
        </View>

        {/* Per-person breakdown */}
        <Text
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, marginTop: 20, marginBottom: 10 }]}
        >
          Each person owes
        </Text>
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
                      <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
                        {p.name[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={[theme.typography.body, { flex: 1, color: theme.colors.text.primary }]}>
                    {participantName(p)}
                  </Text>
                  <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                    ${centsToDisplay(amount)}
                  </Text>
                </View>
                {!isLast && (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default, marginLeft: 48 }} />
                )}
              </View>
            );
          })}
        </View>

        <Button
          label="Save bill"
          variant="primary"
          loading={createBill.isPending}
          onPress={handleSave}
          style={{ marginTop: 24 }}
        />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => router.dismissAll()}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </Screen>
  );
}

function SummaryLine({ label, cents, theme }: { label: string; cents: number; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>{label}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
        ${centsToDisplay(cents)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  payerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  descInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  sharesCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  guestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
