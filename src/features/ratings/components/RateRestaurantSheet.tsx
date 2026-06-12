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
import { useUpsertRating, useHangoutPlaces, useUpsertMediaRating } from '../hooks/useRatings';
import { searchMovies } from '@/features/movies/services/movies.service';
import { toast } from '@/stores/ui.store';
import { STAR_LABELS } from '../types';
import type { RatablePlace, HangoutPlace, UpsertMediaRatingInput } from '../types';
import type { MovieOption } from '@/features/movies/types';

type RatingCategory = 'place' | 'media';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialPlace?: RatablePlace | null;
  hangoutId?: string;
};

type Step = 'search' | 'rate';

export function RateRestaurantSheet({ visible, onClose, onSaved, initialPlace, hangoutId }: Props): React.ReactElement {
  const theme = useTheme();
  const upsert = useUpsertRating();
  const upsertMedia = useUpsertMediaRating();
  const searchLoc = useSearchLocation();
  const hangoutPlaces = useHangoutPlaces(hangoutId);

  const [category, setCategory] = useState<RatingCategory>('place');
  const [step, setStep] = useState<Step>(initialPlace ? 'rate' : 'search');
  const [place, setPlace] = useState<RatablePlace | null>(initialPlace ?? null);
  const [movie, setMovie] = useState<MovieOption | null>(null);
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
        setCategory('place');
      } else {
        setStep('search');
        setPlace(null);
        setMovie(null);
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
    setMovie(null);
    setStep('rate');
    setQuery('');
    Keyboard.dismiss();
  };

  const handleSelectMovie = (m: MovieOption) => {
    setMovie(m);
    setPlace(null);
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

  const isSaving = upsert.isPending || upsertMedia.isPending;

  const handleSave = () => {
    if (rating === 0) return;

    const onSuccess = () => { onClose(); onSaved?.(); };
    const onError = (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save rating');
    };

    if (category === 'media' && movie) {
      upsertMedia.mutate(
        {
          tmdb_id: movie.tmdbId,
          media_type: movie.mediaType,
          title: movie.title,
          poster_url: movie.posterUrl,
          year: movie.year,
          genre: movie.genres[0] ?? null,
          rating: rating as 1 | 2 | 3 | 4 | 5,
          notes: notes.trim() || null,
        } satisfies UpsertMediaRatingInput,
        { onSuccess, onError },
      );
    } else if (place) {
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
        { onSuccess, onError },
      );
    }
  };

  const photoUrl = place?.place_photo ? getPlacePhotoUrl(place.place_photo, 800) : null;
  const posterUrl = movie?.posterUrl ?? null;
  const rateSubject = category === 'media' && movie
    ? { name: movie.title, type: movie.mediaType === 'tv' ? 'TV Show' : 'Movie', photo: posterUrl, isPoster: true }
    : place
    ? { name: place.place_name, type: place.place_type ?? null, photo: photoUrl, isPoster: false }
    : null;

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
            {step === 'search' ? 'Add a rating' : 'Your rating'}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
            <X size={20} color={theme.colors.text.secondary} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Category pill — only in search step, only when no initialPlace */}
        {step === 'search' && !initialPlace && (
          <View style={[styles.categoryRow, { borderBottomColor: theme.colors.border.default }]}>
            {(['place', 'media'] as RatingCategory[]).map((cat) => (
              <Pressable
                key={cat}
                onPress={() => { setCategory(cat); setQuery(''); }}
                style={[
                  styles.categoryPill,
                  category === cat && { backgroundColor: '#8B5CF6' },
                  category !== cat && { backgroundColor: theme.colors.bg.subtle },
                ]}
              >
                <Text style={[
                  theme.typography.bodySmall,
                  { fontWeight: '600', color: category === cat ? '#fff' : theme.colors.text.secondary },
                ]}>
                  {cat === 'place' ? '🍽️  Places' : '🎬  Movies & Shows'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {step === 'search' ? (
          category === 'place' ? (
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
              hangoutPlaces={hangoutPlaces.data ?? []}
              hangoutId={hangoutId}
              theme={theme}
            />
          ) : (
            <MovieSearchStep
              query={query}
              setQuery={setQuery}
              onSelectMovie={handleSelectMovie}
              theme={theme}
            />
          )
        ) : (
          <RateStep
            name={rateSubject?.name ?? ''}
            type={rateSubject?.type ?? null}
            photoUrl={rateSubject?.photo ?? null}
            isPoster={rateSubject?.isPoster ?? false}
            rating={rating}
            setRating={setRating}
            notes={notes}
            setNotes={setNotes}
            onSave={handleSave}
            isSaving={isSaving}
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
  hangoutPlaces, hangoutId,
  theme,
}: {
  query: string; setQuery: (v: string) => void;
  results: any[] | undefined; isLoading: boolean;
  showManual: boolean; setShowManual: (v: boolean) => void;
  manualName: string; setManualName: (v: string) => void;
  manualAddress: string; setManualAddress: (v: string) => void;
  onSelectPlace: (p: RatablePlace) => void;
  onManualAdd: () => void;
  hangoutPlaces: HangoutPlace[];
  hangoutId?: string;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  const showHangoutPlaces = hangoutPlaces.length > 0 && query.length < 2;
  const sectionLabel = hangoutId ? 'From this hangout' : 'From your hangouts';

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

      {/* Hangout places — shown when not actively searching */}
      {showHangoutPlaces && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
            {sectionLabel}
          </Text>
          <View style={{ gap: 8 }}>
            {hangoutPlaces.map((hp, i) => (
              <Pressable
                key={`${hp.hangout_id}-${i}`}
                onPress={() => onSelectPlace({
                  place_id: hp.place_id ?? `manual:${hp.name}`,
                  place_name: hp.name,
                  place_address: hp.address,
                  place_photo: null,
                  place_type: hp.primary_type,
                })}
                style={({ pressed }) => [
                  styles.resultRow,
                  { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.accent + '40' },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={[styles.resultPhoto, { backgroundColor: theme.colors.accent + '18', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 20 }}>🍽️</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary, fontWeight: '600' }]} numberOfLines={1}>
                    {hp.name}
                  </Text>
                  {hp.primary_type ? (
                    <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                      {hp.primary_type}
                    </Text>
                  ) : null}
                  {!hangoutId && hp.hangout_title ? (
                    <Text style={[theme.typography.caption, { color: theme.colors.accent, marginTop: 1 }]} numberOfLines={1}>
                      {hp.hangout_title}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
          {query.length === 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 12, textAlign: 'center' }]}>
              or search for any restaurant above
            </Text>
          )}
        </View>
      )}

      {/* Search results */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : query.length < 2 ? (
        !showHangoutPlaces ? (
        <View style={styles.centered}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
            Start typing to search
          </Text>
        </View>
        ) : null
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

// ── Movie search step ─────────────────────────────────────────────────────────

function MovieSearchStep({
  query, setQuery, onSelectMovie, theme,
}: {
  query: string; setQuery: (v: string) => void;
  onSelectMovie: (m: MovieOption) => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  const debouncedQuery = useDebounce(query, 400);
  const search = useQuery({
    queryKey: ['movie-search-rate', debouncedQuery],
    queryFn: () => searchMovies(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.searchBar, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
        <Search size={16} color={theme.colors.text.tertiary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text.primary }]}
          placeholder="Search movies & shows…"
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

      {search.isLoading ? (
        <View style={styles.centered}><ActivityIndicator color={theme.colors.accent} /></View>
      ) : query.length < 2 ? (
        <View style={styles.centered}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
            Search for a movie or TV show
          </Text>
        </View>
      ) : (search.data ?? []).length > 0 ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          {(search.data ?? []).slice(0, 12).map((m) => (
            <Pressable
              key={m.id}
              onPress={() => onSelectMovie(m)}
              style={({ pressed }) => [
                styles.resultRow,
                { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
                pressed && { opacity: 0.7 },
              ]}
            >
              {m.posterUrl ? (
                <Image source={{ uri: m.posterUrl }} style={styles.moviePoster} contentFit="cover" />
              ) : (
                <View style={[styles.moviePoster, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 20 }}>🎬</Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary, fontWeight: '600' }]} numberOfLines={1}>{m.title}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, alignItems: 'center' }}>
                  {m.year ? <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>{m.year}</Text> : null}
                  <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: m.mediaType === 'tv' ? '#3B82F620' : '#F59E0B20' }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: m.mediaType === 'tv' ? '#3B82F6' : '#F59E0B' }}>{m.mediaType === 'tv' ? 'TV' : 'Film'}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.centered}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>No results found.</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Rate step ─────────────────────────────────────────────────────────────────

function RateStep({
  name, type, photoUrl, isPoster,
  rating, setRating,
  notes, setNotes,
  onSave, isSaving,
  theme,
}: {
  name: string; type: string | null;
  photoUrl: string | null; isPoster: boolean;
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
      <View style={[styles.photoBanner, isPoster && styles.posterBanner]}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit={isPoster ? 'contain' : 'cover'} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 48 }}>{isPoster ? '🎬' : '🍽️'}</Text>
          </View>
        )}
        {!isPoster && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />}
        <View style={[styles.bannerText, isPoster && { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, margin: 12 }]}>
          <Text style={styles.bannerName} numberOfLines={2}>{name}</Text>
          {type ? (
            <Text style={styles.bannerType}>{type}</Text>
          ) : null}
        </View>
      </View>

      {/* Stars */}
      <View style={{ paddingHorizontal: 24, paddingTop: isPoster ? 16 : 28, paddingBottom: 8 }}>
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
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 20,
  },
  moviePoster: {
    width: 40,
    height: 56,
    borderRadius: 6,
    flexShrink: 0,
  },
  photoBanner: {
    height: 220,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  posterBanner: {
    height: 280,
    backgroundColor: '#111',
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
