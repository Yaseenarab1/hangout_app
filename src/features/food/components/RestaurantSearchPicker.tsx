import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Search as SearchIcon,
  X,
  Star,
  Plus,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Input, Button } from '@/components/ui';
import { SelectionReviewSheet } from '@/components/ui/SelectionReviewSheet';
import { useDebounce } from '@/hooks/useDebounce';
import { useRestaurantSearch } from '@/features/places';
import type { Place } from '@/features/places';
import {
  useMyCustomRestaurants,
  useSaveCustomRestaurant,
  useDeleteCustomRestaurant,
} from '../hooks/useFood';
import { CUISINE_CATALOG } from '../catalog/cuisines';
import type { RestaurantOption } from '../types';

export type RestaurantSearchPickerProps = {
  value: RestaurantOption[];
  onChange: (options: RestaurantOption[]) => void;
  presetCuisine?: string;
  min?: number;
  max?: number;
};

const PRICE_LEVELS = [
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
  { value: 4, label: '$$$$' },
];

const RADIUS_OPTIONS = [
  { value: 1500, label: '<1mi' },
  { value: 5000, label: '<3mi' },
  { value: 16000, label: '<10mi' },
];

export function RestaurantSearchPicker({
  value,
  onChange,
  presetCuisine,
  min = 2,
  max = 8,
}: RestaurantSearchPickerProps): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState<string | undefined>(
    presetCuisine,
  );
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [radius, setRadius] = useState<number>(5000);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [showReview, setShowReview] = useState(false);

  const customRestaurants = useMyCustomRestaurants();
  const saveCustom = useSaveCustomRestaurant();
  const deleteCustom = useDeleteCustomRestaurant();

  const search = useRestaurantSearch(
    {
      query: debouncedQuery,
      cuisine: selectedCuisine,
      radius,
      minPriceLevel: minPrice,
      maxPriceLevel: maxPrice,
      minRating: 3.5,
    },
    debouncedQuery.length > 0 || Boolean(selectedCuisine),
  );

  const selectedPlaceIds = useMemo(
    () => new Set(value.map((v) => v.placeId).filter(Boolean) as string[]),
    [value],
  );

  const isAtMax = value.length >= max;

  const addPlace = (place: Place): void => {
    if (isAtMax || (place.placeId && selectedPlaceIds.has(place.placeId))) return;
    onChange([
      ...value,
      {
        id: `place:${place.placeId}`,
        name: place.name,
        address: place.address,
        placeId: place.placeId,
        rating: place.rating,
        priceLevel: place.priceLevel,
        primaryType: place.primaryType,
        mapsUrl: place.mapsUrl,
        isCustom: false,
      },
    ]);
    saveCustom.mutate({
      name: place.name,
      address: place.address,
      placeId: place.placeId,
      metadata: {
        rating: place.rating,
        priceLevel: place.priceLevel,
        primaryType: place.primaryType,
        mapsUrl: place.mapsUrl,
      },
    });
  };

  const addCustomFromSaved = (item: {
    id: string;
    name: string;
    address: string | null;
    google_place_id: string | null;
    metadata: Record<string, unknown>;
  }): void => {
    if (isAtMax) return;
    const m = item.metadata as Record<string, unknown>;
    onChange([
      ...value,
      {
        id: `saved:${item.id}`,
        name: item.name,
        address: item.address,
        placeId: item.google_place_id ?? undefined,
        rating: (m.rating as number) ?? null,
        priceLevel: (m.priceLevel as number) ?? null,
        primaryType: (m.primaryType as string) ?? null,
        mapsUrl: (m.mapsUrl as string) ?? null,
        isCustom: !item.google_place_id,
      },
    ]);
  };

  const remove = (optId: string): void => {
    onChange(value.filter((o) => o.id !== optId));
  };

  const addCustom = (): void => {
    const name = customName.trim();
    if (!name || isAtMax) return;
    onChange([
      ...value,
      {
        id: `custom:${Date.now()}`,
        name,
        address: customAddress.trim() || null,
        isCustom: true,
      },
    ]);
    saveCustom.mutate({ name, address: customAddress.trim() || null });
    setCustomName('');
    setCustomAddress('');
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
        placeholder="Search restaurants"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        trailing={<SearchIcon size={18} color={theme.colors.text.tertiary} />}
        containerStyle={{ marginBottom: 8 }}
      />

      <Pressable
        onPress={() => setShowFilters(!showFilters)}
        style={styles.filtersToggle}
      >
        <SlidersHorizontal size={14} color={theme.colors.text.secondary} />
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.secondary, marginLeft: 6 },
          ]}
        >
          {showFilters ? 'Hide filters' : 'Filters'}
          {selectedCuisine || minPrice || maxPrice ? ' • active' : ''}
        </Text>
      </Pressable>

      {showFilters ? (
        <View
          style={[
            styles.filtersBox,
            {
              backgroundColor: theme.colors.bg.subtle,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginBottom: 6 },
            ]}
          >
            Distance
          </Text>
          <View style={styles.row}>
            {RADIUS_OPTIONS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRadius(r.value)}
                style={({ pressed }) => [
                  styles.miniChip,
                  {
                    backgroundColor:
                      radius === r.value
                        ? theme.colors.accent + '20'
                        : theme.colors.bg.surface,
                    borderColor:
                      radius === r.value
                        ? theme.colors.accent
                        : theme.colors.border.default,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginTop: 12, marginBottom: 6 },
            ]}
          >
            Price
          </Text>
          <View style={styles.row}>
            {PRICE_LEVELS.map((p) => {
              const active = minPrice === p.value && maxPrice === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => {
                    if (active) {
                      setMinPrice(undefined);
                      setMaxPrice(undefined);
                    } else {
                      setMinPrice(p.value);
                      setMaxPrice(p.value);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.miniChip,
                    {
                      backgroundColor: active
                        ? theme.colors.accent + '20'
                        : theme.colors.bg.surface,
                      borderColor: active
                        ? theme.colors.accent
                        : theme.colors.border.default,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.text.primary },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginTop: 12, marginBottom: 6 },
            ]}
          >
            Cuisine
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.row, { paddingRight: 16 }]}>
              {CUISINE_CATALOG.slice(0, 12).map((c) => {
                const active = selectedCuisine === c.label;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedCuisine(active ? undefined : c.label)}
                    style={({ pressed }) => [
                      styles.miniChip,
                      {
                        backgroundColor: active
                          ? theme.colors.accent + '20'
                          : theme.colors.bg.surface,
                        borderColor: active
                          ? theme.colors.accent
                          : theme.colors.border.default,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ fontSize: 12, marginRight: 4 }}>{c.emoji}</Text>
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: theme.colors.text.primary },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ marginTop: 8 }}
      >
        {customRestaurants.data && customRestaurants.data.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={[
                theme.typography.bodySmallMedium,
                { color: theme.colors.text.secondary, marginBottom: 8 },
              ]}
            >
              ⭐ My saved
            </Text>
            {customRestaurants.data.slice(0, 5).map((r) => (
              <RestaurantRow
                key={r.id}
                name={r.name}
                address={r.address ?? undefined}
                rating={(r.metadata as { rating?: number }).rating ?? null}
                priceLevel={(r.metadata as { priceLevel?: number }).priceLevel ?? null}
                onAdd={() => addCustomFromSaved(r)}
                onLongPress={() => deleteCustom.mutate(r.id)}
              />
            ))}
          </View>
        ) : null}

        {search.isLoading ? (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.text.tertiary} />
          </View>
        ) : search.data && search.data.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={[
                theme.typography.bodySmallMedium,
                { color: theme.colors.text.secondary, marginBottom: 8 },
              ]}
            >
              Results
            </Text>
            {search.data.slice(0, 15).map((p) => (
              <RestaurantRow
                key={p.placeId}
                name={p.name}
                address={p.address}
                rating={p.rating}
                priceLevel={p.priceLevel}
                primaryType={p.primaryType}
                onAdd={() => addPlace(p)}
              />
            ))}
          </View>
        ) : (debouncedQuery.length > 0 || selectedCuisine) ? (
          <Text
            style={[
              theme.typography.bodySmall,
              {
                color: theme.colors.text.tertiary,
                textAlign: 'center',
                paddingVertical: 16,
              },
            ]}
          >
            No matches
          </Text>
        ) : (
          <Text
            style={[
              theme.typography.bodySmall,
              {
                color: theme.colors.text.tertiary,
                textAlign: 'center',
                paddingVertical: 16,
              },
            ]}
          >
            Search for a restaurant or pick a cuisine filter
          </Text>
        )}

        <View style={{ marginBottom: 24 }}>
          {showCustomInput ? (
            <View style={{ gap: 8 }}>
              <Input
                placeholder="Restaurant name"
                value={customName}
                onChangeText={setCustomName}
                autoFocus
                maxLength={200}
              />
              <Input
                placeholder="Address (optional)"
                value={customAddress}
                onChangeText={setCustomAddress}
                maxLength={300}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label="Add & save"
                  onPress={addCustom}
                  disabled={!customName.trim() || isAtMax}
                  size="sm"
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setShowCustomInput(false);
                    setCustomName('');
                    setCustomAddress('');
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
                Add a place not on Google
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <SelectionReviewSheet
        visible={showReview}
        onClose={() => setShowReview(false)}
        items={value.map((v) => ({
          id: v.id,
          label: v.name,
          subtitle: v.address ?? undefined,
        }))}
        min={min}
        max={max}
        onRemove={remove}
        itemLabel="restaurants"
      />
    </View>
  );
}

