import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { MapPin, Star, Navigation, ExternalLink, List, Map, Search, X } from 'lucide-react-native';
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
const NYC: { lat: number; lng: number } = { lat: 40.758, lng: -73.9855 };


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
type LatLng = { lat: number; lng: number };

function openInMaps(place: Place): void {
  const name = encodeURIComponent(place.name);
  if (place.location) {
    const { lat, lng } = place.location;
    if (Platform.OS === 'ios') {
      Linking.openURL(`maps://?q=${name}&ll=${lat},${lng}`).catch(() =>
        Linking.openURL(`https://maps.apple.com/?q=${name}&ll=${lat},${lng}`),
      );
    } else {
      Linking.openURL(`geo:${lat},${lng}?q=${name}`).catch(() =>
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`),
      );
    }
  } else {
    Linking.openURL(place.mapsUrl ?? `https://maps.apple.com/?q=${name}`).catch(() => {});
  }
}

function openCategoryInMaps(cat: Category, locationName?: string): void {
  const q = encodeURIComponent(
    locationName ? `${cat.query} near ${locationName}` : cat.query,
  );
  if (Platform.OS === 'ios') {
    Linking.openURL(`maps://?q=${q}`).catch(() =>
      Linking.openURL(`https://maps.apple.com/?q=${q}`),
    );
  } else {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  }
}

export default function ExploreScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPin, setSelectedPin] = useState<Place | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [searchText, setSearchText] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');

  const mapRef = useRef<MapView>(null);
  const mapListRef = useRef<FlatList>(null);
  const searchRef = useRef<TextInput>(null);
  const location = useSearchLocation();

  // Request location permission once and get coords
  useEffect(() => {
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== 'granted') return null;
        return Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      })
      .then((pos) => {
        if (pos) setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      })
      .catch(() => {});
  }, []);

  const EXPLORE_RADIUS = 4828;
  const searchCenter: LatLng = location.data ?? userLocation ?? NYC;

  const activeQuery = activeCategory?.query ?? committedSearch;

  const placesQuery = useQuery({
    queryKey: ['explore', activeCategory?.id ?? committedSearch, searchCenter.lat, searchCenter.lng],
    queryFn: () =>
      searchPlaces({
        query: activeQuery,
        location: searchCenter,
        radius: EXPLORE_RADIUS,
      }),
    enabled: !!activeCategory || !!committedSearch,
    staleTime: 5 * 60_000,
    retry: 1,
    select: (data) => filterByRadius(data, location.data ?? null, EXPLORE_RADIUS),
  });

  const results = placesQuery.data ?? [];

  // Animate map to center when entering map mode or user location resolves
  useEffect(() => {
    if (viewMode !== 'map' || !mapRef.current) return;
    const center = userLocation ?? location.data ?? NYC;
    mapRef.current.animateToRegion(
      { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 },
      600,
    );
  }, [viewMode, userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  function submitSearch() {
    const q = searchText.trim();
    if (!q) return;
    setActiveCategory(null);
    setSelectedPin(null);
    setCommittedSearch(q);
    searchRef.current?.blur();
  }

  function clearSearch() {
    setSearchText('');
    setCommittedSearch('');
    setSelectedPin(null);
    searchRef.current?.blur();
  }

  // Auto-select & pan to first result when results arrive in map mode
  useEffect(() => {
    if (viewMode !== 'map' || results.length === 0) return;
    const first = results[0]!;
    setSelectedPin(first);
    if (first.location && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: first.location.lat, longitude: first.location.lng, latitudeDelta: 0.015, longitudeDelta: 0.015 },
        500,
      );
    }
  }, [viewMode, activeCategory?.id, committedSearch, results.length > 0 ? results[0]!.placeId : null]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectMapPlace(place: Place) {
    setSelectedPin(place);
    if (place.location && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: place.location.lat, longitude: place.location.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        350,
      );
    }
    const idx = results.findIndex((p) => p.placeId === place.placeId);
    if (idx >= 0) mapListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  }

  const mapInitialRegion: Region = {
    latitude: searchCenter.lat,
    longitude: searchCenter.lng,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

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

        <View style={[styles.toggle, { backgroundColor: theme.colors.bg.subtle }]}>
          <ToggleBtn
            icon={<List size={15} color={viewMode === 'list' ? '#FFF' : theme.colors.text.secondary} strokeWidth={2} />}
            label="List"
            active={viewMode === 'list'}
            onPress={() => setViewMode('list')}
          />
          <ToggleBtn
            icon={<Map size={15} color={viewMode === 'map' ? '#FFF' : theme.colors.text.secondary} strokeWidth={2} />}
            label="Map"
            active={viewMode === 'map'}
            onPress={() => setViewMode('map')}
          />
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: theme.colors.bg.canvas }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default }]}>
          <Search size={16} color={theme.colors.text.tertiary} strokeWidth={2} />
          <TextInput
            ref={searchRef}
            style={[styles.searchInput, { color: theme.colors.text.primary }]}
            placeholder="Search places…"
            placeholderTextColor={theme.colors.text.tertiary}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {searchText.length > 0 && (
            <Pressable onPress={clearSearch} hitSlop={8}>
              <X size={15} color={theme.colors.text.tertiary} strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
        {searchText.trim().length > 0 && (
          <Pressable onPress={submitSearch} style={[styles.searchBtn, { backgroundColor: ACCENT }]}>
            <Text style={styles.searchBtnText}>Go</Text>
          </Pressable>
        )}
      </View>

      {/* Category chips */}
      <View style={[styles.chipsBar, { borderBottomColor: theme.colors.border.default }]}>
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={[
            styles.locationChip,
            { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
          ]}
        >
          <MapPin size={13} color={ACCENT} />
          <Text style={[styles.locationChipText, { color: theme.colors.text.primary }]} numberOfLines={1}>
            {location.data ? location.data.name : 'Nearby'}
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
                  setCommittedSearch('');
                  setSearchText('');
                }}
                theme={theme}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* ── LIST VIEW — hidden (not unmounted) when map is active ──────────── */}
      <View style={{ flex: 1, display: viewMode === 'list' ? 'flex' : 'none' }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {!activeCategory && !committedSearch && (
            <NoSelection
              theme={theme}
              onPickCategory={(cat) => { setActiveCategory(cat); setCommittedSearch(''); setSearchText(''); }}
            />
          )}

          {(activeCategory || committedSearch) && placesQuery.isLoading && (
            <View style={styles.centered}>
              <ActivityIndicator color={ACCENT} size="large" />
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 12 }]}>
                {activeCategory ? `Finding ${activeCategory.label.toLowerCase()} near you…` : `Searching "${committedSearch}"…`}
              </Text>
            </View>
          )}

          {(activeCategory || committedSearch) && placesQuery.isError && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.centered}>
              <Text style={styles.emptyEmoji}>😕</Text>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, marginBottom: 4 }]}>
                Couldn't load results
              </Text>
              {activeCategory && (
                <Pressable
                  onPress={() => openCategoryInMaps(activeCategory, location.data?.name)}
                  style={[styles.mapsBtn, { backgroundColor: ACCENT }]}
                >
                  <ExternalLink size={14} color="#FFF" />
                  <Text style={styles.mapsBtnText}>Search in Maps</Text>
                </Pressable>
              )}
            </Animated.View>
          )}

          {(activeCategory || committedSearch) && !placesQuery.isLoading && !placesQuery.isError && results.length === 0 && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.centered}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Nothing found nearby</Text>
              {activeCategory && (
                <Pressable
                  onPress={() => openCategoryInMaps(activeCategory, location.data?.name)}
                  style={[styles.mapsBtn, { backgroundColor: ACCENT, marginTop: 16 }]}
                >
                  <ExternalLink size={14} color="#FFF" />
                  <Text style={styles.mapsBtnText}>Search in Maps</Text>
                </Pressable>
              )}
            </Animated.View>
          )}

          {results.length > 0 && (
            <View style={styles.resultsList}>
              {activeCategory && (
                <Pressable
                  onPress={() => openCategoryInMaps(activeCategory, location.data?.name)}
                  style={[styles.viewAllRow, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
                >
                  <MapPin size={14} color={ACCENT} />
                  <Text style={[theme.typography.caption, { color: ACCENT, fontWeight: '700', flex: 1 }]}>
                    View all {results.length} on Maps
                  </Text>
                  <ExternalLink size={13} color={ACCENT} />
                </Pressable>
              )}

              {results.map((place, i) => (
                <Animated.View
                  key={place.placeId}
                  entering={FadeInDown.delay(Math.min(i * 40, 400)).springify().damping(18).stiffness(260)}
                >
                  <PlaceCard
                    place={place}
                    onPress={() => setDetailPlace(place)}
                    onDirections={() => openInMaps(place)}
                    theme={theme}
                  />
                </Animated.View>
              ))}
            </View>
          )}

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      </View>

      {/* ── MAP VIEW — hidden (not unmounted) when list is active ─────────── */}
      <View style={{ flex: 1, display: viewMode === 'map' ? 'flex' : 'none' }}>
        {/* MapView — NO Marker children (avoids AIRMap Fabric crash in RN 0.76) */}
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={mapInitialRegion}
          showsUserLocation={!!userLocation}
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          showsTraffic={false}
        />

        {/* Center-pin — stays fixed on screen as map pans beneath it */}
        {selectedPin && (
          <View style={styles.centerPinWrap} pointerEvents="none">
            <MapPin size={44} color={ACCENT} fill={ACCENT + '50'} strokeWidth={1.5} />
            <View style={[styles.centerPinLabel, { backgroundColor: theme.colors.bg.surface }]}>
              <Text style={{ color: theme.colors.text.primary, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                {selectedPin.name}
              </Text>
              {selectedPin.rating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                  <Star size={10} color="#F59E0B" fill="#F59E0B" />
                  <Text style={{ color: theme.colors.text.secondary, fontSize: 11, fontWeight: '600' }}>
                    {selectedPin.rating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* "Pick a vibe" hint pill — only shown when nothing is selected, clean & small */}
        {!activeCategory && !committedSearch && (
          <View style={styles.mapHintRow} pointerEvents="none">
            <View style={[styles.mapHintPill, { backgroundColor: theme.colors.bg.surface + 'F2' }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, fontWeight: '600' }]}>
                Pick a vibe from the chips above
              </Text>
            </View>
          </View>
        )}

        {/* Compact loading chip */}
        {(activeCategory || committedSearch) && placesQuery.isLoading && (
          <View style={styles.mapHintRow} pointerEvents="none">
            <View style={[styles.mapLoadingChip, { backgroundColor: theme.colors.bg.surface + 'F2' }]}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, fontWeight: '600' }]}>
                Loading {activeCategory?.label ?? 'places'}…
              </Text>
            </View>
          </View>
        )}

        {/* Results count badge above the card strip */}
        {(activeCategory || committedSearch) && !placesQuery.isLoading && results.length > 0 && (
          <View
            style={[styles.mapResultsBadge, { bottom: insets.bottom + 196 }]}
            pointerEvents="none"
          >
            <View style={[styles.mapBadgePill, { backgroundColor: ACCENT }]}>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>
                {results.length} {activeCategory?.label ?? 'places'} nearby
              </Text>
            </View>
          </View>
        )}

        {/* Bottom horizontal card strip — swipe to browse, tap to pan map */}
        {(activeCategory || committedSearch) && !placesQuery.isLoading && results.length > 0 && (
          <View style={[styles.mapStrip, { bottom: insets.bottom + 16 }]}>
            <FlatList
              ref={mapListRef}
              data={results}
              keyExtractor={(item) => item.placeId}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mapStripContent}
              onScrollToIndexFailed={() => {}}
              renderItem={({ item }) => {
                const active = selectedPin?.placeId === item.placeId;
                return (
                  <Pressable
                    onPress={() => selectMapPlace(item)}
                    style={[
                      styles.mapCard,
                      {
                        backgroundColor: theme.colors.bg.surface,
                        borderColor: active ? ACCENT : theme.colors.border.default,
                        borderWidth: active ? 2 : StyleSheet.hairlineWidth,
                        shadowColor: active ? ACCENT : '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: active ? 0.25 : 0.12,
                        shadowRadius: 12,
                        elevation: active ? 10 : 5,
                      },
                    ]}
                  >
                    {item.photos?.[0] ? (
                      <Image
                        source={{ uri: getPlacePhotoUrl(item.photos[0], 300) }}
                        style={styles.mapCardPhoto}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.mapCardPhoto, { backgroundColor: ACCENT + '12', alignItems: 'center', justifyContent: 'center' }]}>
                        <MapPin size={22} color={ACCENT + '60'} />
                      </View>
                    )}
                    <View style={styles.mapCardBody}>
                      <Text
                        style={{ color: theme.colors.text.primary, fontWeight: '700', fontSize: 13 }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.primaryType ? (
                        <Text style={{ color: theme.colors.text.tertiary, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                          {item.primaryType}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        {item.rating ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Star size={10} color="#F59E0B" fill="#F59E0B" />
                            <Text style={{ color: theme.colors.text.primary, fontWeight: '700', fontSize: 11 }}>
                              {item.rating.toFixed(1)}
                            </Text>
                          </View>
                        ) : null}
                        {item.priceLevel ? (
                          <Text style={{ color: theme.colors.text.tertiary, fontSize: 11, fontWeight: '600' }}>
                            {'$'.repeat(item.priceLevel)}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.mapCardActions}>
                        <Pressable
                          onPress={(e) => { e.stopPropagation(); openInMaps(item); }}
                          style={[styles.mapCardBtn, { backgroundColor: ACCENT + '15' }]}
                          hitSlop={6}
                        >
                          <Navigation size={13} color={ACCENT} strokeWidth={2} />
                        </Pressable>
                        <Pressable
                          onPress={(e) => { e.stopPropagation(); setDetailPlace(item); }}
                          style={[styles.mapCardBtn, { backgroundColor: ACCENT }]}
                          hitSlop={6}
                        >
                          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 11 }}>Info</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        )}
      </View>

      <LocationPickerSheet visible={pickerVisible} onClose={() => setPickerVisible(false)} />

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
  icon, label, active, onPress,
}: { icon: React.ReactNode; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggleBtn, active && { backgroundColor: ACCENT }]}>
      {icon}
      <Text style={[styles.toggleLabel, { color: active ? '#FFF' : '#9CA3AF' }]}>{label}</Text>
    </Pressable>
  );
}

function CategoryChip({
  cat, active, onPress, theme,
}: { cat: Category; active: boolean; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
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
          animStyle, styles.chip,
          { backgroundColor: active ? ACCENT : theme.colors.bg.surface, borderColor: active ? ACCENT : theme.colors.border.default },
        ]}
      >
        <Text style={styles.chipEmoji}>{cat.emoji}</Text>
        <Text style={[theme.typography.caption, { color: active ? '#FFF' : theme.colors.text.primary, fontWeight: '600' }]}>
          {cat.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function NoSelection({
  theme, onPickCategory,
}: { theme: ReturnType<typeof useTheme>; onPickCategory: (cat: Category) => void }) {
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
  cat, onPress, theme,
}: { cat: Category; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.94, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
      style={{ width: '30.5%' }}
    >
      <Animated.View
        style={[animStyle, styles.bigChip, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
      >
        <Text style={styles.bigEmoji}>{cat.emoji}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.primary, marginTop: 6, fontWeight: '600' }]}>
          {cat.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function PlaceCard({
  place, onPress, onDirections, theme,
}: { place: Place; onPress: () => void; onDirections: () => void; theme: ReturnType<typeof useTheme> }) {
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
        style={[animStyle, styles.card, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
      >
        {photo ? (
          <Image source={{ uri: getPlacePhotoUrl(photo, 300) }} style={styles.cardPhoto} contentFit="cover" />
        ) : (
          <View style={[styles.cardPhoto, { backgroundColor: ACCENT + '10', alignItems: 'center', justifyContent: 'center' }]}>
            <MapPin size={22} color={ACCENT + '60'} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]} numberOfLines={1}>
            {place.name}
          </Text>
          {place.primaryType ? (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 2 }]} numberOfLines={1}>
              {place.primaryType}
            </Text>
          ) : null}
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 3 }]} numberOfLines={1}>
            {place.address}
          </Text>
          <View style={styles.metaRow}>
            {place.rating ? (
              <View style={styles.ratingRow}>
                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                <Text style={[theme.typography.caption, { color: theme.colors.text.primary, fontWeight: '700', marginLeft: 3 }]}>
                  {place.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
            {place.priceLevel ? (
              <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, fontWeight: '600' }]}>
                {'$'.repeat(place.priceLevel)}
              </Text>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={(e) => { e.stopPropagation(); onDirections(); }}
          hitSlop={8}
          style={[styles.directionsBtn, { backgroundColor: ACCENT + '12' }]}
        >
          <Navigation size={15} color={ACCENT} strokeWidth={2} />
        </Pressable>
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
  navTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  toggle: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 2 },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  toggleLabel: { fontSize: 13, fontWeight: '600' },
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
  locationChipText: { fontSize: 12, fontWeight: '600' },
  chipStrip: { gap: 8, paddingRight: 12, alignItems: 'center' },
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
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
  },
  mapsBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  noSelectionWrap: { paddingHorizontal: 16, paddingTop: 16 },
  bigGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bigChip: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, borderRadius: 16, borderWidth: 1 },
  bigEmoji: { fontSize: 28 },
  resultsList: { paddingTop: 12, paddingHorizontal: 16, gap: 10 },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  directionsBtn: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  // Search bar
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  // Map
  centerPinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPinLabel: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: 220,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  mapHintRow: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mapHintPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mapLoadingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mapResultsBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mapBadgePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  mapStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  mapStripContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  mapCard: {
    width: 180,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapCardPhoto: {
    width: '100%',
    height: 110,
  },
  mapCardBody: {
    padding: 10,
  },
  mapCardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  mapCardBtn: {
    flex: 1,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
