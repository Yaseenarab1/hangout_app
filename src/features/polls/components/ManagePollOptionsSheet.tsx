import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { ActivityOptionPicker, type ActivityOption } from './ActivityOptionPicker';
import { ActivityVenuePicker, type ActivityVenueOption } from './ActivityVenuePicker';
import { CuisineOptionPicker } from '@/features/food/components/CuisineOptionPicker';
import { RestaurantSearchPicker } from '@/features/food/components/RestaurantSearchPicker';
import type { CuisineOption } from '@/features/food/types';
import type { RestaurantOption } from '@/features/food/types';
import type { PollKind } from '../types';

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
  existing: ExistingOption[];
  onSave: (changes: {
    removeOptionIds: string[];
    addOptions: Array<{ label: string; metadata?: Record<string, unknown> }>;
  }) => void;
  isSubmitting?: boolean;
  venueQuery?: string;
  /** Drives "Suggested for your group" from this hangout's participants. */
  hangoutId?: string;
};

/**
 * Opens the picker preloaded with all existing options as already-selected.
 * User adds/removes from one unified list. On Save, we diff against the
 * original existing list to compute add/remove operations.
 */
export function ManagePollOptionsSheet({
  visible,
  onClose,
  pollKind,
  existing,
  onSave,
  isSubmitting,
  venueQuery,
  hangoutId,
}: ManagePollOptionsSheetProps): React.ReactElement {
  const theme = useTheme();

  const initialActivity = useMemo(
    () =>
      existing.map((o): ActivityOption & { __originalId: string } => {
        const m = o.metadata as { emoji?: string | null; catalogId?: string | null };
        return {
          id: m.catalogId ? `cat:${m.catalogId}` : `existing:${o.id}`,
          label: o.label,
          emoji: m.emoji ?? undefined,
          catalogId: m.catalogId ?? undefined,
          __originalId: o.id,
        };
      }),
    [existing],
  );

  const initialCuisine = useMemo(
    () =>
      existing.map((o): CuisineOption & { __originalId: string } => {
        const m = o.metadata as { emoji?: string | null; catalogId?: string | null };
        return {
          id: m.catalogId ? `cat:${m.catalogId}` : `existing:${o.id}`,
          label: o.label,
          emoji: m.emoji ?? undefined,
          catalogId: m.catalogId ?? undefined,
          __originalId: o.id,
        };
      }),
    [existing],
  );

  const initialRestaurant = useMemo(
    () =>
      existing.map((o): RestaurantOption & { __originalId: string } => {
        const m = o.metadata as {
          placeId?: string;
          address?: string | null;
          rating?: number | null;
          priceLevel?: number | null;
          primaryType?: string | null;
          mapsUrl?: string | null;
          isCustom?: boolean;
        };
        return {
          id: m.placeId ? `place:${m.placeId}` : `existing:${o.id}`,
          name: o.label,
          address: m.address ?? null,
          placeId: m.placeId,
          rating: m.rating ?? null,
          priceLevel: m.priceLevel ?? null,
          primaryType: m.primaryType ?? null,
          mapsUrl: m.mapsUrl ?? null,
          isCustom: m.isCustom ?? false,
          __originalId: o.id,
        };
      }),
    [existing],
  );

  const initialVenue = useMemo(
    () =>
      existing.map((o): ActivityVenueOption & { __originalId: string } => {
        const m = o.metadata as {
          placeId?: string;
          address?: string | null;
          rating?: number | null;
          priceLevel?: number | null;
          primaryType?: string | null;
          mapsUrl?: string | null;
          isCustom?: boolean;
        };
        return {
          id: m.placeId ? `place:${m.placeId}` : `existing:${o.id}`,
          name: o.label,
          address: m.address ?? null,
          placeId: m.placeId,
          rating: m.rating ?? null,
          priceLevel: m.priceLevel ?? null,
          primaryType: m.primaryType ?? null,
          mapsUrl: m.mapsUrl ?? null,
          isCustom: m.isCustom ?? false,
          __originalId: o.id,
        };
      }),
    [existing],
  );

  const [activityValue, setActivityValue] = useState(initialActivity);
  const [cuisineValue, setCuisineValue] = useState(initialCuisine);
  const [restaurantValue, setRestaurantValue] = useState(initialRestaurant);
  const [venueValue, setVenueValue] = useState(initialVenue);

  useEffect(() => {
    if (visible) {
      setActivityValue(initialActivity);
      setCuisineValue(initialCuisine);
      setRestaurantValue(initialRestaurant);
      setVenueValue(initialVenue);
    }
  }, [visible, initialActivity, initialCuisine, initialRestaurant, initialVenue]);

  const computeChanges = () => {
    const removeOptionIds: string[] = [];
    const addOptions: Array<{ label: string; metadata?: Record<string, unknown> }> = [];

    const handleArray = <T extends { __originalId?: string }>(
      currentValue: T[],
      buildAdd: (v: T) => { label: string; metadata?: Record<string, unknown> },
    ) => {
      const currentOriginalIds = new Set(
        currentValue.map((v) => v.__originalId).filter(Boolean) as string[],
      );
      for (const e of existing) {
        if (!currentOriginalIds.has(e.id)) removeOptionIds.push(e.id);
      }
      for (const v of currentValue) {
        if (!v.__originalId) addOptions.push(buildAdd(v));
      }
    };

    if (pollKind === 'activity') {
      handleArray(activityValue, (v) => ({
        label: v.label,
        metadata: { emoji: v.emoji ?? null, catalogId: v.catalogId ?? null },
      }));
    } else if (pollKind === 'cuisine') {
      handleArray(cuisineValue, (v) => ({
        label: v.label,
        metadata: { emoji: v.emoji ?? null, catalogId: v.catalogId ?? null },
      }));
    } else if (pollKind === 'restaurant') {
      handleArray(restaurantValue, (v) => ({
        label: v.name,
        metadata: {
          placeId: v.placeId ?? null,
          address: v.address ?? null,
          rating: v.rating ?? null,
          priceLevel: v.priceLevel ?? null,
          primaryType: v.primaryType ?? null,
          mapsUrl: v.mapsUrl ?? null,
          isCustom: v.isCustom ?? false,
        },
      }));
    } else if (pollKind === 'venue') {
      handleArray(venueValue, (v) => ({
        label: v.name,
        metadata: {
          placeId: v.placeId ?? null,
          address: v.address ?? null,
          rating: v.rating ?? null,
          priceLevel: v.priceLevel ?? null,
          primaryType: v.primaryType ?? null,
          mapsUrl: v.mapsUrl ?? null,
          isCustom: v.isCustom ?? false,
        },
      }));
    }

    return { removeOptionIds, addOptions };
  };

  const changes = computeChanges();
  const hasChanges =
    changes.addOptions.length > 0 || changes.removeOptionIds.length > 0;

  const title =
    pollKind === 'activity'
      ? 'Manage activities'
      : pollKind === 'cuisine'
        ? 'Manage cuisines'
        : pollKind === 'venue'
          ? 'Manage venues'
          : 'Manage options';

  const saveLabel = (() => {
    if (!hasChanges) return 'No changes yet';
    const parts: string[] = [];
    if (changes.addOptions.length > 0) parts.push(`add ${changes.addOptions.length}`);
    if (changes.removeOptionIds.length > 0)
      parts.push(`remove ${changes.removeOptionIds.length}`);
    return `Save (${parts.join(' & ')})`;
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
              {title}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.tertiary, marginTop: 2 },
              ]}
            >
              Tap chips to add or remove. Save applies your changes.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          {pollKind === 'activity' ? (
            <ActivityOptionPicker
              value={activityValue}
              onChange={setActivityValue as (v: ActivityOption[]) => void}
              min={1}
              max={15}
            />
          ) : pollKind === 'cuisine' ? (
            <CuisineOptionPicker
              value={cuisineValue}
              onChange={setCuisineValue as (v: CuisineOption[]) => void}
              min={1}
              max={15}
            />
          ) : pollKind === 'venue' ? (
            <ActivityVenuePicker
              value={venueValue}
              onChange={setVenueValue as (v: ActivityVenueOption[]) => void}
              activityQuery={venueQuery ?? ''}
              activityLabel={venueQuery || 'venue'}
              hangoutId={hangoutId}
              min={1}
              max={15}
            />
          ) : (
            <RestaurantSearchPicker
              value={restaurantValue}
              onChange={setRestaurantValue as (v: RestaurantOption[]) => void}
              hangoutId={hangoutId}
              min={1}
              max={15}
            />
          )}
        </View>

        <View style={[styles.footer, { borderTopColor: theme.colors.border.default }]}>
          <Button
            label={isSubmitting ? 'Saving…' : saveLabel}
            onPress={() => onSave(changes)}
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
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
