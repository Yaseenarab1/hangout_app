import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Plus,
  X,
  Search as SearchIcon,
  Star,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Input, Button } from '@/components/ui';
import { SelectionReviewSheet } from '@/components/ui/SelectionReviewSheet';
import {
  ACTIVITY_CATALOG,
  ACTIVITY_CATEGORIES,
} from '../catalog/activities';
import {
  useMyCustomActivities,
  useSaveCustomActivity,
  useDeleteCustomActivity,
} from '../hooks/useCustomActivities';
import type { ActivityCatalogItem } from '../types';

export type ActivityOption = {
  id: string;
  label: string;
  emoji?: string;
  catalogId?: string;
  customId?: string;
};

export type ActivityOptionPickerProps = {
  value: ActivityOption[];
  onChange: (options: ActivityOption[]) => void;
  min?: number;
  max?: number;
};

/**
 * Activity option picker.
 *
 * What's new in 2C-final:
 *   - Selected header is now TAPPABLE — opens the SelectionReviewSheet for
 *     reviewing/removing selections in a roomy modal
 *   - Cleaner layout with the catalog getting the full screen height
 */
export function ActivityOptionPicker({
  value,
  onChange,
  min = 2,
  max = 8,
}: ActivityOptionPickerProps): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const customActivities = useMyCustomActivities();
  const saveCustomActivity = useSaveCustomActivity();
  const deleteCustomActivity = useDeleteCustomActivity();

  const selectedCatalogIds = useMemo(
    () => new Set(value.map((v) => v.catalogId).filter(Boolean) as string[]),
    [value],
  );
  const selectedCustomIds = useMemo(
    () => new Set(value.map((v) => v.customId).filter(Boolean) as string[]),
    [value],
  );

  const q = query.trim().toLowerCase();
  const filteredCatalog = useMemo(() => {
    if (!q) return ACTIVITY_CATALOG;
    return ACTIVITY_CATALOG.filter((i) => i.label.toLowerCase().includes(q));
  }, [q]);
  const filteredCustom = useMemo(() => {
    const all = customActivities.data ?? [];
    if (!q) return all;
    return all.filter((i) => i.label.toLowerCase().includes(q));
  }, [customActivities.data, q]);

  const groupedCatalog = useMemo(() => {
    const map = new Map<ActivityCatalogItem['category'], ActivityCatalogItem[]>();
    for (const item of filteredCatalog) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filteredCatalog]);

  const isAtMax = value.length >= max;

  const addCatalogItem = (item: ActivityCatalogItem): void => {
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

  const addCustomFromSaved = (custom: {
    id: string;
    label: string;
    emoji: string | null;
  }): void => {
    if (isAtMax || selectedCustomIds.has(custom.id)) return;
    onChange([
      ...value,
      {
        id: `custom:${custom.id}`,
        label: custom.label,
        emoji: custom.emoji ?? undefined,
        customId: custom.id,
      },
    ]);
  };

  const removeOption = (optId: string): void => {
    onChange(value.filter((o) => o.id !== optId));
  };

  const addCustom = (): void => {
    const label = customLabel.trim();
    if (!label || isAtMax) return;
    onChange([
      ...value,
      { id: `inline:${Date.now()}`, label },
    ]);
    saveCustomActivity.mutate({ label });
    setCustomLabel('');
    setShowCustomInput(false);
  };

  const handleDeleteSaved = (id: string, label: string): void => {
    Alert.alert(
      'Delete saved activity?',
      `"${label}" will no longer appear in your saved list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCustomActivity.mutate(id),
        },
      ],
    );
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

      {/* Search */}
      <Input
        placeholder="Search activities"
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
        {/* My saved */}
        {filteredCustom.length > 0 ? (
          <View style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Star size={14} color={theme.colors.accent} fill={theme.colors.accent} />
              <Text
                style={[
                  theme.typography.bodySmallMedium,
                  { color: theme.colors.text.secondary, marginLeft: 6 },
                ]}
              >
                My saved
              </Text>
            </View>
            <View style={styles.chipsWrap}>
              {filteredCustom.map((item) => {
                const isSelected = selectedCustomIds.has(item.id);
                const disabled = !isSelected && isAtMax;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      isSelected
                        ? removeOption(`custom:${item.id}`)
                        : addCustomFromSaved(item)
                    }
                    onLongPress={() => handleDeleteSaved(item.id, item.label)}
                    delayLongPress={400}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.catalogChip,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.accent + '20'
                          : theme.colors.bg.surface,
                        borderColor: isSelected
                          ? theme.colors.accent
                          : theme.colors.border.default,
                        opacity: disabled ? 0.4 : 1,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {item.emoji ? (
                      <Text style={{ fontSize: 16, marginRight: 6 }}>{item.emoji}</Text>
                    ) : null}
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
        ) : null}

        {/* Catalog */}
        {ACTIVITY_CATEGORIES.map((cat) => {
          const items = groupedCatalog.get(cat.id);
          if (!items || items.length === 0) return null;
          return (
            <View key={cat.id} style={styles.categorySection}>
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
                        isSelected
                          ? removeOption(`cat:${item.id}`)
                          : addCatalogItem(item)
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

        {/* Custom add */}
        <View style={[styles.categorySection, { marginBottom: 24 }]}>
          {showCustomInput ? (
            <View>
              <Input
                placeholder="Type your idea (e.g. mini golf night)"
                value={customLabel}
                onChangeText={setCustomLabel}
                autoFocus
                maxLength={100}
                onSubmitEditing={addCustom}
                returnKeyType="done"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Button
                  label="Add & save"
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
                Add your own idea
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Review sheet */}
      <SelectionReviewSheet
        visible={showReview}
        onClose={() => setShowReview(false)}
        items={value.map((v) => ({
          id: v.id,
          label: v.label,
          emoji: v.emoji,
        }))}
        min={min}
        max={max}
        onRemove={removeOption}
        itemLabel="activities"
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
  categorySection: { marginBottom: 16 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
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
