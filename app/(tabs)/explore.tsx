import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MapPin, ChevronRight, Star } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/hooks/useTheme';
import { searchPlaces, getPlacePhotoUrl } from '@/features/places';
import { useSearchLocation } from '@/features/places/hooks/useSearchLocation';
import { filterByRadius } from '@/features/places/utils/distance';
import { LocationPickerSheet } from '@/features/places/components/LocationPickerSheet';
import { PlaceDetailSheet } from '@/features/places/components/PlaceDetailSheet';
import type { Place } from '@/features/places';

const CATEGORIES = [
  { id: 'bars', label: 'Bars', emoji: '🍺', query: 'bars' },
  { id: 'restaurants', label: 'Eats', emoji: '🍽️', query: 'restaurants' },
  { id: 'brunch', label: 'Brunch', emoji: '🥂', query: 'brunch spots' },
  { id: 'coffee', label: 'Coffee', emoji: '☕', query: 'coffee cafes' },
  { id: 'rooftop', label: 'Rooftop', emoji: '🌆', query: 'rooftop bars' },
  { id: 'clubs', label: 'Nightlife', emoji: '🎶', query: 'nightclub dance bars' },
  { id: 'parks', label: 'Parks', emoji: '🌿', query: 'parks outdoors' },
  { id: 'entertainment', label: 'Fun', emoji: '🎳', query: 'bowling arcade entertainment' },
  { id: 'arts', label: 'Culture', emoji: '🎭', query: 'museums art galleries' },
  { id: 'dessert', label: 'Dessert', emoji: '🍦', query: 'dessert bakery ice cream' },
];

type Category = (typeof CATEGORIES)[number];

export default function ExploreScreen(): React.ReactElement {
  const theme = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const location = useSearchLocation();

  const EXPLORE_RADIUS = 4828; // 3 miles — reasonable discovery radius
  const placesQuery = useQuery({
    queryKey: ['explore', activeCategory?.id, location.data?.lat, location.data?.lng],
    queryFn: () =>
      searchPlaces({
        query: activeCategory!.query,
        location: location.data ? { lat: location.data.lat, lng: location.data.lng } : undefined,
        radius: EXPLORE_RADIUS,
      }),
    enabled: !!activeCategory,
    staleTime: 5 * 60_000,
    select: (data) => filterByRadius(data, location.data, EXPLORE_RADIUS),
  });

  return (
    <Screen header={{ title: 'Explore' }} scroll={false}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Location banner */}
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={[
            styles.locationBanner,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <MapPin size={16} color={theme.colors.accent} />
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, flex: 1 }]}
            numberOfLines={1}
          >
            {location.data ? location.data.name : 'Set your location'}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.accent }]}>
            {location.data ? 'Change' : 'Add →'}
          </Text>
        </Pressable>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipStrip}
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory?.id === cat.id;
            return (
              <CategoryChip
                key={cat.id}
                cat={cat}
                active={active}
                onPress={() => setActiveCategory(active ? null : cat)}
                theme={theme}
              />
            );
          })}
        </ScrollView>

        {/* Results */}
        {!activeCategory && (
          <NoSelection theme={theme} onPickCategory={setActiveCategory} />
        )}

        {activeCategory && placesQuery.isLoading && (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 12 }]}>
              Finding {activeCategory.label.toLowerCase()} near you…
            </Text>
          </View>
        )}

        {activeCategory && placesQuery.isError && (
          <View style={styles.centered}>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
              Couldn't load results. Check your connection.
            </Text>
          </View>
        )}

        {activeCategory && placesQuery.data?.length === 0 && (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              Nothing found nearby
            </Text>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}>
              Try a different category or change your location.
            </Text>
          </View>
        )}

        {activeCategory && (placesQuery.data?.length ?? 0) > 0 && (
          <View style={styles.resultsList}>
            <Text
              style={[
                theme.typography.bodyMedium,
                { color: theme.colors.text.secondary, marginBottom: 12, paddingHorizontal: 16 },
              ]}
            >
              {activeCategory.emoji} {activeCategory.label}
              {location.data ? ` near ${location.data.name}` : ''}
            </Text>
            {placesQuery.data!.map((place) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                onPress={() => setDetailPlace(place)}
                theme={theme}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Location picker sheet */}
      <LocationPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
      />

      {/* Place detail sheet */}
      <PlaceDetailSheet
        visible={!!detailPlace}
        placeId={detailPlace?.placeId ?? null}
        placeName={detailPlace?.name}
        onClose={() => setDetailPlace(null)}
      />
    </Screen>
  );
}

function CategoryChip({
  cat,
  active,
  onPress,
  theme,
}: {
  cat: Category;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.92, { duration: 80, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 350 });
      }}
    >
      <Animated.View
        style={[
          animStyle,
          styles.chip,
          {
            backgroundColor: active ? theme.colors.accent : theme.colors.bg.surface,
            borderColor: active ? theme.colors.accent : theme.colors.border.default,
          },
        ]}
      >
        <Text style={styles.chipEmoji}>{cat.emoji}</Text>
        <Text
          style={[
            theme.typography.caption,
            { color: active ? '#FFFFFF' : theme.colors.text.primary, fontWeight: '600' },
          ]}
        >
          {cat.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function NoSelection({
  theme,
  onPickCategory,
}: {
  theme: ReturnType<typeof useTheme>;
  onPickCategory: (cat: Category) => void;
}): React.ReactElement {
  return (
    <View style={styles.noSelectionWrap}>
      <Text style={[theme.typography.h3, { color: theme.colors.text.primary, marginBottom: 6 }]}>
        What's the vibe?
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginBottom: 20 }]}>
        Pick a category to see what's nearby.
      </Text>
      <View style={styles.bigGrid}>
        {CATEGORIES.slice(0, 6).map((cat) => (
          <BigCategoryTile key={cat.id} cat={cat} onPress={() => onPickCategory(cat)} theme={theme} />
        ))}
      </View>
    </View>
  );
}

