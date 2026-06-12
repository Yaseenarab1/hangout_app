import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { Search, Star, Check, Plus, Clapperboard, Tv, X, Calendar, Film, SlidersHorizontal } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { SelectionReviewSheet } from '@/components/ui/SelectionReviewSheet';
import { useDebounce } from '@/hooks/useDebounce';
import { useNowPlaying, useStreamingTitles, useMovieSearch } from '../hooks/useMovies';
import type { MovieOption } from '../types';

export type MoviePickerMode = 'cinema' | 'streaming';

export type MoviePickerProps = {
  mode: MoviePickerMode;
  value: MovieOption[];
  onChange: (options: MovieOption[]) => void;
  min?: number;
  max?: number;
};

const PLATFORMS = [
  { id: 8,    name: 'Netflix',    color: '#E50914' },
  { id: 15,   name: 'Hulu',       color: '#1CE783' },
  { id: 1899, name: 'Max',        color: '#002BE7' },
  { id: 337,  name: 'Disney+',    color: '#113CCF' },
  { id: 350,  name: 'Apple TV+',  color: '#000000' },
  { id: 386,  name: 'Peacock',    color: '#F6B21B' },
  { id: 531,  name: 'Paramount+', color: '#0064FF' },
] as const;

export function MoviePicker({
  mode,
  value,
  onChange,
  min = 1,
  max = 8,
}: MoviePickerProps): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(PLATFORMS[0].id);
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [showReview, setShowReview] = useState(false);
  const [detailMovie, setDetailMovie] = useState<MovieOption | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());

  const nowPlaying = useNowPlaying();
  const streaming = useStreamingTitles(mode === 'streaming' ? selectedProvider : null, mediaType);
  const searchResults = useMovieSearch(debouncedQuery);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);
  const isAtMax = value.length >= max;

  const rawData = debouncedQuery.length >= 2
    ? searchResults
    : mode === 'cinema'
      ? nowPlaying
      : streaming;

  // Available genres from current results (for genre chips)
  const availableGenres = useMemo(() => {
    const all = new Set<string>();
    (rawData.data ?? []).forEach((m) => m.genres.forEach((g) => all.add(g)));
    return Array.from(all).sort();
  }, [rawData.data]);

  // Client-side filtering
  const filteredData = useMemo(() => {
    const movies = rawData.data ?? [];
    return movies.filter((m) => {
      if (minRating > 0 && (m.rating ?? 0) < minRating) return false;
      if (selectedGenres.size > 0 && !m.genres.some((g) => selectedGenres.has(g))) return false;
      return true;
    });
  }, [rawData.data, minRating, selectedGenres]);

  const activeFilterCount = (minRating > 0 ? 1 : 0) + (selectedGenres.size > 0 ? 1 : 0);

  const activeData = {
    isLoading: rawData.isLoading,
    isError: rawData.isError,
    data: filteredData,
  };

  const toggle = (movie: MovieOption): void => {
    if (selectedIds.has(movie.id)) {
      onChange(value.filter((v) => v.id !== movie.id));
      return;
    }
    if (isAtMax) return;
    onChange([...value, movie]);
  };

  const remove = (id: string): void => onChange(value.filter((v) => v.id !== id));

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
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.bodySmallMedium, { color: theme.colors.text.primary }]}>
                {value.length} selected{' '}
                <Text style={{ color: theme.colors.text.tertiary, fontWeight: '400' }}>of {max}</Text>
              </Text>
              <Text style={[theme.typography.caption, { color: value.length < min ? theme.colors.warning : theme.colors.text.tertiary, marginTop: 1 }]}>
                {value.length < min ? `Add ${min - value.length} more to continue` : 'Tap to review'}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
          <Search size={16} color={theme.colors.text.tertiary} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text.primary }]}
            placeholder="Search a title…"
            placeholderTextColor={theme.colors.text.tertiary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Filters toggle */}
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          style={styles.filtersToggle}
        >
          <SlidersHorizontal size={14} color={theme.colors.text.secondary} strokeWidth={2} />
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginLeft: 6 }]}>
            {showFilters ? 'Hide filters' : 'Filters'}
            {activeFilterCount > 0 ? ` · ${activeFilterCount} active` : ''}
          </Text>
        </Pressable>

        {showFilters && (
          <View style={[styles.filtersBox, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default }]}>
            {/* Rating */}
            <View style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Star size={13} color={theme.colors.text.secondary} fill={theme.colors.text.secondary} strokeWidth={0} />
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginLeft: 6, fontWeight: '600' }]}>
                  Min rating
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[{ v: 0, l: 'Any' }, { v: 6, l: '6+' }, { v: 7, l: '7+' }, { v: 8, l: '8+' }].map(({ v, l }) => (
                  <Pressable
                    key={v}
                    onPress={() => setMinRating(v)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        backgroundColor: minRating === v ? theme.colors.accent + '20' : theme.colors.bg.surface,
                        borderColor: minRating === v ? theme.colors.accent : theme.colors.border.default,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[theme.typography.caption, { color: minRating === v ? theme.colors.accent : theme.colors.text.primary, fontWeight: minRating === v ? '700' : '400' }]}>
                      {l}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Genres */}
            {availableGenres.length > 0 && (
              <View>
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, fontWeight: '600', marginBottom: 6 }]}>
                  Genre
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {availableGenres.map((g) => {
                    const active = selectedGenres.has(g);
                    return (
                      <Pressable
                        key={g}
                        onPress={() => {
                          setSelectedGenres((prev) => {
                            const next = new Set(prev);
                            if (next.has(g)) next.delete(g); else next.add(g);
                            return next;
                          });
                        }}
                        style={({ pressed }) => [
                          styles.filterChip,
                          {
                            backgroundColor: active ? theme.colors.accent + '20' : theme.colors.bg.surface,
                            borderColor: active ? theme.colors.accent : theme.colors.border.default,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[theme.typography.caption, { color: active ? theme.colors.accent : theme.colors.text.primary, fontWeight: active ? '700' : '400' }]}>
                          {g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Streaming controls */}
        {mode === 'streaming' && debouncedQuery.length < 2 && (
          <>
            {/* Platform chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: 4, marginBottom: 10 }}
            >
              {PLATFORMS.map((p) => {
                const active = selectedProvider === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedProvider(p.id)}
                    style={({ pressed }) => [
                      styles.platformChip,
                      {
                        backgroundColor: active ? p.color : theme.colors.bg.surface,
                        borderColor: active ? p.color : theme.colors.border.default,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text style={[theme.typography.caption, { color: active ? '#fff' : theme.colors.text.secondary, fontWeight: active ? '700' : '400' }]}>
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Movies / Shows toggle */}
            <View style={[styles.mediaToggle, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default }]}>
              <Pressable
                onPress={() => setMediaType('movie')}
                style={[styles.mediaBtn, mediaType === 'movie' && { backgroundColor: theme.colors.bg.surface, borderRadius: 8 }]}
              >
                <Clapperboard size={13} color={mediaType === 'movie' ? theme.colors.accent : theme.colors.text.secondary} strokeWidth={2} />
                <Text style={[theme.typography.caption, { color: mediaType === 'movie' ? theme.colors.accent : theme.colors.text.secondary, marginLeft: 5, fontWeight: mediaType === 'movie' ? '700' : '400' }]}>
                  Movies
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMediaType('tv')}
                style={[styles.mediaBtn, mediaType === 'tv' && { backgroundColor: theme.colors.bg.surface, borderRadius: 8 }]}
              >
                <Tv size={13} color={mediaType === 'tv' ? theme.colors.accent : theme.colors.text.secondary} strokeWidth={2} />
                <Text style={[theme.typography.caption, { color: mediaType === 'tv' ? theme.colors.accent : theme.colors.text.secondary, marginLeft: 5, fontWeight: mediaType === 'tv' ? '700' : '400' }]}>
                  Shows
                </Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Results */}
        <ResultsList
          isLoading={activeData.isLoading}
          isError={activeData.isError}
          data={activeData.data}
          selectedIds={selectedIds}
          isAtMax={isAtMax}
          onToggle={toggle}
          onLongPress={setDetailMovie}
          theme={theme}
        />
      </ScrollView>

      <SelectionReviewSheet
        visible={showReview}
        onClose={() => setShowReview(false)}
        items={value.map((v) => ({ id: v.id, label: v.title, subtitle: v.year ?? undefined }))}
        min={min}
        max={max}
        onRemove={remove}
        itemLabel="titles"
      />

      <MovieDetailSheet movie={detailMovie} onClose={() => setDetailMovie(null)} />
    </View>
  );
}

function ResultsList({
  isLoading,
  isError,
  data,
  selectedIds,
  isAtMax,
  onToggle,
  onLongPress,
  theme,
}: {
  isLoading: boolean;
  isError: boolean;
  data: MovieOption[] | undefined;
  selectedIds: Set<string>;
  isAtMax: boolean;
  onToggle: (m: MovieOption) => void;
  onLongPress: (m: MovieOption) => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
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
          Could not load titles. Check your connection.
        </Text>
      </View>
    );
  }
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={{ fontSize: 32 }}>🎬</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center', marginTop: 10 }]}>
          No titles found
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      {data.slice(0, 20).map((movie) => {
        const isSelected = selectedIds.has(movie.id);
        const disabled = !isSelected && isAtMax;
        return (
          <MovieRow
            key={movie.id}
            movie={movie}
            isSelected={isSelected}
            disabled={disabled}
            onToggle={() => onToggle(movie)}
            onLongPress={() => onLongPress(movie)}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

function MovieRow({
  movie,
  isSelected,
  disabled,
  onToggle,
  onLongPress,
  theme,
}: {
  movie: MovieOption;
  isSelected: boolean;
  disabled: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onLongPress}
      delayLongPress={350}
      disabled={disabled}
      style={({ pressed }) => [
        styles.movieRow,
        {
          backgroundColor: isSelected ? theme.colors.accent + '10' : theme.colors.bg.surface,
          borderColor: isSelected ? theme.colors.accent + '55' : theme.colors.border.default,
          borderWidth: isSelected ? 1.5 : 1,
          opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {/* Poster */}
      <View style={styles.posterWrap}>
        {movie.posterUrl ? (
          <Image
            source={{ uri: movie.posterUrl }}
            style={styles.poster}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.poster, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 22 }}>🎬</Text>
          </View>
        )}
        {movie.mediaType === 'tv' && (
          <View style={styles.tvBadge}>
            <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>TV</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontWeight: isSelected ? '700' : '600' }]}
          numberOfLines={2}
        >
          {movie.title}
          {movie.year ? (
            <Text style={{ color: theme.colors.text.tertiary, fontWeight: '400' }}>{' '}({movie.year})</Text>
          ) : null}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
          {movie.rating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Star size={11} color="#F59E0B" fill="#F59E0B" />
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                {movie.rating.toFixed(1)}
              </Text>
            </View>
          ) : null}
          {movie.genres.length > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]} numberOfLines={1}>
              {movie.genres.join(' · ')}
            </Text>
          )}
        </View>

        {movie.overview ? (
          <Text
            style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 4, lineHeight: 17 }]}
            numberOfLines={2}
          >
            {movie.overview}
          </Text>
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

function MovieDetailSheet({
  movie,
  onClose,
}: {
  movie: MovieOption | null;
  onClose: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Modal
      visible={movie !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
        {movie && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Poster */}
            <View style={detailStyles.posterBlock}>
              {movie.posterUrl ? (
                <Image
                  source={{ uri: movie.posterUrl.replace('w185', 'w500') }}
                  style={detailStyles.posterLarge}
                  contentFit="cover"
                />
              ) : (
                <View style={[detailStyles.posterLarge, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
                  <Film size={48} color={theme.colors.text.tertiary} strokeWidth={1.5} />
                </View>
              )}
              {movie.mediaType === 'tv' && (
                <View style={[detailStyles.typeBadge, { backgroundColor: '#6366F1' }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>TV SHOW</Text>
                </View>
              )}
            </View>

            {/* Info */}
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>
                {movie.title}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                {movie.year ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Calendar size={14} color={theme.colors.text.tertiary} strokeWidth={2} />
                    <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary }]}>{movie.year}</Text>
                  </View>
                ) : null}
                {movie.rating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Star size={14} color="#F59E0B" fill="#F59E0B" />
                    <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, fontWeight: '600' }]}>
                      {movie.rating.toFixed(1)} / 10
                    </Text>
                  </View>
                ) : null}
              </View>

              {movie.genres.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {movie.genres.map((g) => (
                    <View key={g} style={[detailStyles.genreChip, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>{g}</Text>
                    </View>
                  ))}
                </View>
              )}

              {movie.overview ? (
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 16, lineHeight: 24 }]}>
                  {movie.overview}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        )}

        {/* Close button */}
        <Pressable
          onPress={onClose}
          style={[detailStyles.closeBtn, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
          hitSlop={8}
        >
          <X size={20} color={theme.colors.text.primary} strokeWidth={2} />
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  posterBlock: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  posterLarge: {
    width: 180,
    height: 270,
    borderRadius: 14,
  },
  typeBadge: {
    position: 'absolute',
    bottom: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  genreChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
  countBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 6,
  },
  filtersBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  platformChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  mediaToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  mediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movieRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  posterWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  poster: {
    width: 52,
    height: 76,
    borderRadius: 8,
  },
  tvBadge: {
    position: 'absolute',
    bottom: 4,
    right: 0,
    backgroundColor: '#6366F1',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  selectCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  addCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    flexShrink: 0,
    marginTop: 2,
  },
});
