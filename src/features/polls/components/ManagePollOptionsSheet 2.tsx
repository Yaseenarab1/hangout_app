import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { X, Trash2, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { ActivityOptionPicker, type ActivityOption } from './ActivityOptionPicker';
import {
  CuisineOptionPicker,
  RestaurantSearchPicker,
  type CuisineOption,
  type RestaurantOption,
} from '@/features/food';
import type { PollKind, PollOption } from '../types';

export type ExistingOption = {
  id: string;
  label: string;
  voteCount: number;
  metadata: Record<string, unknown>;
};

export type ManagePollOptionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  pollKind: PollKind;
  /** Options already on the poll. */
  existing: ExistingOption[];
  /** Called once the user saves: receives ids to remove and new options to add. */
  onSave: (changes: {
    removeOptionIds: string[];
    addOptions: Array<{
      label: string;
      metadata?: Record<string, unknown>;
    }>;
  }) => void;
  isSubmitting?: boolean;
};

/**
 * Modal sheet that opens from PollCard's "Manage options" button.
 *
 * Layout:
 *   - Existing options listed at top, each with a ✕ to mark for removal
 *     (marked-for-removal items go grey/strikethrough — not actually deleted
 *     until the user taps Save)
 *   - Below: the appropriate picker for adding NEW options
 *   - Bottom Save button applies all changes (removes + adds) atomically
 *
 * This replaces AddOptionSheet — addition AND removal happen here, and the
 * user sees what already exists so they aren't blind-adding duplicates.
 */
