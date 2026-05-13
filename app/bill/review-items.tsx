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
import { Plus, Trash2, ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useBillDraft } from '@/features/bills/context/BillDraftContext';
import { parseMoney } from '@/features/bills/utils/parse-money';
import type { BillItem } from '@/features/bills/types';

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function ReviewItemsScreen() {
  const theme = useTheme();
  const { draft, setItems, setField } = useBillDraft();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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

  function handleNext() {
    const valid = draft.items.filter((i) => i.description.trim() && i.amount_cents > 0);
    if (valid.length === 0) {
      Alert.alert('No items', 'Add at least one item with a price.');
      return;
    }
    if (valid.length < draft.items.length) {
      setItems(valid);
    }
    router.push('/bill/participants');
  }

  const subtotal = draft.items.reduce((s, i) => s + i.amount_cents * i.quantity, 0);

  return (
    <Screen
      header={{ title: 'Review items', showBack: true }}
      contentPadding={0}
      scroll={false}
    >
      <FlatList
        data={draft.items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 0, gap: 8 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[theme.typography.body, { color: theme.colors.text.tertiary }]}>
              No items yet. Tap + to add one.
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
          <View style={{ marginTop: 8 }}>
            <Pressable
              onPress={addItem}
              style={[
                styles.addRow,
                { borderColor: theme.colors.accent },
              ]}
            >
              <Plus size={16} color={theme.colors.accent} />
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>
                Add item
              </Text>
            </Pressable>
          </View>
        }
      />

      {/* Tax / Tip / Summary */}
      <View style={[styles.footer, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.surface }]}>
        <SummaryRow
          label="Tax"
          value={draft.taxCents}
          onChange={(v) => setField('taxCents', v)}
          theme={theme}
        />
        <SummaryRow
          label="Tip"
          value={draft.tipCents}
          onChange={(v) => setField('tipCents', v)}
          theme={theme}
        />
        <View style={[styles.totalRow, { borderTopColor: theme.colors.border.default }]}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
            Total
          </Text>
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
            ${((subtotal + draft.taxCents + draft.tipCents) / 100).toFixed(2)}
          </Text>
        </View>
        <Button
          label="Next: participants"
          variant="primary"
          onPress={handleNext}
          trailingIcon={<ChevronRight size={16} color="#fff" />}
        />
      </View>
    </Screen>
  );
}

function ItemRow({
  item,
  isEditing,
  onPress,
  onUpdate,
  onDelete,
  theme,
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
      style={[
        styles.itemCard,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: isEditing ? theme.colors.accent : theme.colors.border.default,
        },
      ]}
    >
      {isEditing ? (
        <View style={styles.editRow}>
          <TextInput
            style={[
              styles.descInput,
              theme.typography.body,
              { color: theme.colors.text.primary, borderColor: theme.colors.border.default },
            ]}
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
                style={[
                  styles.qtyInput,
                  theme.typography.body,
                  { color: theme.colors.text.primary, borderColor: theme.colors.border.default },
                ]}
                value={String(item.quantity)}
                onChangeText={(t) => {
                  const n = parseInt(t, 10);
                  if (!isNaN(n) && n > 0) onUpdate({ quantity: n });
                }}
                keyboardType="numeric"
              />
            </View>
            <TextInput
              style={[
                styles.priceInput,
                theme.typography.body,
                { color: theme.colors.text.primary, borderColor: theme.colors.border.default },
              ]}
              value={centsToDisplay(item.amount_cents)}
              onChangeText={(t) => {
                const cents = parseMoney(t);
                if (cents !== null) onUpdate({ amount_cents: cents });
              }}
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
          <Text
            style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}
            numberOfLines={1}
          >
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

function SummaryRow({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.summaryInput,
          theme.typography.body,
          { color: theme.colors.text.primary, borderColor: theme.colors.border.default },
        ]}
        value={centsToDisplay(value)}
        onChangeText={(t) => {
          const cents = parseMoney(t);
          if (cents !== null && cents >= 0) onChange(cents);
        }}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={theme.colors.text.tertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 48 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    justifyContent: 'center',
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  displayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editRow: { gap: 10 },
  editMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  descInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 44,
    textAlign: 'center',
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'right',
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: 100,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