function BigCategoryTile({
  cat,
  onPress,
  theme,
}: {
  cat: Category;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.94, { duration: 100, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 300 });
      }}
      style={{ width: '30.5%' }}
    >
      <Animated.View
        style={[
          animStyle,
          styles.bigChip,
          {
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
          },
        ]}
      >
        <Text style={styles.bigEmoji}>{cat.emoji}</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary, marginTop: 6, fontWeight: '600' }]}>
          {cat.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function PlaceCard({
  place,
  onPress,
  theme,
}: {
  place: Place;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  const photo = place.photos?.[0];
  const stars = place.rating ? `${place.rating.toFixed(1)}` : null;
  const price = place.priceLevel ? '$'.repeat(place.priceLevel) : null;

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 350 });
      }}
    >
      <Animated.View
        style={[
          animStyle,
          styles.card,
          {
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
          },
        ]}
      >
        {/* Photo */}
        {photo ? (
          <Image
            source={{ uri: getPlacePhotoUrl(photo, 300) }}
            style={styles.cardPhoto}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.cardPhoto, { backgroundColor: theme.colors.bg.canvas, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 30 }}>🏠</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
            numberOfLines={1}
          >
            {place.name}
          </Text>
          {place.primaryType && (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 2 }]} numberOfLines={1}>
              {place.primaryType}
            </Text>
          )}
          <Text
            style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 3 }]}
            numberOfLines={2}
          >
            {place.address}
          </Text>
          {(stars || price) && (
            <View style={styles.metaRow}>
              {stars && (
                <View style={styles.ratingPill}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text style={[theme.typography.caption, { color: theme.colors.text.primary, fontWeight: '700', marginLeft: 3 }]}>
                    {stars}
                  </Text>
                </View>
              )}
              {price && (
                <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, fontWeight: '600' }]}>
                  {price}
                </Text>
              )}
            </View>
          )}
        </View>

        <ChevronRight size={16} color={theme.colors.text.tertiary} style={{ marginRight: 4 }} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipStrip: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 14,
  },
  centered: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 4,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  noSelectionWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bigGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bigChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  bigEmoji: {
    fontSize: 28,
  },
  resultsList: {
    paddingTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 12,
    paddingRight: 12,
  },
  cardPhoto: {
    width: 96,
    height: 96,
  },
  cardInfo: {
    flex: 1,
    paddingVertical: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
