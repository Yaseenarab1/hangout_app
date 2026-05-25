import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
  SlideInDown,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MapPin, ChevronRight, Star, List, Map, X } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { searchPlaces, getPlacePhotoUrl } from '@/features/places';
import { useSearchLocation } from '@/features/places/hooks/useSearchLocation';
import { filterByRadius } from '@/features/places/utils/distance';
import { LocationPickerSheet } from '@/features/places/components/LocationPickerSheet';
import { PlaceDetailSheet } from '@/features/places/components/PlaceDetailSheet';
import type { Place } from '@/features/places';

const ACCENT = '#8B5CF6';
const { height: SCREEN_H } = Dimensions.get('window');

// NYC Times Square default
const DEFAULT_REGION: Region = {
  latitude: 40.758,
  longitude: -73.9855,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

const CATEGORIES = [
  { id: 'bars',          label: 'Bars',      emoji: '🍺', query: 'bars' },
  { id: 'restaurants',   label: 'Eats',      emoji: '🍽️', query: 'restaurants' },
  { id: 'brunch',        label: 'Brunch',    emoji: '🥂', query: 'brunch spots' },
  { id: 'coffee',        label: 'Coffee',    emoji: '☕', query: 'coffee cafes' },
  { id: 'rooftop',       label: 'Rooftop',   emoji: '🌆', query: 'rooftop bars' },
  { id: 'clubs',         label: 'Nightlife', emoji: '🎶', query: 'nightclub dance bars' },
  { id: 'parks',         label: 'Parks',     emoji: '🌿', query: 'parks outdoors' },
  { id: 'entertainment', label: 'Fun',       emoji: '🎳', query: 'bowling arcade entertainment' },
  { id: 'arts',          label: 'Culture',   emoji: '🎭', query: 'museums art galleries' },
  { id: 'dessert',       label: 'Dessert',   emoji: '🍦', query: 'dessert bakery ice cream' },
];

type Category = (typeof CATEGORIES)[number];
type ViewMode = 'list' | 'map';

export default function ExploreScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPin, setSelectedPin] = useState<Place | null>(null);
  const location = useSearchLocation();
  const mapRef = useRef<MapView>(null);

  const EXPLORE_RADIUS = 4828;
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

  const results = placesQuery.data ?? [];

  const mapRegion: Region = location.data
    ? {
        latitude: location.data.lat,
        longitude: location.data.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : DEFAULT_REGION;

  function handlePinTap(place: Place) {
    setSelectedPin(place);
  }

  function handleSwitchToMap() {
    setViewMode('map');
    setSelectedPin(null);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {/* Nav bar */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 16),
            backgroundColor: theme.colors.bg.canvas,
            borderBottomColor: theme.colors.border.default,
          },
        ]}
      >
        <Text style={[styles.navTitle, { color: theme.colors.text.primary }]}>Explore</Text>

        {/* List / Map toggle */}
        <View style={[styles.toggle, { backgroundColor: theme.colors.bg.subtle }]}>
          <ToggleBtn
            icon={<List size={15} color={viewMode === 'list' ? '#FFFFFF' : theme.colors.text.secondary} strokeWidth={2} />}
            label="List"
            active={viewMode === 'list'}
            onPress={() => setViewMode('list')}
          />
          <ToggleBtn
            icon={<Map size={15} color={viewMode === 'map' ? '#FFFFFF' : theme.colors.text.secondary} strokeWidth={2} />}
            label="Map"
            active={viewMode === 'map'}
            onPress={handleSwitchToMap}
          />
        </View>
      </View>

      {/* Category chips — always visible */}
      <View style={[styles.chipsBar, { borderBottomColor: theme.colors.border.default }]}>
        {/* Location banner */}
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={[styles.locationChip, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
        >
          <MapPin size={13} color={ACCENT} />
          <Text style={[styles.locationChipText, { color: theme.colors.text.primary }]} numberOfLines={1}>
            {location.data ? location.data.name : 'Location'}
          </Text>
        </Pressable>

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
                onPress={() => {
                  setActiveCategory(active ? null : cat);
                  setSelectedPin(null);
                }}
                theme={theme}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* ── LIST VIEW ─────────────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {!activeCategory && <NoSelection theme={theme} onPickCategory={setActiveCategory} />}

          {activeCategory && placesQuery.isLoading && (
            <View style={styles.centered}>
              <ActivityIndicator color={ACCENT} size="large" />
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

          {activeCategory && !placesQuery.isLoading && results.length === 0 && !placesQuery.isError && (
            <View style={styles.centered}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Nothing found nearby</Text>
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}>
                Try a different category or change your location.
              </Text>
            </View>
          )}

          {results.length > 0 && (
            <View style={styles.resultsList}>
              {results.map((place, i) => (
                <Animated.View key={place.placeId} entering={FadeInDown.delay(i * 40).springify().damping(18).stiffness(260)}>
                  <PlaceCard
                    place={place}
                    onPress={() => setDetailPlace(place)}
                    theme={theme}
                  />
                </Animated.View>
              ))}
            </View>
          )}

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      )}

      {/* ── MAP VIEW ──────────────────────────────────────────────────────── */}
      {viewMode === 'map' && (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={mapRegion}
            showsUserLocation
            showsMyLocationButton={false}
            userInterfaceStyle={theme.mode === 'dark' ? 'dark' : 'light'}
          >
            {results.filter((p) => p.location).map((place) => (
              <Marker
                key={place.placeId}
                coordinate={{
                  latitude: place.location!.lat,
                  longitude: place.location!.lng,
                }}
                onPress={() => handlePinTap(place)}
                tracksViewChanges={false}
              >
                <View
                  style={[
                    styles.pin,
                    {
                      backgroundColor: selectedPin?.placeId === place.placeId ? ACCENT : '#FFFFFF',
                      borderColor: ACCENT,
                    },
                  ]}
                >
                  <Text style={styles.pinEmoji}>{activeCategory?.emoji ?? '📍'}</Text>
                </View>
              </Marker>
            ))}
          </MapView>

          {/* No category picked — overlay hint */}
          {!activeCategory && (
            <View style={[styles.mapHint, { backgroundColor: theme.colors.bg.surface + 'F0' }]}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                Pick a category above to see places on the map
              </Text>
            </View>
          )}

          {/* Loading overlay */}
          {activeCategory && placesQuery.isLoading && (
            <View style={[styles.mapHint, { backgroundColor: theme.colors.bg.surface + 'F0' }]}>
              <ActivityIndicator color={ACCENT} />
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 8 }]}>
                Loading places…
              </Text>
            </View>
          )}

          {/* Selected pin bottom card */}
          {selectedPin && (
            <Animated.View
              entering={SlideInDown.springify().damping(22).stiffness(300)}
              style={[
                styles.pinCard,
                {
                  bottom: insets.bottom + 16,
                  backgroundColor: theme.colors.bg.surface,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 20,
                  elevation: 16,
                },
              ]}
            >
              <Pressable
                onPress={() => setSelectedPin(null)}
                hitSlop={10}
                style={[styles.pinCardClose, { backgroundColor: theme.colors.bg.subtle }]}
              >
                <X size={14} color={theme.colors.text.secondary} />
              </Pressable>

              <View style={styles.pinCardInner}>
                {selectedPin.photos?.[0] ? (
                  <Image
                    source={{ uri: getPlacePhotoUrl(selectedPin.photos[0], 200) }}
                    style={styles.pinCardPhoto}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.pinCardPhoto, styles.pinCardPhotoFallback, { backgroundColor: ACCENT + '12' }]}>
                    <Text style={{ fontSize: 28 }}>{activeCategory?.emoji ?? '📍'}</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text
                    style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontSize: 16, fontWeight: '700' }]}
                    numberOfLines={1}
                  >
                    {selectedPin.name}
                  </Text>
                  {selectedPin.primaryType && (
                    <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 2 }]} numberOfLines={1}>
                      {selectedPin.primaryType}
                    </Text>
                  )}
                  <View style={styles.pinCardMeta}>
                    {selectedPin.rating && (
                      <View style={styles.ratingRow}>
                        <Star size={11} color="#F59E0B" fill="#F59E0B" />
                        <Text style={[theme.typography.caption, { color: theme.colors.text.primary, fontWeight: '700', marginLeft: 3 }]}>
                          {selectedPin.rating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                    {selectedPin.priceLevel && (
                      <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, fontWeight: '600' }]}>
                        {'$'.repeat(selectedPin.priceLevel)}
                      </Text>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    setDetailPlace(selectedPin);
                    setSelectedPin(null);
                  }}
                  style={({ pressed }) => [styles.pinCardBtn, { opacity: pressed ? 0.7 : 1, backgroundColor: ACCENT }]}
                >
                  <Text style={styles.pinCardBtnText}>Open</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </View>
      )}

      {/* Location picker sheet */}
      <LocationPickerSheet visible={pickerVisible} onClose={() => setPickerVisible(false)} />

      {/* Place detail sheet */}
      <PlaceDetailSheet
        visible={!!detailPlace}
        placeId={detailPlace?.placeId ?? null}
        placeName={detailPlace?.name}
        onClose={() => setDetailPlace(null)}
      />
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ToggleBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleBtn, active && { backgroundColor: ACCENT }]}
    >
      {icon}
      <Text style={[styles.toggleLabel, { color: active ? '#FFFFFF' : '#9CA3AF' }]}>{label}</Text>
    </Pressable>
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
      onPressIn={() => { scale.value = withTiming(0.92, { duration: 80, easing: Easing.out(Easing.cubic) }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 350 }); }}
    >
      <Animated.View
        style={[
          animStyle,
          styles.chip,
          {
            backgroundColor: active ? ACCENT : theme.colors.bg.surface,
            borderColor: active ? ACCENT : theme.colors.border.default,
          },
        ]}
      >
        <Text style={styles.chipEmoji}>{cat.emoji}</Text>
        <Text style={[theme.typography.caption, { color: active ? '#FFFFFF' : theme.colors.text.primary, fontWeight: '600' }]}>
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
}) {
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
      onPressIn={() => { scale.value = withTiming(0.94, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
      style={{ width: '30.5%' }}
    >
      <Animated.View style={[animStyle, styles.bigChip, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
        <Text style={styles.bigEmoji}>{cat.emoji}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.primary, marginTop: 6, fontWeight: '600' }]}>
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
}) {
  const photo = place.photos?.[0];
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 350 }); }}
    >
      <Animated.View
        style={[
          animStyle,
          styles.card,
          { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
        ]}
      >
        {photo ? (
          <Image source={{ uri: getPlacePhotoUrl(photo, 300) }} style={styles.cardPhoto} contentFit="cover" />
        ) : (
          <View style={[styles.cardPhoto, { backgroundColor: ACCENT + '10', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 30 }}>🏠</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]} numberOfLines={1}>
            {place.name}
          </Text>
          {place.primaryType && (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 2 }]} numberOfLines={1}>
              {place.primaryType}
            </Text>
          )}
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 3 }]} numberOfLines={1}>
            {place.address}
          </Text>
          <View style={styles.metaRow}>
            {place.rating && (
              <View style={styles.ratingRow}>
                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                <Text style={[theme.typography.caption, { color: theme.colors.text.primary, fontWeight: '700', marginLeft: 3 }]}>
                  {place.rating.toFixed(1)}
                </Text>
              </View>
            )}
            {place.priceLevel && (
              <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, fontWeight: '600' }]}>
                {'$'.repeat(place.priceLevel)}
              </Text>
            )}
          </View>
        </View>
        <ChevronRight size={16} color={theme.colors.text.tertiary} style={{ marginRight: 4 }} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 0,
    maxWidth: 110,
  },
  locationChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipStrip: {
    gap: 8,
    paddingRight: 12,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 13 },
  centered: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 4,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  noSelectionWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
  bigEmoji: { fontSize: 28 },
  resultsList: { paddingTop: 12, paddingHorizontal: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 12,
    paddingRight: 12,
  },
  cardPhoto: { width: 90, height: 90 },
  cardInfo: { flex: 1, paddingVertical: 10 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  // Map styles
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  pinEmoji: { fontSize: 16 },
  mapHint: {
    position: 'absolute',
    top: SCREEN_H * 0.3,
    left: 32,
    right: 32,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  pinCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 20,
    padding: 16,
  },
  pinCardClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pinCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pinCardPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
    flexShrink: 0,
  },
  pinCardPhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  pinCardBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexShrink: 0,
  },
  pinCardBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
