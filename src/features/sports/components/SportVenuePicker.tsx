import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Star, Check, Plus, Search, Navigation2, PenLine } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { SelectionReviewSheet } from '@/components/ui/SelectionReviewSheet';
import { LocationPickerSheet, getPlacePhotoUrl, PlaceDetailSheet } from '@/features/places';
import { useSearchLocation } from '@/features/places/hooks/useSearchLocation';
import { useSportVenues, placesToVenueOptions } from '../hooks/useSportVenues';
import type { SportVenueOption, PriceHint } from '../types';
import type { Sport } from '../catalog/sports';

const RADIUS_OPTIONS = [
  { value: 1609, label: '1 mi' },
  { value: 4828, label: '3 mi' },
  { value: 8047, label: '5 mi' },
  { value: 16093, label: '10 mi' },
];

const RATING_OPTIONS = [
  { value: 3.5, label: '3.5+' },
  { value: 4.0, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
];

const PRICE_FILTERS = [
  { value: 'all',  label: 'Any' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
] as const;

type PriceFilter = 'all' | 'free' | 'paid';

export type SportVenuePickerProps = {
  sport: Sport;
  value: SportVenueOption[];
  onChange: (options: SportVenueOption[]) => void;
  min?: number;
  max?: number;
};

export function SportVenuePicker({
  sport,
  value,
  onChange,
  min = 0,
  max = 6,
}: SportVenuePickerProps): React.ReactElement {
  const theme = useTheme();
  const [customQuery, setCustomQuery] = useState(sport.query);
  const [radius, setRadius] = useState(4828);
  const [minRating, setMinRating] = useState(0);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [showReview, setShowReview] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [detailVenue, setDetailVenue] = useState<SportVenueOption | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');

  const searchLocation = useSearchLocation();
  const search = useSportVenues(customQuery, radius, minRating);

  const filteredResults = useMemo(() => {
    const venues = placesToVenueOptions(search.data ?? [], sport.freeHint, sport.emoji);
    if (priceFilter === 'all') return venues;
    return venues.filter((v) =>
      priceFilter === 'free' ? v.priceHint === 'free' : v.priceHint === 'paid',
    );
  }, [search.data, priceFilter, sport.freeHint, sport.emoji]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.placeId ?? v.id)), [value]);
  const isAtMax = value.length >= max;

  const toggle = (venue: SportVenueOption): void => {
    const key = venue.placeId ?? venue.id;
    if (selectedIds.has(key)) {
      onChange(value.filter((v) => (v.placeId ?? v.id) !== key));
      return;
    }
    if (isAtMax) return;
    onChange([...value, venue]);
  };

  const remove = (id: string): void => onChange(value.filter((v) => v.id !== id));

  const addCustom = (): void => {
    const name = customName.trim();
    if (!name || isAtMax) return;
    onChange([
      ...value,
      {
        id: `custom:${Date.now()}`,
        name,
        address: customAddress.trim() || null,
        priceHint: 'unknown',
      },
    ]);
    setCustomName('');
    setCustomAddress('');
    setShowCustomInput(false);
  };

  const locationName = searchLocation.data?.name;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Selection banner */}
        {value.length > 0 && (
          <Pressable
            onPress={() => setShowReview(true)}
            style={({ pressed }) => [
              styles.selectionBanner,
              { backgroundColor: theme.colors.accent + '12', borderColor: theme.colors.accent + '40' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.countBubble, { backgroundColor: theme.colors.accent }]}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{value.length}</Text>
            </View>
            <Text style={[theme.typography.bodySmallMedium, { color: theme.colors.text.primary, flex: 1 }]}>
              {value.length} selected
              <Text style={{ color: theme.colors.text.tertiary, fontWeight: '400' }}> · tap to review</Text>
            </Text>
          </Pressable>
        )}

        {/* Location row */}
        <Pressable
          onPress={() => setShowLocationPicker(true)}
          style={({ pressed }) => [
            styles.locationRow,
            {
              backgroundColor: locationName ? theme.colors.accent + '10' : theme.colors.bg.surface,
              borderColor: locationName ? theme.colors.accent + '50' : theme.colors.border.default,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Navigation2
            size={15}
            color={locationName ? theme.colors.accent : theme.colors.text.tertiary}
            strokeWidth={2}
          />
          <Text
            style={[
              theme.typography.bodySmall,
              {
                color: locationName ? theme.colors.accent : theme.colors.text.secondary,
                flex: 1,
                fontWeight: locationName ? '600' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {locationName ?? 'Set location to search nearby'}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
            Change →
          </Text>
        </Pressable>

        {/* Custom search for "Other" sport */}
        {sport.id === 'other' && (
          <View style={[styles.searchBar, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
            <Search size={15} color={theme.colors.text.tertiary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text.primary }]}
              placeholder="What sport? (e.g. squash, tennis)"
              placeholderTextColor={theme.colors.text.tertiary}
              value={customQuery}
              onChangeText={setCustomQuery}
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Filters */}
        <View style={{ gap: 8, marginBottom: 14 }}>
          {/* Price filter pills */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {PRICE_FILTERS.map((f) => {
              const active = priceFilter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setPriceFilter(f.value)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.colors.accent + '18' : theme.colors.bg.surface,
                      borderColor: active ? theme.colors.accent : theme.colors.border.default,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[theme.typography.caption, { color: active ? theme.colors.accent : theme.colors.text.secondary, fontWeight: active ? '600' : '400' }]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Distance + rating */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {RADIUS_OPTIONS.map((r) => {
              const active = radius === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setRadius(r.value)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.colors.accent + '18' : theme.colors.bg.surface,
                      borderColor: active ? theme.colors.accent : theme.colors.border.default,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <MapPin size={10} color={active ? theme.colors.accent : theme.colors.text.tertiary} strokeWidth={2} style={{ marginRight: 3 }} />
                  <Text style={[theme.typography.caption, { color: active ? theme.colors.accent : theme.colors.text.secondary, fontWeight: active ? '600' : '400' }]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
            {RATING_OPTIONS.map((r) => {
              const active = minRating === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setMinRating(active ? 0 : r.value)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.colors.accent + '18' : theme.colors.bg.surface,
                      borderColor: active ? theme.colors.accent : theme.colors.border.default,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Star size={10} color={active ? theme.colors.accent : theme.colors.text.tertiary} fill={active ? theme.colors.accent : 'none'} style={{ marginRight: 3 }} />
                  <Text style={[theme.typography.caption, { color: active ? theme.colors.accent : theme.colors.text.secondary, fontWeight: active ? '600' : '400' }]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Add my own place */}
        {!showCustomInput ? (
          <Pressable
            onPress={() => setShowCustomInput(true)}
            disabled={isAtMax}
            style={({ pressed }) => [
              styles.addOwnRow,
              { borderColor: theme.colors.border.default, opacity: isAtMax ? 0.4 : pressed ? 0.6 : 1 },
            ]}
          >
            <PenLine size={14} color={theme.colors.accent} strokeWidth={2} />
            <Text style={[theme.typography.caption, { color: theme.colors.accent, marginLeft: 6 }]}>
              Add my own place
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.customForm, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default }]}>
            <TextInput
              style={[styles.customInput, { color: theme.colors.text.primary, backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
              placeholder="Place name *"
              placeholderTextColor={theme.colors.text.tertiary}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
              maxLength={200}
            />
            <TextInput
              style={[styles.customInput, { color: theme.colors.text.primary, backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
              placeholder="Address (optional)"
              placeholderTextColor={theme.colors.text.tertiary}
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
                onPress={() => { setShowCustomInput(false); setCustomName(''); setCustomAddress(''); }}
                size="sm"
              />
            </View>
          </View>
        )}

        {/* Results */}
        {!locationName && filteredResults.length === 0 && !search.isLoading ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 36 }}>{sport.emoji}</Text>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, marginTop: 12, textAlign: 'center', fontWeight: '600' }]}>
              Set a location first
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center', marginTop: 4 }]}>
              Tap "Set location" above to find {sport.label.toLowerCase()} venues near you.
            </Text>
          </View>
        ) : search.isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : search.isError ? (
          <View style={styles.emptyState}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.danger, textAlign: 'center' }]}>
              Search failed. Try adjusting the distance.
            </Text>
          </View>
        ) : filteredResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 32 }}>{sport.emoji}</Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center', marginTop: 10 }]}>
              No venues found nearby.{'\n'}Try widening the distance.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filteredResults.map((venue) => {
              const key = venue.placeId ?? venue.id;
              const isSelected = selectedIds.has(key);
              const disabled = !isSelected && isAtMax;
              return (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  isSelected={isSelected}
                  disabled={disabled}
                  onToggle={() => toggle(venue)}
                  onLongPress={() => setDetailVenue(venue)}
                  theme={theme}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <SelectionReviewSheet
        visible={showReview}
        onClose={() => setShowReview(false)}
        items={value.map((v) => ({ id: v.id, label: v.name, subtitle: v.address ?? undefined }))}
        min={min}
        max={max}
        onRemove={remove}
        itemLabel="venues"
      />

      <LocationPickerSheet
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      />

      <PlaceDetailSheet
        visible={detailVenue !== null}
        onClose={() => setDetailVenue(null)}
        placeId={detailVenue?.placeId ?? null}
        placeName={detailVenue?.name}
      />
    </View>
  );
}

function PriceBadge({ hint, priceLevel }: { hint: PriceHint; priceLevel?: number | null }): React.ReactElement | null {
  if (hint === 'free') {
    return (
      <View style={[styles.priceBadge, { backgroundColor: '#22C55E18', borderColor: '#22C55E55' }]}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#22C55E' }}>Free</Text>
      </View>
    );
  }
  if (hint === 'paid' && priceLevel) {
    return (
      <View style={[styles.priceBadge, { backgroundColor: '#6B728018', borderColor: '#6B728055' }]}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280' }}>{'$'.repeat(priceLevel)}</Text>
      </View>
    );
  }
  return null;
}

function VenueCard({
  venue,
  isSelected,
  disabled,
  onToggle,
  onLongPress,
  theme,
}: {
  venue: SportVenueOption;
  isSelected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  const photoUrl = venue.photos?.[0] ? getPlacePhotoUrl(venue.photos[0], 400) : null;

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={disabled}
      style={({ pressed }) => [
        styles.venueCard,
        {
          backgroundColor: isSelected ? theme.colors.accent + '10' : theme.colors.bg.surface,
          borderColor: isSelected ? theme.colors.accent + '55' : theme.colors.border.default,
          borderWidth: isSelected ? 1.5 : 1,
          opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {/* Photo */}
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={styles.venuePhoto}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.venuePhoto, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 24 }}>{venue.sportEmoji ?? '🏟️'}</Text>
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontWeight: isSelected ? '700' : '600', flex: 1 }]}
            numberOfLines={1}
          >
            {venue.name}
          </Text>
          <PriceBadge hint={venue.priceHint} priceLevel={venue.priceLevel} />
        </View>

        {venue.rating != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 }}>
            <Star size={11} color="#F59E0B" fill="#F59E0B" />
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
              {venue.rating.toFixed(1)}
            </Text>
            {venue.primaryType ? (
              <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
                · {venue.primaryType}
              </Text>
            ) : null}
          </View>
        ) : null}

        {venue.address ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 3 }}>
            <MapPin size={10} color={theme.colors.text.tertiary} strokeWidth={2} />
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, flex: 1 }]} numberOfLines={1}>
              {venue.address}
            </Text>
          </View>
        ) : null}
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
    marginBottom: 10,
  },
  countBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  addOwnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  customForm: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  customInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 4,
  },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingRight: 12,
  },
  venuePhoto: {
    width: 72,
    height: 80,
    flexShrink: 0,
  },
  priceBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
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
});