export function ManagePollOptionsSheet({
  visible,
  onClose,
  pollKind,
  existing,
  onSave,
  isSubmitting,
}: ManagePollOptionsSheetProps): React.ReactElement {
  const theme = useTheme();

  const [pendingRemoval, setPendingRemoval] = useState<Set<string>>(new Set());
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [cuisineOptions, setCuisineOptions] = useState<CuisineOption[]>([]);
  const [restaurantOptions, setRestaurantOptions] = useState<RestaurantOption[]>([]);

  const reset = (): void => {
    setPendingRemoval(new Set());
    setActivityOptions([]);
    setCuisineOptions([]);
    setRestaurantOptions([]);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  // Existing labels NOT marked for removal — used to filter dupes from picker
  const remainingExistingLabels = useMemo(
    () =>
      new Set(
        existing
          .filter((o) => !pendingRemoval.has(o.id))
          .map((o) => o.label.toLowerCase()),
      ),
    [existing, pendingRemoval],
  );

  const toggleRemoval = (optionId: string): void => {
    setPendingRemoval((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  const handleSave = (): void => {
    const dedupe = <T extends { label?: string; name?: string }>(items: T[]): T[] =>
      items.filter((item) => {
        const label = ('label' in item && item.label) || ('name' in item && item.name) || '';
        return !remainingExistingLabels.has(label.toLowerCase());
      });

    let addOptions: Array<{ label: string; metadata?: Record<string, unknown> }> = [];

    if (pollKind === 'activity') {
      addOptions = dedupe(activityOptions).map((o) => ({
        label: o.label,
        metadata: { emoji: o.emoji ?? null, catalogId: o.catalogId ?? null },
      }));
    } else if (pollKind === 'cuisine') {
      addOptions = dedupe(cuisineOptions).map((o) => ({
        label: o.label,
        metadata: { emoji: o.emoji ?? null, catalogId: o.catalogId ?? null },
      }));
    } else if (pollKind === 'restaurant') {
      addOptions = dedupe(restaurantOptions).map((o) => ({
        label: o.name,
        metadata: {
          placeId: o.placeId ?? null,
          address: o.address ?? null,
          rating: o.rating ?? null,
          priceLevel: o.priceLevel ?? null,
          primaryType: o.primaryType ?? null,
          mapsUrl: o.mapsUrl ?? null,
          isCustom: o.isCustom ?? false,
        },
      }));
    }

    onSave({
      removeOptionIds: Array.from(pendingRemoval),
      addOptions,
    });
  };

  const newCount =
    pollKind === 'activity'
      ? activityOptions.length
      : pollKind === 'cuisine'
        ? cuisineOptions.length
        : restaurantOptions.length;
  const removeCount = pendingRemoval.size;
  const hasChanges = newCount > 0 || removeCount > 0;

  const title =
    pollKind === 'activity'
      ? 'Manage activities'
      : pollKind === 'cuisine'
        ? 'Manage cuisines'
        : 'Manage options';

  // Build save button label that reflects what's about to happen
  const saveLabel = (() => {
    if (!hasChanges) return 'Make a change to save';
    const parts: string[] = [];
    if (newCount > 0) parts.push(`add ${newCount}`);
    if (removeCount > 0) parts.push(`remove ${removeCount}`);
    return `Save (${parts.join(' & ')})`;
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.colors.border.default },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[theme.typography.h3, { color: theme.colors.text.primary }]}
            >
              {title}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.tertiary, marginTop: 2 },
              ]}
            >
              Edit, remove, or add options. Changes apply when you save.
            </Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={8}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* Existing options section */}
        {existing.length > 0 ? (
          <View style={styles.existingSection}>
            <Text
              style={[
                theme.typography.bodySmallMedium,
                { color: theme.colors.text.secondary, marginBottom: 8 },
              ]}
            >
              Already on the poll
            </Text>
            <ScrollView
              horizontal={false}
              style={{ maxHeight: 140 }}
              showsVerticalScrollIndicator
            >
              <View style={{ gap: 6 }}>
                {existing.map((opt) => {
                  const markedForRemoval = pendingRemoval.has(opt.id);
                  const meta = opt.metadata as { emoji?: string | null };
                  return (
                    <View
                      key={opt.id}
                      style={[
                        styles.existingRow,
                        {
                          backgroundColor: markedForRemoval
                            ? theme.colors.error + '10'
                            : theme.colors.bg.surface,
                          borderColor: markedForRemoval
                            ? theme.colors.error + '60'
                            : theme.colors.border.default,
                          opacity: markedForRemoval ? 0.6 : 1,
                        },
                      ]}
                    >
                      {meta.emoji ? (
                        <Text style={{ fontSize: 18, marginRight: 8 }}>
                          {meta.emoji}
                        </Text>
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            theme.typography.body,
                            {
                              color: theme.colors.text.primary,
                              textDecorationLine: markedForRemoval
                                ? 'line-through'
                                : 'none',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                        {opt.voteCount > 0 ? (
                          <Text
                            style={[
                              theme.typography.caption,
                              {
                                color: markedForRemoval
                                  ? theme.colors.error
                                  : theme.colors.text.tertiary,
                                marginTop: 2,
                              },
                            ]}
                          >
                            {opt.voteCount}{' '}
                            {opt.voteCount === 1 ? 'vote' : 'votes'}
                            {markedForRemoval ? ' will be lost' : ''}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => toggleRemoval(opt.id)}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.removeBtn,
                          {
                            backgroundColor: markedForRemoval
                              ? theme.colors.error + '15'
                              : theme.colors.bg.subtle,
                            borderColor: markedForRemoval
                              ? theme.colors.error
                              : theme.colors.border.default,
                          },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        {markedForRemoval ? (
                          <Text
                            style={[
                              theme.typography.caption,
                              { color: theme.colors.error, fontWeight: '600' },
                            ]}
                          >
                            Undo
                          </Text>
                        ) : (
                          <Trash2 size={16} color={theme.colors.text.secondary} />
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* Picker for new options */}
        <View style={styles.pickerSection}>
          <View style={styles.addHeader}>
            <Plus size={16} color={theme.colors.accent} />
            <Text
              style={[
                theme.typography.bodySmallMedium,
                { color: theme.colors.text.secondary, marginLeft: 6 },
              ]}
            >
              Add new
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            {pollKind === 'activity' ? (
              <ActivityOptionPicker
                value={activityOptions}
                onChange={setActivityOptions}
                min={1}
                max={10}
              />
            ) : pollKind === 'cuisine' ? (
              <CuisineOptionPicker
                value={cuisineOptions}
                onChange={setCuisineOptions}
                min={1}
                max={10}
              />
            ) : (
              <RestaurantSearchPicker
                value={restaurantOptions}
                onChange={setRestaurantOptions}
                min={1}
                max={10}
              />
            )}
          </View>
        </View>

        {/* Bottom save bar */}
        <View
          style={[styles.footer, { borderTopColor: theme.colors.border.default }]}
        >
          <Button
            label={isSubmitting ? 'Saving…' : saveLabel}
            onPress={handleSave}
            disabled={!hasChanges || isSubmitting}
            loading={isSubmitting}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  existingSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  existingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  removeBtn: {
    minWidth: 36,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
