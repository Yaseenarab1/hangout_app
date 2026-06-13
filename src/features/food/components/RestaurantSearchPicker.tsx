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
  Utensils,
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
import { useFriendCompatibility, FriendCompatibilityBar } from '@/features/ratings';
import type { PlaceCompatibility } from '@/features/ratings';
import { SuggestedForGroup, type GroupRecommendation } from '@/features/recommendations';

export type RestaurantSearchPickerProps = {
  value: RestaurantOption[];
  onChange: (options: RestaurantOption[]) => void;
  presetCuisine?: string;
  min?: number;
  max?: number;
  participantIds?: string[];
  /** When set, recommendations resolve the group from this hangout's participants. */
  hangoutId?: string;
};

const QUICK_CATEGORIES = [
  { id: 'eats',      label: '🍽️ Eats',      cuisine: 'restaurants' },
  { id: 'bars',      label: '🍺 Bars',       cuisine: 'bars' },
  { id: 'brunch',    label: '🥂 Brunch',     cuisine: 'brunch' },
  { id: 'coffee',    label: '☕ Coffee',     cuisine: 'coffee' },
  { id: 'rooftop',   label: '🌆 Rooftop',    cuisine: 'rooftop' },
  { id: 'sushi',     label: '🍣 Sushi',      cuisine: 'sushi' },
  { id: 'pizza',     label: '🍕 Pizza',      cuisine: 'pizza' },
  { id: 'tacos',     label: '🌮 Tacos',      cuisine: 'tacos' },
  { id: 'dessert',   label: '🍦 Dessert',    cuisine: 'dessert' },
] as const;

const PRICE_LEVELS = [
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
  { value: 4, label: '$$$$' },
];

const RADIUS_OPTIONS = [
  { value: 1609, label: '1 mi' },
  { value: 4828, label: '3 mi' },
  { value: 8047, label: '5 mi' },
  { value: 16093, label: '10 mi' },
];

const RATING_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 3.5, label: '3.5+' },
  { value: 4.0, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
];

function getTypeEmoji(type: string | null): string {
  if (!type) return '🍽️';
  const t = type.toLowerCase();
  if (t.includes('sushi') || t.includes('japanese')) return '🍣';
  if (t.includes('pizza') || t.includes('italian')) return '🍕';
  if (t.includes('bar') || t.includes('cocktail') || t.includes('pub')) return '🍸';
  if (t.includes('coffee') || t.includes('cafe') || t.includes('tea')) return '☕';
  if (t.includes('taco') || t.includes('mexican') || t.includes('burrito')) return '🌮';
  if (t.includes('chinese') || t.includes('dim sum') || t.includes('dumpling')) return '🥟';
  if (t.includes('thai') || t.includes('noodle') || t.includes('ramen')) return '🍜';
  if (t.includes('burger') || t.includes('american')) return '🍔';
  if (t.includes('dessert') || t.includes('ice cream') || t.includes('bakery')) return '🍦';
  if (t.includes('brunch') || t.includes('breakfast')) return '🥞';
  if (t.includes('steakhouse') || t.includes('steak')) return '🥩';
  if (t.includes('seafood') || t.includes('fish')) return '🦞';
  if (t.includes('indian')) return '🍛';
  if (t.includes('mediterranean') || t.includes('greek')) return '🫒';
  return '🍽️';
}

