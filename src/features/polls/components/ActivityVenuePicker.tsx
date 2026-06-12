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
import { searchPlaces, PlaceDetailSheet } from '@/features/places';
import { useSearchLocation } from '@/features/places/hooks/useSearchLocation';
import { filterByRadius } from '@/features/places/utils/distance';
import { useQuery } from '@tanstack/react-query';
import type { Place } from '@/features/places';

export type ActivityVenueOption = {
  id: string;
  name: string;
  address?: string | null;
  placeId?: string;
  rating?: number | null;
  priceLevel?: number | null;
  primaryType?: string | null;
  mapsUrl?: string | null;
  isCustom?: boolean;
};

export type ActivityVenuePickerProps = {
  value: ActivityVenueOption[];
  onChange: (options: ActivityVenueOption[]) => void;
  /** Activity-specific search query (e.g. "bar", "bowling alley"). Pre-fills the search. */
  activityQuery: string;
  /** Display name (used in headers/titles). */
  activityLabel: string;
  /** Optional Google Places type filter (e.g. ['movie_theater']). */
  includedTypes?: string[];
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

/**
 * Search Google Places for venues matching a specific activity.
 * Activity query is pre-filled and editable. Same filter set as restaurants
 * (no cuisine, since activity venues aren't food).
 */
export function ActivityVenuePicker({
  value,
  onChange,
  activityQuery,
  activityLabel,
  includedTypes,
  min = 2,
  max = 8,
}: ActivityVenuePickerProps): React.ReactElement {
  const theme = useTheme();
  // Pre-fill the search box with the activity query, but make it editable
  const [extraQuery, setExtraQuery] = useState(activityQuery ?? '');
  const debouncedQuery = useDebounce(extraQuery, 300);
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [radius, setRadius] = useState<number>(4828);
  const [minRating, setMinRating] = useState<number>(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [sheetPlace, setSheetPlace] = useState<Place | null>(null);

  const searchLoc = useSearchLocation();
  const location = searchLoc.data ?? undefined;

  const searchEnabled = debouncedQuery.trim().length > 0;
  const search = useQuery({
    queryKey: [
      'places',
      'activity-search',
      debouncedQuery,
      radius,
      minRating,
      minPrice,
      maxPrice,
      includedTypes,
      location,
    ],
    queryFn: () =>
      searchPlaces({
        query: debouncedQuery,
        location,
        radius,
        minPriceLevel: minPrice,
        maxPriceLevel: maxPrice,
        minRating: minRating > 0 ? minRating : undefined,
        includedTypes,
      }),
    enabled: searchEnabled,
    staleTime: 5 * 60 * 1000,
    select: (data) => filterByRadius(data, searchLoc.data, radius),
  });

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
    setCustomName('');
    setCustomAddress('');
    setShowCustomInput(false);
  };

  const activeFilterCount =
    (minPrice ? 1 : 0) + (radius !== 5000 ? 1 : 0) + (minRating > 0 ? 1 : 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.contextHeader,
            {
              backgroundColor: theme.colors.accent + '10',
              borderColor: theme.colors.accent + '40',
            },
          ]}
        >
          <Text
            style={[
              theme.typography.bodySmall,
              { color: theme.colors.text.secondary },
            ]}
          >
            Looking for places to{' '}
            <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>
              {activityLabel.toLowerCase()}
            </Text>
          </Text>
        </View>

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
          placeholder={`Search (e.g. "${activityQuery || 'venue'}", "rooftop")`}
          value={extraQuery}
          onChangeText={setExtraQuery}
          autoCapitalize="none"
          autoCorrect={false}
          trailing={<SearchIcon size={18} color={theme.colors.text.tertiary} />}
          containerStyle={{ marginBottom: 6 }}
        />

        {/* Always-visible manual add link — before results so it's never buried */}
        {!showCustomInput && (
          <Pressable
            onPress={() => setShowCustomInput(true)}
            disabled={isAtMax}
            style={[styles.addCustomInline, { opacity: isAtMax ? 0.4 : 1 }]}
          >
            <Plus size={13} color={theme.colors.accent} />
            <Text style={[theme.typography.caption, { color: theme.colors.accent, marginLeft: 4 }]}>
              Add a place manually
            </Text>
          </Pressable>
        )}

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
          </View>
        ) : null}

        <ResultsBlock
          searchEnabled={searchEnabled}
          isLoading={search.isLoading}
          isError={search.isError}
          data={search.data}
          renderRow={(p) => (
            <PlaceRow
              key={p.placeId}
              place={p}
              isSelected={isPlaceSelected(p)}
              onToggle={() => togglePlace(p)}
              onInfo={() => setSheetPlace(p)}
              disabled={!isPlaceSelected(p) && isAtMax}
            />
          )}
        />

        {showCustomInput ? (
          <View style={[styles.customForm, { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.subtle }]}>
            <Input
              placeholder="Place name"
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
                label="Add"
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
        ) : null}
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
        itemLabel="venues"
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
      <View style={styles.resultsState}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.tertiary, textAlign: 'center' },
          ]}
        >
          Type something above to search
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.resultsState}>
        <ActivityIndicator color={theme.colors.text.tertiary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.resultsState}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.danger, textAlign: 'center' },
          ]}
        >
          Search failed. Try again or adjust filters.
        </Text>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.resultsState}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.tertiary, textAlign: 'center' },
          ]}
        >
          No matches.{'\n'}Try a different search or widen the filters.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: '#999', fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
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

function PlaceRow({
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
                  { color: theme.colors.text.secondary, marginLeft: 4, marginRight: 8 },
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
  contextHeader: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
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
  addCustomInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 8,
  },
  customForm: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
