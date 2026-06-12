import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Search, X, Star, ChevronLeft, MapPin } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { searchPlaces, getPlacePhotoUrl } from '@/features/places';
import { useSearchLocation } from '@/features/places/hooks/useSearchLocation';
import { useQuery } from '@tanstack/react-query';
import { useUpsertRating } from '../hooks/useRatings';
import { toast } from '@/stores/ui.store';
import { STAR_LABELS } from '../types';
import type { RatablePlace } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialPlace?: RatablePlace | null;
};

type Step = 'search' | 'rate';

export function RateRestaurantSheet({ visible, onClose, onSaved, initialPlace }: Props): React.ReactElement {
  const theme = useTheme();
  const upsert = useUpsertRating();
  const searchLoc = useSearchLocation();

  const [step, setStep] = useState<Step>(initialPlace ? 'rate' : 'search');
  const [place, setPlace] = useState<RatablePlace | null>(initialPlace ?? null);
  const [query, setQuery] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [rating, setRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [notes, setNotes] = useState('');

  const debouncedQuery = useDebounce(query, 350);
  const location = searchLoc.data ?? undefined;

  const search = useQuery({
    queryKey: ['ratings', 'search', debouncedQuery, location],
    queryFn: () => searchPlaces({ query: debouncedQuery, location, radius: 8000 }),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  // Reset when opened
  useEffect(() => {
    if (visible) {
      if (initialPlace) {
        setPlace(initialPlace);
        setStep('rate');
      } else {
        setStep('search');
        setPlace(null);
      }
      setQuery('');
      setRating(0);
      setNotes('');
      setShowManual(false);
      setManualName('');
      setManualAddress('');
    }
  }, [visible, initialPlace]);

  const handleSelectPlace = (p: RatablePlace) => {
    setPlace(p);
    setStep('rate');
    setQuery('');
    Keyboard.dismiss();
  };

  const handleManualAdd = () => {
    if (!manualName.trim()) return;
    handleSelectPlace({
      place_id: `manual:${Date.now()}`,
      place_name: manualName.trim(),
      place_address: manualAddress.trim() || null,
      place_photo: null,
      place_type: null,
    });
  };

  const handleSave = () => {
    if (!place || rating === 0) return;
    upsert.mutate(
      {
        place_id: place.place_id,
        place_name: place.place_name,
        place_address: place.place_address,
        place_photo: place.place_photo,
        place_type: place.place_type,
        rating: rating as 1 | 2 | 3 | 4 | 5,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          onClose();
          onSaved?.();
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to save rating';
          toast.error(msg);
        },
      },
    );
  };

  const photoUrl = place?.place_photo ? getPlacePhotoUrl(place.place_photo, 800) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
          {step === 'rate' && !initialPlace ? (
            <Pressable onPress={() => setStep('search')} hitSlop={12} style={styles.headerBtn}>
              <ChevronLeft size={22} color={theme.colors.text.primary} strokeWidth={2} />
            </Pressable>
          ) : (
            <View style={styles.headerBtn} />
          )}
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
            {step === 'search' ? 'Rate a restaurant' : 'Your rating'}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
            <X size={20} color={theme.colors.text.secondary} strokeWidth={2} />
          </Pressable>
        </View>

        {step === 'search' ? (
          <SearchStep
            query={query}
            setQuery={setQuery}
            results={search.data}
            isLoading={search.isLoading}
            showManual={showManual}
            setShowManual={setShowManual}
            manualName={manualName}
            setManualName={setManualName}
            manualAddress={manualAddress}
            setManualAddress={setManualAddress}
            onSelectPlace={handleSelectPlace}
            onManualAdd={handleManualAdd}
            theme={theme}
          />
        ) : (
          <RateStep
            place={place!}
            photoUrl={photoUrl}
            rating={rating}
            setRating={setRating}
            notes={notes}
            setNotes={setNotes}
            onSave={handleSave}
            isSaving={upsert.isPending}
            theme={theme}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Search step ───────────────────────────────────────────────────────────────

function SearchStep({
  query, setQuery,
  results, isLoading,
  showManual, setShowManual,
  manualName, setManualName,
  manualAddress, setManualAddress,
  onSelectPlace, onManualAdd,
  theme,
}: {
  query: string; setQuery: (v: string) => void;
  results: any[] | undefined; isLoading: boolean;
  showManual: boolean; setShowManual: (v: boolean) => void;
  manualName: string; setManualName: (v: string) => void;
  manualAddress: string; setManualAddress: (v: string) => void;
  onSelectPlace: (p: RatablePlace) => void;
  onManualAdd: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
        <Search size={16} color={theme.colors.text.tertiary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text.primary }]}
          placeholder="Search a restaurant…"
          placeholderTextColor={theme.colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X size={14} color={theme.colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {/* Add manually */}
      {!showManual ? (
        <Pressable onPress={() => setShowManual(true)} style={styles.manualLink}>
          <Text style={[theme.typography.caption, { color: theme.colors.accent }]}>
            + Add a place manually
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.manualForm, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default }]}>
          <TextInput
            style={[styles.manualInput, { color: theme.colors.text.primary, backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
            placeholder="Restaurant name *"
            placeholderTextColor={theme.colors.text.tertiary}
            value={manualName}
            onChangeText={setManualName}
            autoFocus
            maxLength={200}
          />
          <TextInput
            style={[styles.manualInput, { color: theme.colors.text.primary, backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
            placeholder="Address (optional)"
            placeholderTextColor={theme.colors.text.tertiary}
            value={manualAddress}
            onChangeText={setManualAddress}
            maxLength={300}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Continue" onPress={onManualAdd} disabled={!manualName.trim()} size="sm" />
            <Button label="Cancel" variant="ghost" onPress={() => setShowManual(false)} size="sm" />
          </View>
        </View>
      )}

      {/* Results */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : query.length < 2 ? (
        <View style={styles.centered}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
            Start typing to search
          </Text>
        </View>
      ) : results && results.length > 0 ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          {results.slice(0, 12).map((p) => (
            <Pressable
              key={p.placeId}
              onPress={() => onSelectPlace({
                place_id: p.placeId,
                place_name: p.name,
                place_address: p.address,
                place_photo: p.photos?.[0] ?? null,
                place_type: p.primaryType,
              })}
              style={({ pressed }) => [
                styles.resultRow,
                { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
                pressed && { opacity: 0.7 },
              ]}
            >
              {p.photos?.[0] ? (
                <Image
                  source={{ uri: getPlacePhotoUrl(p.photos[0], 120) }}
                  style={styles.resultPhoto}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.resultPhoto, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 20 }}>🍽️</Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary, fontWeight: '600' }]} numberOfLines={1}>
                  {p.name}
                </Text>
                {p.primaryType ? (
                  <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                    {p.primaryType}
                  </Text>
                ) : null}
                {p.address ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                    <MapPin size={10} color={theme.colors.text.tertiary} strokeWidth={2} />
                    <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, flex: 1 }]} numberOfLines={1}>
                      {p.address}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
            No results. Try a different name or add manually.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Rate step ─────────────────────────────────────────────────────────────────

function RateStep({
  place, photoUrl,
  rating, setRating,
  notes, setNotes,
  onSave, isSaving,
  theme,
}: {
  place: RatablePlace; photoUrl: string | null;
  rating: 0|1|2|3|4|5; setRating: (v: 0|1|2|3|4|5) => void;
  notes: string; setNotes: (v: string) => void;
  onSave: () => void; isSaving: boolean;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Photo banner */}
      <View style={styles.photoBanner}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 48 }}>🍽️</Text>
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        <View style={styles.bannerText}>
          <Text style={styles.bannerName} numberOfLines={2}>{place.place_name}</Text>
          {place.place_type ? (
            <Text style={styles.bannerType}>{place.place_type}</Text>
          ) : null}
        </View>
      </View>

      {/* Stars */}
      <View style={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 20 }]}>
          How was it?
        </Text>
        <StarSelector rating={rating} setRating={setRating} theme={theme} />

        {/* Note */}
        <View style={[styles.noteBox, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
          <TextInput
            style={[theme.typography.body, { color: theme.colors.text.primary, minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Add a note… (optional)"
            placeholderTextColor={theme.colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            maxLength={280}
            multiline
          />
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, textAlign: 'right', marginTop: 4 }]}>
            {notes.length}/280
          </Text>
        </View>

        <Button
          label={isSaving ? 'Saving…' : rating === 0 ? 'Pick a rating to save' : 'Save rating'}
          onPress={onSave}
          disabled={rating === 0 || isSaving}
          loading={isSaving}
          fullWidth
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

// ── Star selector ─────────────────────────────────────────────────────────────

function StarSelector({
  rating, setRating, theme,
}: {
  rating: 0|1|2|3|4|5;
  setRating: (v: 0|1|2|3|4|5) => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  return (
    <View style={{ alignItems: 'center', marginBottom: 24 }}>
      <View style={styles.starsRow}>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <StarButton
            key={n}
            n={n}
            filled={n <= rating}
            onPress={() => setRating(rating === n ? 0 : n)}
            accent={theme.colors.accent}
          />
        ))}
      </View>
      {rating > 0 && (
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent, fontWeight: '700', marginTop: 10 }]}>
          {STAR_LABELS[rating]}
        </Text>
      )}
    </View>
  );
}

function StarButton({ n, filled, onPress, accent }: { n: number; filled: boolean; onPress: () => void; accent: string }): React.ReactElement {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(1.4, { damping: 4, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    onPress();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Animated.View style={animStyle}>
        <Star
          size={38}
          color={filled ? accent : '#D1D5DB'}
          fill={filled ? accent : 'transparent'}
          strokeWidth={filled ? 0 : 1.5}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 36,
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  manualLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  manualForm: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  manualInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  resultPhoto: {
    width: 48,
    height: 48,
    borderRadius: 10,
    flexShrink: 0,
  },
  photoBanner: {
    height: 220,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bannerText: {
    padding: 16,
  },
  bannerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  bannerType: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  noteBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    marginBottom: 20,
  },
});
