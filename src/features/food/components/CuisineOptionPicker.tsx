import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Plus, Search as SearchIcon, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Input, Button } from '@/components/ui';
import { SelectionReviewSheet } from '@/components/ui/SelectionReviewSheet';
import { CUISINE_CATALOG, CUISINE_CATEGORIES } from '../catalog/cuisines';
import type { CuisineOption } from '../types';
import type { CuisineCatalogItem } from '../catalog/cuisines';

export type CuisineOptionPickerProps = {
  value: CuisineOption[];
  onChange: (options: CuisineOption[]) => void;
  min?: number;
  max?: number;
};

export function CuisineOptionPicker({
  value,
  onChange,
  min = 2,
  max = 8,
}: CuisineOptionPickerProps): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const selectedCatalogIds = useMemo(
    () => new Set(value.map((v) => v.catalogId).filter(Boolean) as string[]),
    [value],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return CUISINE_CATALOG;
    return CUISINE_CATALOG.filter((c) => c.label.toLowerCase().includes(q));
  }, [q]);

  const grouped = useMemo(() => {
    const map = new Map<CuisineCatalogItem['category'], CuisineCatalogItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filtered]);

  const isAtMax = value.length >= max;

  const addItem = (item: CuisineCatalogItem): void => {
    if (isAtMax || selectedCatalogIds.has(item.id)) return;
    onChange([
      ...value,
      {
        id: `cat:${item.id}`,
        label: item.label,
        emoji: item.emoji,
        catalogId: item.id,
      },
    ]);
  };

  const remove = (optId: string): void => {
    onChange(value.filter((o) => o.id !== optId));
  };

  const addCustom = (): void => {
    const label = customLabel.trim();
    if (!label || isAtMax) return;
    onChange([...value, { id: `custom:${Date.now()}`, label }]);
    setCustomLabel('');
    setShowCustomInput(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Tappable selected header */}
      {value.length > 0 ? (
        <Pressable
          onPress={() => setShowReview(true)}
          style={({ pressed }) => [
            styles.selectedHeader,
            {
              backgroundColor: theme.colors.accent + '10',
              borderColor: theme.colors.accent + '40',
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[
                theme.typography.bodySmallMedium,
                { color: theme.colors.text.primary },
              ]}
            >
              {value.length} selected
              <Text style={{ color: theme.colors.text.tertiary, fontWeight: '400' }}>
                {'  '}of {max}
              </Text>
            </Text>
            <Text
              style={[
                theme.typography.caption,
                {
                  color:
                    value.length < min
                      ? theme.colors.warning
                      : theme.colors.text.tertiary,
                  marginTop: 2,
                },
              ]}
            >
              {value.length < min
                ? `Add ${min - value.length} more to continue`
                : 'Tap to review or remove'}
            </Text>
          </View>
          <ChevronRight size={18} color={theme.colors.text.tertiary} />
        </Pressable>
      ) : null}

      <Input
        placeholder="Search cuisines"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        trailing={<SearchIcon size={18} color={theme.colors.text.tertiary} />}
        containerStyle={{ marginBottom: 12 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {CUISINE_CATEGORIES.map((cat) => {
          const items = grouped.get(cat.id);
          if (!items || items.length === 0) return null;
          return (
            <View key={cat.id} style={{ marginBottom: 16 }}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text
                  style={[
                    theme.typography.bodySmallMedium,
                    { color: theme.colors.text.secondary, marginLeft: 6 },
                  ]}
                >
                  {cat.label}
                </Text>
              </View>
              <View style={styles.chipsWrap}>
                {items.map((item) => {
                  const isSelected = selectedCatalogIds.has(item.id);
                  const disabled = !isSelected && isAtMax;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        isSelected ? remove(`cat:${item.id}`) : addItem(item)
                      }
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.catalogChip,
                        {
                          backgroundColor: isSelected
                            ? cat.color + '25'
                            : cat.color + '10',
                          borderColor: isSelected ? cat.color : cat.color + '40',
                          opacity: disabled ? 0.4 : 1,
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={{ fontSize: 16, marginRight: 6 }}>{item.emoji}</Text>
                      <Text
                        style={[
                          theme.typography.bodySmall,
                          { color: theme.colors.text.primary },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={{ marginBottom: 24 }}>
          {showCustomInput ? (
            <View>
              <Input
                placeholder="Type a cuisine"
                value={customLabel}
                onChangeText={setCustomLabel}
                autoFocus
                maxLength={100}
                onSubmitEditing={addCustom}
                returnKeyType="done"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Button
                  label="Add"
                  onPress={addCustom}
                  disabled={!customLabel.trim() || isAtMax}
                  size="sm"
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setShowCustomInput(false);
                    setCustomLabel('');
                  }}
                  size="sm"
                />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowCustomInput(true)}
              disabled={isAtMax}
              style={({ pressed }) => [
                styles.addCustomButton,
                {
                  borderColor: theme.colors.border.default,
                  opacity: isAtMax ? 0.4 : 1,
                },
                pressed && { backgroundColor: theme.colors.bg.subtle },
              ]}
            >
              <Plus size={16} color={theme.colors.text.secondary} />
              <Text
                style={[
                  theme.typography.bodySmall,
                  { color: theme.colors.text.secondary, marginLeft: 6 },
                ]}
              >
                Add a cuisine
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <SelectionReviewSheet
        visible={showReview}
        onClose={() => setShowReview(false)}
        items={value.map((v) => ({ id: v.id, label: v.label, emoji: v.emoji }))}
        min={min}
        max={max}
        onRemove={remove}
        itemLabel="cuisines"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catalogChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  addCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