function RestaurantRow({
  name,
  address,
  rating,
  priceLevel,
  primaryType,
  onAdd,
  onLongPress,
}: {
  name: string;
  address?: string | null;
  rating?: number | null;
  priceLevel?: number | null;
  primaryType?: string | null;
  onAdd: () => void;
  onLongPress?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const priceStr = priceLevel ? '$'.repeat(priceLevel) : '';
  return (
    <Pressable
      onPress={onAdd}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.resultRow,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && { backgroundColor: theme.colors.bg.subtle },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[theme.typography.body, { color: theme.colors.text.primary }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          {rating !== null && rating !== undefined ? (
            <>
              <Star size={12} color={theme.colors.warning} fill={theme.colors.warning} />
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.text.secondary, marginLeft: 4, marginRight: 8 },
                ]}
              >
                {rating.toFixed(1)}
              </Text>
            </>
          ) : null}
          {priceStr ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.secondary, marginRight: 8 },
              ]}
            >
              {priceStr}
            </Text>
          ) : null}
          {primaryType ? (
            <Text
              style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}
              numberOfLines={1}
            >
              {primaryType}
            </Text>
          ) : null}
        </View>
        {address ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.tertiary, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {address}
          </Text>
        ) : null}
      </View>
      <Plus size={18} color={theme.colors.accent} />
    </Pressable>
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
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 4,
  },
  filtersBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
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
