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
  Star,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  Check,
  MapPin,
  DollarSign,
  Info,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Input, Button } from '@/components/ui';
import { SelectionReviewSheet } from '@/components/ui/SelectionReviewSheet';
import { useDebounce } from '@/hooks/useDebounce';
import { useRestaurantSearch, PlaceDetailSheet } from '@/features/places';
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

const RATING_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 3.5, label: '3.5+' },
  { value: 4.0, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
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
  const [minRating, setMinRating] = useState<number>(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [sheetPlace, setSheetPlace] = useState<Place | null>(null);

  const customRestaurants = useMyCustomRestaurants();
  const saveCustom = useSaveCustomRestaurant();
  const deleteCustom = useDeleteCustomRestaurant();

  // Search runs whenever there's a query OR a cuisine filter
  const searchEnabled = debouncedQuery.length > 0 || Boolean(selectedCuisine);
  const search = useRestaurantSearch(
    {
      query: debouncedQuery,
      cuisine: selectedCuisine,
      radius,
      minPriceLevel: minPrice,
      maxPriceLevel: maxPrice,
      minRating: minRating > 0 ? minRating : undefined,
    },
    searchEnabled,
  );

  const selectedPlaceIds = useMemo(
    () => new Set(value.map((v) => v.placeId).filter(Boolean) as string[]),
    [value],
  );
  const selectedNames = useMemo(
    () => new Set(value.map((v) => v.name.toLowerCase())),
    [value],
  );

  const isAtMax = value.length >= max;

  const isPlaceSelected = (place: Place): boolean =>
    Boolean(
      (place.placeId && selectedPlaceIds.has(place.placeId)) ||
        selectedNames.has(place.name.toLowerCase()),
    );

  const togglePlace = (place: Place): void => {
    if (isPlaceSelected(place)) {
      // Remove by both place id AND name match (handles duplicate from saved)
      onChange(
        value.filter(
          (v) =>
            v.placeId !== place.placeId &&
            v.name.toLowerCase() !== place.name.toLowerCase(),
        ),
      );
      return;
    }
    if (isAtMax) return;
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

  const toggleSavedCustom = (item: {
    id: string;
    name: string;
    address: string | null;
    google_place_id: string | null;
    metadata: Record<string, unknown>;
  }): void => {
    const isSelected =
      Boolean(item.google_place_id && selectedPlaceIds.has(item.google_place_id)) ||
      selectedNames.has(item.name.toLowerCase());
    if (isSelected) {
      onChange(
        value.filter(
          (v) =>
            v.placeId !== item.google_place_id &&
            v.name.toLowerCase() !== item.name.toLowerCase(),
        ),
      );
      return;
    }
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

  const activeFilterCount =
    (selectedCuisine ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (radius !== 5000 ? 1 : 0) +
    (minRating > 0 ? 1 : 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        {customRestaurants.data && customRestaurants.data.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            <View style={styles.savedHeader}>
              <Star size={12} color={theme.colors.accent} fill={theme.colors.accent} />
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.text.secondary, marginLeft: 4 },
                ]}
              >
                My saved ({customRestaurants.data.length})
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: 16 }}
            >
              {customRestaurants.data.map((r) => {
                const meta = r.metadata as { rating?: number; priceLevel?: number };
                const isSelected =
                  Boolean(r.google_place_id && selectedPlaceIds.has(r.google_place_id)) ||
                  selectedNames.has(r.name.toLowerCase());
                const disabled = !isSelected && isAtMax;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => toggleSavedCustom(r)}
                    onLongPress={() => deleteCustom.mutate(r.id)}
                    delayLongPress={400}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.savedChip,
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
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        { color: theme.colors.text.primary, fontWeight: '500' },
                      ]}
                      numberOfLines={1}
                    >
                      {r.name}
                    </Text>
                    {meta.rating ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Star size={10} color={theme.colors.warning} fill={theme.colors.warning} />
                        <Text
                          style={[
                            theme.typography.caption,
                            { color: theme.colors.text.tertiary, marginLeft: 3, fontSize: 11 },
                          ]}
                        >
                          {meta.rating.toFixed(1)}
                          {meta.priceLevel ? `  •  ${'$'.repeat(meta.priceLevel)}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.tertiary, marginTop: 4, fontSize: 10 },
              ]}
            >
              Long-press to forget a saved place
            </Text>
          </View>
        ) : null}

        <Input
          placeholder="Search by name, type, neighborhood…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          trailing={<SearchIcon size={18} color={theme.colors.text.tertiary} />}
          containerStyle={{ marginBottom: 6 }}
        />

        <Pressable onPress={() => setShowFilters(!showFilters)} style={styles.filtersToggle}>
          <SlidersHorizontal size={14} color={theme.colors.text.secondary} />
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginLeft: 6 },
            ]}
          >
            {showFilters ? 'Hide filters' : 'Filters'}
            {activeFilterCount > 0 ? ` • ${activeFilterCount} active` : ''}
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
            <FilterRow
              icon={<Star size={13} color={theme.colors.text.secondary} />}
              label="Rating"
            >
              {RATING_OPTIONS.map((r) => (
                <FilterChip
                  key={r.value}
                  label={r.label}
                  active={minRating === r.value}
                  onPress={() => setMinRating(r.value)}
                />
              ))}
            </FilterRow>
            <FilterRow
              icon={<DollarSign size={13} color={theme.colors.text.secondary} />}
              label="Price"
            >
              {PRICE_LEVELS.map((p) => {
                const active = minPrice === p.value && maxPrice === p.value;
                return (
                  <FilterChip
                    key={p.value}
                    label={p.label}
                    active={active}
                    onPress={() => {
                      if (active) {
                        setMinPrice(undefined);
                        setMaxPrice(undefined);
                      } else {
                        setMinPrice(p.value);
                        setMaxPrice(p.value);
                      }
                    }}
                  />
                );
              })}
            </FilterRow>
            <FilterRow
              icon={<MapPin size={13} color={theme.colors.text.secondary} />}
              label="Distance"
            >
              {RADIUS_OPTIONS.map((r) => (
                <FilterChip
                  key={r.value}
                  label={r.label}
                  active={radius === r.value}
                  onPress={() => setRadius(r.value)}
                />
              ))}
            </FilterRow>
            <View style={{ marginTop: 4 }}>
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: theme.colors.text.secondary,
                    marginBottom: 6,
                    fontWeight: '500',
                  },
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
                        onPress={() =>
                          setSelectedCuisine(active ? undefined : c.label)
                        }
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
                        <Text style={{ fontSize: 12, marginRight: 4 }}>
                          {c.emoji}
                        </Text>
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
          </View>
        ) : null}

        {/* Results / loading / empty / no-search-yet — proper state machine */}
        <ResultsBlock
          searchEnabled={searchEnabled}
          isLoading={search.isLoading}
          isError={search.isError}
          data={search.data}
          renderRow={(p) => (
            <RestaurantRow
              key={p.placeId}
              place={p}
              isSelected={isPlaceSelected(p)}
              onToggle={() => togglePlace(p)}
              onInfo={() => setSheetPlace(p)}
              disabled={!isPlaceSelected(p) && isAtMax}
            />
          )}
        />

        <View style={{ marginTop: 16 }}>
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

      <PlaceDetailSheet
        visible={sheetPlace !== null}
        onClose={() => setSheetPlace(null)}
        placeId={sheetPlace?.placeId ?? null}
        placeName={sheetPlace?.name}
      />
    </View>
  );
}

/** Search results state machine — handles loading, empty, error, no-search-yet */
function ResultsBlock({
  searchEnabled,
  isLoading,
  isError,
  data,
  renderRow,
}: {
  searchEnabled: boolean;
  isLoading: boolean;
  isError: boolean;
  data: Place[] | undefined;
  renderRow: (p: Place) => React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();

  // No search initiated yet — gentle prompt
  if (!searchEnabled) {
    return (
      <View style={styles.resultsState}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.tertiary, textAlign: 'center' },
          ]}
        >
          Search for a restaurant or pick a cuisine filter
        </Text>
      </View>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <View style={styles.resultsState}>
        <ActivityIndicator color={theme.colors.text.tertiary} />
      </View>
    );
  }

  // Error
  if (isError) {
    return (
      <View style={styles.resultsState}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.danger, textAlign: 'center' },
          ]}
        >
          Search failed. Try again or adjust your filters.
        </Text>
      </View>
    );
  }

  // Returned but empty
  if (!data || data.length === 0) {
    return (
      <View style={styles.resultsState}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.tertiary, textAlign: 'center' },
          ]}
        >
          No matches with these filters.{'\n'}Try widening the distance or rating.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12 }}>
      <Text
        style={[
          { color: '#999', fontSize: 12, fontWeight: '500', marginBottom: 8 },
        ]}
      >
        {data.length} {data.length === 1 ? 'result' : 'results'}
      </Text>
      {data.slice(0, 15).map((p) => renderRow(p))}
    </View>
  );
}

function FilterRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {icon}
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.secondary, marginLeft: 6, fontWeight: '500' },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={[styles.row]}>{children}</View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniChip,
        {
          backgroundColor: active
            ? theme.colors.accent + '20'
            : theme.colors.bg.surface,
          borderColor: active ? theme.colors.accent : theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[theme.typography.caption, { color: theme.colors.text.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function RestaurantRow({
  place,
  isSelected,
  onToggle,
  onInfo,
  disabled,
}: {
  place: Place;
  isSelected: boolean;
  onToggle: () => void;
  onInfo: () => void;
  disabled: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const priceStr = place.priceLevel ? '$'.repeat(place.priceLevel) : '';
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        styles.resultRow,
        {
          backgroundColor: isSelected
            ? theme.colors.accent + '15'
            : theme.colors.bg.surface,
          borderColor: isSelected ? theme.colors.accent : theme.colors.border.default,
          borderWidth: isSelected ? 1.5 : 1,
          opacity: disabled ? 0.4 : 1,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.text.primary,
              fontWeight: isSelected ? '600' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {place.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          {place.rating !== null && place.rating !== undefined ? (
            <>
              <Star size={12} color={theme.colors.warning} fill={theme.colors.warning} />
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: theme.colors.text.secondary,
                    marginLeft: 4,
                    marginRight: 8,
                  },
                ]}
              >
                {place.rating.toFixed(1)}
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
          {place.primaryType ? (
            <Text
              style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}
              numberOfLines={1}
            >
              {place.primaryType}
            </Text>
          ) : null}
        </View>
        {place.address ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.tertiary, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {place.address}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onInfo} hitSlop={8} style={{ padding: 4 }}>
        <Info size={16} color={theme.colors.text.tertiary} />
      </Pressable>
      {isSelected ? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: theme.colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={16} color="#FFFFFF" />
        </View>
      ) : (
        <Plus size={18} color={theme.colors.accent} />
      )}
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
  savedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  savedChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 120,
    maxWidth: 220,
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
    marginBottom: 4,
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
    marginBottom: 6,
    gap: 8,
  },
  resultsState: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