export function RestaurantSearchPicker({
  value,
  onChange,
  presetCuisine,
  min = 2,
  max = 8,
  participantIds = [],
  hangoutId,
}: RestaurantSearchPickerProps): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState<string | undefined>(presetCuisine);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [radius, setRadius] = useState<number>(4828);
  const [minRating, setMinRating] = useState<number>(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [sheetPlace, setSheetPlace] = useState<Place | null>(null);

  const customRestaurants = useMyCustomRestaurants();
  const saveCustom = useSaveCustomRestaurant();
  const deleteCustom = useDeleteCustomRestaurant();

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

  const searchPlaceIds = useMemo(
    () => (search.data ?? []).map((p) => p.placeId).filter(Boolean) as string[],
    [search.data],
  );
  const compatMap = useFriendCompatibility(searchPlaceIds, participantIds);

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

  const addRecommendation = (rec: GroupRecommendation): void => {
    if (isAtMax) return;
    if (rec.placeId && selectedPlaceIds.has(rec.placeId)) return;
    if (selectedNames.has(rec.name.toLowerCase())) return;
    onChange([
      ...value,
      {
        id: rec.placeId ? `place:${rec.placeId}` : `rec:${rec.key}`,
        name: rec.name,
        address: rec.address ?? null,
        placeId: rec.placeId ?? undefined,
        rating: null,
        priceLevel: null,
        primaryType: rec.primaryType ?? null,
        mapsUrl: null,
        isCustom: !rec.placeId,
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
    (radius !== 4828 ? 1 : 0) +
    (minRating > 0 ? 1 : 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Selection summary banner */}
        {value.length > 0 ? (
          <Pressable
            onPress={() => setShowReview(true)}
            style={({ pressed }) => [
              styles.selectionBanner,
              {
                backgroundColor: theme.colors.accent + '12',
                borderColor: theme.colors.accent + '40',
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[styles.selectionCountBubble, { backgroundColor: theme.colors.accent }]}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                {value.length}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodySmallMedium, { color: theme.colors.text.primary }]}>
                {value.length} selected
                <Text style={{ color: theme.colors.text.tertiary, fontWeight: '400' }}>
                  {' '}of {max}
                </Text>
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: value.length < min ? theme.colors.warning : theme.colors.text.tertiary,
                    marginTop: 1,
                  },
                ]}
              >
                {value.length < min
                  ? `Add ${min - value.length} more to continue`
                  : 'Tap to review or remove'}
              </Text>
            </View>
            <ChevronRight size={16} color={theme.colors.text.tertiary} />
          </Pressable>
        ) : null}

        {/* Search */}
        <Input
          placeholder="Search by name, type, neighborhood…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          trailing={<SearchIcon size={18} color={theme.colors.text.tertiary} />}
          containerStyle={{ marginBottom: 10 }}
        />

        {/* Quick category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingRight: 16, marginBottom: 12 }}
        >
          {QUICK_CATEGORIES.map((cat) => {
            const active = selectedCuisine === cat.cuisine;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  setSelectedCuisine(active ? undefined : cat.cuisine);
                  if (!active) setQuery('');
                }}
                style={({ pressed }) => [
                  styles.categoryChip,
                  {
                    backgroundColor: active ? theme.colors.accent : theme.colors.bg.surface,
                    borderColor: active ? theme.colors.accent : theme.colors.border.default,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text
                  style={[
                    theme.typography.caption,
                    {
                      color: active ? '#fff' : theme.colors.text.secondary,
                      fontWeight: active ? '600' : '400',
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Suggested for your group — ranked from the group's combined ratings */}
        <SuggestedForGroup
          kind="restaurant"
          participantIds={participantIds}
          hangoutId={hangoutId}
          excludeKeys={Array.from(selectedPlaceIds)}
          onAdd={addRecommendation}
        />

        {/* Saved places */}
        {customRestaurants.data && customRestaurants.data.length > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <View style={styles.savedHeader}>
              <Star size={11} color={theme.colors.accent} fill={theme.colors.accent} />
              <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginLeft: 4, fontWeight: '600', letterSpacing: 0.3 }]}>
                SAVED
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: 16 }}
            >
              {customRestaurants.data.map((r) => {
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
                        backgroundColor: isSelected ? theme.colors.accent : theme.colors.bg.surface,
                        borderColor: isSelected ? theme.colors.accent : theme.colors.border.default,
                        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    {isSelected && (
                      <Check size={11} color="#fff" strokeWidth={2.5} style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={[
                        theme.typography.caption,
                        {
                          color: isSelected ? '#fff' : theme.colors.text.primary,
                          fontWeight: '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {r.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Filters toggle */}
        <Pressable
          onPress={() => setShowFilters(!showFilters)}
          style={[styles.filtersToggle, { borderColor: theme.colors.border.default }]}
        >
          <SlidersHorizontal size={13} color={theme.colors.text.secondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginLeft: 5 }]}>
            {showFilters ? 'Hide filters' : 'Filters'}
            {activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ''}
          </Text>
        </Pressable>

        {showFilters ? (
          <View style={[styles.filtersBox, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default }]}>
            <FilterRow icon={<Star size={13} color={theme.colors.text.secondary} />} label="Rating">
              {RATING_OPTIONS.map((r) => (
                <FilterChip key={r.value} label={r.label} active={minRating === r.value} onPress={() => setMinRating(r.value)} />
              ))}
            </FilterRow>
            <FilterRow icon={<DollarSign size={13} color={theme.colors.text.secondary} />} label="Price">
              {PRICE_LEVELS.map((p) => {
                const active = minPrice === p.value && maxPrice === p.value;
                return (
                  <FilterChip
                    key={p.value}
                    label={p.label}
                    active={active}
                    onPress={() => {
                      if (active) { setMinPrice(undefined); setMaxPrice(undefined); }
                      else { setMinPrice(p.value); setMaxPrice(p.value); }
                    }}
                  />
                );
              })}
            </FilterRow>
            <FilterRow icon={<MapPin size={13} color={theme.colors.text.secondary} />} label="Distance">
              {RADIUS_OPTIONS.map((r) => (
                <FilterChip key={r.value} label={r.label} active={radius === r.value} onPress={() => setRadius(r.value)} />
              ))}
            </FilterRow>
            <View style={{ marginTop: 4 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginBottom: 6, fontWeight: '500' }]}>
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
                            backgroundColor: active ? theme.colors.accent + '20' : theme.colors.bg.surface,
                            borderColor: active ? theme.colors.accent : theme.colors.border.default,
                          },
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={{ fontSize: 12, marginRight: 4 }}>{c.emoji}</Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.text.primary }]}>
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

        {/* Results */}
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
              compat={p.placeId ? compatMap.get(p.placeId) : undefined}
            />
          )}
        />

        {/* Manual add */}
        {showCustomInput ? (
          <View style={[styles.customForm, { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.subtle }]}>
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
              <Button label="Add & save" onPress={addCustom} disabled={!customName.trim() || isAtMax} size="sm" />
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => { setShowCustomInput(false); setCustomName(''); setCustomAddress(''); }}
                size="sm"
              />
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowCustomInput(true)}
            disabled={isAtMax}
            style={[styles.addManualRow, { opacity: isAtMax ? 0.4 : 1 }]}
          >
            <View style={[styles.addManualIcon, { backgroundColor: theme.colors.accent + '14' }]}>
              <Plus size={14} color={theme.colors.accent} strokeWidth={2.5} />
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.accent, fontWeight: '600' }]}>
              Add a place manually
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <SelectionReviewSheet
        visible={showReview}
        onClose={() => setShowReview(false)}
        items={value.map((v) => ({ id: v.id, label: v.name, subtitle: v.address ?? undefined }))}
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

  if (!searchEnabled) {
    return (
      <View style={styles.emptyState}>
        <Utensils size={32} color={theme.colors.text.tertiary} strokeWidth={1.2} />
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center', marginTop: 10 }]}>
          Search by name or tap a category
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.emptyState}>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.danger, textAlign: 'center' }]}>
          Search failed. Try adjusting your filters.
        </Text>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
          No matches.{'\n'}Try widening the distance or rating.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 14, gap: 8 }}>
      {data.slice(0, 15).map((p) => renderRow(p))}
    </View>
  );
}

function FilterRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {icon}
        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginLeft: 6, fontWeight: '500' }]}>
          {label}
        </Text>
      </View>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniChip,
        {
          backgroundColor: active ? theme.colors.accent + '20' : theme.colors.bg.surface,
          borderColor: active ? theme.colors.accent : theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[theme.typography.caption, { color: active ? theme.colors.accent : theme.colors.text.primary, fontWeight: active ? '600' : '400' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function RestaurantRow({
  place,
  isSelected,
  onToggle,
  disabled,
  compat,
}: {
  place: Place;
  isSelected: boolean;
  onToggle: () => void;
  onInfo: () => void;
  disabled: boolean;
  compat?: PlaceCompatibility;
}): React.ReactElement {
  const theme = useTheme();
  const emoji = getTypeEmoji(place.primaryType);
  const priceStr = place.priceLevel ? '$'.repeat(place.priceLevel) : '';

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        styles.resultRow,
        {
          backgroundColor: isSelected ? theme.colors.accent + '10' : theme.colors.bg.surface,
          borderColor: isSelected ? theme.colors.accent + '55' : theme.colors.border.default,
          borderWidth: isSelected ? 1.5 : 1,
          opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {/* Left emoji icon */}
      <View style={[styles.resultIcon, { backgroundColor: isSelected ? theme.colors.accent + '18' : theme.colors.bg.subtle }]}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontWeight: isSelected ? '700' : '600' }]}
          numberOfLines={1}
        >
          {place.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8, flexWrap: 'wrap' }}>
          {place.rating != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Star size={11} color="#F59E0B" fill="#F59E0B" />
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                {place.rating.toFixed(1)}
              </Text>
            </View>
          ) : null}
          {priceStr ? (
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
              {priceStr}
            </Text>
          ) : null}
          {place.primaryType ? (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]} numberOfLines={1}>
              {place.primaryType}
            </Text>
          ) : null}
        </View>
        {place.address ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 3 }}>
            <MapPin size={10} color={theme.colors.text.tertiary} strokeWidth={2} />
            <Text
              style={[theme.typography.caption, { color: theme.colors.text.tertiary, flex: 1 }]}
              numberOfLines={1}
            >
              {place.address}
            </Text>
          </View>
        ) : null}
        <FriendCompatibilityBar compat={compat} />
      </View>

      {/* Select indicator */}
      {isSelected ? (
        <View style={[styles.selectCircle, { backgroundColor: theme.colors.accent }]}>
          <Check size={14} color="#fff" strokeWidth={2.5} />
        </View>
      ) : (
        <View style={[styles.addCircle, { borderColor: theme.colors.border.default }]}>
          <Plus size={14} color={theme.colors.text.tertiary} strokeWidth={2} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  selectionCountBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 160,
  },
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  filtersBox: {
    padding: 12,
    borderRadius: 12,
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
  emptyState: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    flexShrink: 0,
  },
  addManualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  addManualIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customForm: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
  },
});
