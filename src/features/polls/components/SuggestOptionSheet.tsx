import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { toast } from '@/stores/ui.store';
import { CuisineOptionPicker } from '@/features/food/components/CuisineOptionPicker';
import { RestaurantSearchPicker } from '@/features/food/components/RestaurantSearchPicker';
import type { CuisineOption } from '@/features/food/types';
import type { RestaurantOption } from '@/features/food/types';
import { ActivityOptionPicker, type ActivityOption } from './ActivityOptionPicker';
import { ActivityVenuePicker, type ActivityVenueOption } from './ActivityVenuePicker';
import { useAddOptionsBatch } from '../hooks/usePolls';
import type { ExistingOption } from './ManagePollOptionsSheet';
import type { PollKind } from '../types';

export type SuggestOptionSheetProps = {
  visible: boolean;
  onClose: () => void;
  pollId: string;
  pollKind: PollKind;
  existing: ExistingOption[];
  venueQuery?: string;
  /** Drives "Suggested for your group" from this hangout's participants. */
  hangoutId?: string;
};

export function SuggestOptionSheet({
  visible,
  onClose,
  pollId,
  pollKind,
  existing,
  venueQuery,
  hangoutId,
}: SuggestOptionSheetProps): React.ReactElement {
  const theme = useTheme();
  const addBatch = useAddOptionsBatch();

  const [activityValue, setActivityValue] = useState<ActivityOption[]>([]);
  const [cuisineValue, setCuisineValue] = useState<CuisineOption[]>([]);
  const [restaurantValue, setRestaurantValue] = useState<RestaurantOption[]>([]);
  const [venueValue, setVenueValue] = useState<ActivityVenueOption[]>([]);

  useEffect(() => {
    if (visible) {
      setActivityValue([]);
      setCuisineValue([]);
      setRestaurantValue([]);
      setVenueValue([]);
    }
  }, [visible]);

  function buildAddOptions(): Array<{ label: string; metadata?: Record<string, unknown> }> {
    if (pollKind === 'activity') {
      const existingCatalogIds = new Set(
        existing.map((e) => (e.metadata as { catalogId?: string }).catalogId).filter(Boolean),
      );
      const existingLabels = new Set(existing.map((e) => e.label.toLowerCase()));
      return activityValue
        .filter((v) => {
          if (v.catalogId && existingCatalogIds.has(v.catalogId)) return false;
          if (!v.catalogId && existingLabels.has(v.label.toLowerCase())) return false;
          return true;
        })
        .map((v) => ({
          label: v.label,
          metadata: { emoji: v.emoji ?? null, catalogId: v.catalogId ?? null },
        }));
    }
    if (pollKind === 'cuisine') {
      const existingCatalogIds = new Set(
        existing.map((e) => (e.metadata as { catalogId?: string }).catalogId).filter(Boolean),
      );
      const existingLabels = new Set(existing.map((e) => e.label.toLowerCase()));
      return cuisineValue
        .filter((v) => {
          if (v.catalogId && existingCatalogIds.has(v.catalogId)) return false;
          if (!v.catalogId && existingLabels.has(v.label.toLowerCase())) return false;
          return true;
        })
        .map((v) => ({
          label: v.label,
          metadata: { emoji: v.emoji ?? null, catalogId: v.catalogId ?? null },
        }));
    }
    if (pollKind === 'venue') {
      const existingPlaceIds = new Set(
        existing.map((e) => (e.metadata as { placeId?: string }).placeId).filter(Boolean),
      );
      const existingLabels = new Set(existing.map((e) => e.label.toLowerCase()));
      return venueValue
        .filter((v) => {
          if (v.placeId && existingPlaceIds.has(v.placeId)) return false;
          if (!v.placeId && existingLabels.has(v.name.toLowerCase())) return false;
          return true;
        })
        .map((v) => ({
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
    // restaurant
    const existingPlaceIds = new Set(
      existing.map((e) => (e.metadata as { placeId?: string }).placeId).filter(Boolean),
    );
    const existingLabels = new Set(existing.map((e) => e.label.toLowerCase()));
    return restaurantValue
      .filter((v) => {
        if (v.placeId && existingPlaceIds.has(v.placeId)) return false;
        if (!v.placeId && existingLabels.has(v.name.toLowerCase())) return false;
        return true;
      })
      .map((v) => ({
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

  function handleSave(): void {
    const addOptions = buildAddOptions();
    if (addOptions.length === 0) {
      toast.error("That's already in the poll.");
      return;
    }
    addBatch.mutate({ pollId, options: addOptions }, { onSuccess: () => onClose() });
  }

  const selectedCount =
    pollKind === 'activity'
      ? activityValue.length
      : pollKind === 'cuisine'
        ? cuisineValue.length
        : pollKind === 'venue'
          ? venueValue.length
          : restaurantValue.length;

  const title =
    pollKind === 'activity'
      ? 'Suggest an activity'
      : pollKind === 'cuisine'
        ? 'Suggest a cuisine'
        : pollKind === 'venue'
          ? 'Suggest a venue'
          : 'Suggest a restaurant';

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
              Your pick gets added to the poll for everyone to vote on.
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
              onChange={setActivityValue}
              min={0}
              max={5}
            />
          ) : pollKind === 'cuisine' ? (
            <CuisineOptionPicker
              value={cuisineValue}
              onChange={setCuisineValue}
              min={0}
              max={5}
            />
          ) : pollKind === 'venue' ? (
            <ActivityVenuePicker
              value={venueValue}
              onChange={setVenueValue}
              activityQuery={venueQuery ?? ''}
              activityLabel={venueQuery || 'venue'}
              hangoutId={hangoutId}
              min={0}
              max={5}
            />
          ) : (
            <RestaurantSearchPicker
              value={restaurantValue}
              onChange={setRestaurantValue}
              hangoutId={hangoutId}
              min={0}
              max={5}
            />
          )}
        </View>

        <View style={[styles.footer, { borderTopColor: theme.colors.border.default }]}>
          <Button
            label={
              selectedCount === 0
                ? 'Pick something first'
                : `Add ${selectedCount} to poll`
            }
            onPress={handleSave}
            disabled={selectedCount === 0 || addBatch.isPending}
            loading={addBatch.isPending}
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
