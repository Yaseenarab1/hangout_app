import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Star } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { searchRestaurants, searchPlaces, getPlacePhotoUrl } from '@/features/places';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { addDayPlanItem } from '@/features/dayplan/services/dayplan.service';
import { dayPlanKeys } from '@/features/dayplan/hooks/useDayPlans';
import type { Place } from '@/features/places';
import type { AddDayPlanItemInput } from '@/features/dayplan/types';

type Tab = 'eats' | 'activities' | 'custom';

const TABS: Array<{ key: Tab; label: string; emoji: string }> = [
  { key: 'eats',       label: 'Eats',       emoji: '🍽️' },
  { key: 'activities', label: 'Activities',  emoji: '🎯' },
  { key: 'custom',     label: 'Custom',      emoji: '✏️' },
];

const ACTIVITY_CHIPS = [
  { label: 'Museum', emoji: '🏛️' },
  { label: 'Park',   emoji: '🌿' },
  { label: 'Theater',emoji: '🎭' },
  { label: 'Bowling',emoji: '🎳' },
  { label: 'Movies', emoji: '🎬' },
  { label: 'Bar',    emoji: '🍸' },
  { label: 'Golf',   emoji: '⛳' },
  { label: 'Art',    emoji: '🎨' },
];

const PRICE_CHIPS = [
  { label: '$',    value: 1 },
  { label: '$$',   value: 2 },
  { label: '$$$',  value: 3 },
  { label: '$$$$', value: 4 },
];

function priceLevelToSymbol(level: number | null): string {
  if (!level) return '';
  return '$'.repeat(Math.min(level, 4));
}

export default function DayPlanAddScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { planId } = useLocalSearchParams<{ planId: string }>();

  const [tab, setTab] = useState<Tab>('eats');
  const [query, setQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const searchRef = useRef<TextInput>(null);

  const debouncedQuery = useDebounce(query, 400);

  const searchQuery = useQuery({
    queryKey: ['place-search', tab, debouncedQuery, priceFilter],
    queryFn: () =>
      tab === 'eats'
        ? searchRestaurants({ query: debouncedQuery, maxPriceLevel: priceFilter ?? undefined })
        : searchPlaces({ query: debouncedQuery }),
    enabled: debouncedQuery.length >= 2 && tab !== 'custom',
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: (input: AddDayPlanItemInput) => addDayPlanItem(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dayPlanKeys.detail(planId ?? '') });
      router.back();
    },
    onError: (error) => {
      logError(error, { where: 'DayPlanAddScreen.addDayPlanItem' });
      toast.error('Could not add stop. Try again.');
      setAddingId(null);
    },
  });

  function handleAddPlace(place: Place): void {
    if (!planId) return;
    setAddingId(place.placeId);
    addMutation.mutate({
      planId,
      itemType: tab === 'eats' ? 'restaurant' : 'activity',
      title: place.name,
      subtitle: place.address,
      placeId: place.placeId,
      placeData: {
        name: place.name,
        address: place.address,
        rating: place.rating,
        priceLevel: place.priceLevel,
        photoReference: place.photos?.[0] ?? null,
        mapsUrl: place.mapsUrl,
      },
    });
  }

  function handleAddCustom(): void {
    if (!planId || !customTitle.trim()) return;
    addMutation.mutate({
      planId,
      itemType: 'custom',
      title: customTitle.trim(),
      notes: customNotes.trim() || null,
    });
  }

  function switchTab(t: Tab) {
    setTab(t);
    setQuery('');
    setPriceFilter(null);
    setTimeout(() => searchRef.current?.focus(), 100);
  }

  const results = searchQuery.data ?? [];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: theme.colors.border.default,
            backgroundColor: theme.colors.bg.canvas,
          },
        ]}
      >
        <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
          Add a stop
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          accessibilityLabel="Close"
        >
          <X size={22} color={theme.colors.text.primary} />
        </Pressable>
      </View>

      {/* Category tabs */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.border.default }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => switchTab(t.key)}
              style={[
                styles.tab,
                active && { borderBottomColor: '#8B5CF6', borderBottomWidth: 2.5 },
              ]}
            >
              <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
              <Text
                style={[
                  theme.typography.bodyMedium,
                  {
                    color: active ? '#8B5CF6' : theme.colors.text.secondary,
                    marginLeft: 6,
                    fontWeight: active ? '700' : '500',
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Custom stop form */}
      {tab === 'custom' ? (
        <View style={styles.customForm}>
          <Text style={[theme.typography.bodySmallMedium, { color: theme.colors.text.secondary, marginBottom: 8 }]}>
            Name
          </Text>
          <TextInput
            ref={searchRef}
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.bg.subtle,
                borderColor: theme.colors.border.default,
                color: theme.colors.text.primary,
              },
            ]}
            placeholder="e.g. Coffee break, Walk along the river…"
            placeholderTextColor={theme.colors.text.tertiary}
            value={customTitle}
            onChangeText={setCustomTitle}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="next"
          />
          <Text style={[theme.typography.bodySmallMedium, { color: theme.colors.text.secondary, marginTop: 16, marginBottom: 8 }]}>
            Notes (optional)
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              styles.notesInput,
              {
                backgroundColor: theme.colors.bg.subtle,
                borderColor: theme.colors.border.default,
                color: theme.colors.text.primary,
              },
            ]}
            placeholder="Any details to share with the group…"
            placeholderTextColor={theme.colors.text.tertiary}
            value={customNotes}
            onChangeText={setCustomNotes}
            multiline
            numberOfLines={3}
            autoCapitalize="sentences"
          />
          <Pressable
            onPress={handleAddCustom}
            disabled={!customTitle.trim() || addMutation.isPending}
            style={({ pressed }) => [
              styles.addCustomBtn,
              {
                backgroundColor:
                  !customTitle.trim() || addMutation.isPending
                    ? theme.colors.bg.subtle
                    : '#8B5CF6',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {addMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  theme.typography.bodyMedium,
                  {
                    color: !customTitle.trim() ? theme.colors.text.tertiary : '#FFFFFF',
                    fontWeight: '700',
                  },
                ]}
              >
                Add to plan
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <>
          {/* Search bar */}
          <View style={[styles.searchBar, { borderBottomColor: theme.colors.border.default }]}>
            <TextInput
              ref={searchRef}
              style={[
                styles.searchInput,
                {
                  backgroundColor: theme.colors.bg.subtle,
                  borderColor: theme.colors.border.default,
                  color: theme.colors.text.primary,
                },
              ]}
              placeholder={tab === 'eats' ? 'Search restaurants…' : 'Search activities…'}
              placeholderTextColor={theme.colors.text.tertiary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>

          {/* Eats: price chips */}
          {tab === 'eats' ? (
            <View style={[styles.chips, { borderBottomColor: theme.colors.border.default }]}>
              {PRICE_CHIPS.map((chip) => {
                const active = priceFilter === chip.value;
                return (
                  <Pressable
                    key={chip.value}
                    onPress={() => setPriceFilter(active ? null : chip.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? '#8B5CF6' : theme.colors.bg.subtle,
                        borderColor: active ? '#8B5CF6' : theme.colors.border.default,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: active ? '#FFFFFF' : theme.colors.text.secondary, fontWeight: '700' },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Activities: category chips */}
          {tab === 'activities' ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={ACTIVITY_CHIPS}
              keyExtractor={(c) => c.label}
              contentContainerStyle={styles.activityChips}
              style={{ maxHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default }}
              renderItem={({ item: chip }) => {
                const active = query === chip.label;
                return (
                  <Pressable
                    onPress={() => setQuery(active ? '' : chip.label)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? '#8B5CF6' : theme.colors.bg.subtle,
                        borderColor: active ? '#8B5CF6' : theme.colors.border.default,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 14 }}>{chip.emoji}</Text>
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: active ? '#FFFFFF' : theme.colors.text.secondary, marginLeft: 4, fontWeight: '600' },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          ) : null}

          {/* Results */}
          {!debouncedQuery || debouncedQuery.length < 2 ? (
            <View style={styles.emptyState}>
              <Text style={[theme.typography.body, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
                {tab === 'eats' ? 'Search for a restaurant' : 'Pick a category or type to search'}
              </Text>
            </View>
          ) : searchQuery.isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : searchQuery.isError ? (
            <View style={styles.emptyState}>
              <Text style={[theme.typography.body, { color: theme.colors.danger, textAlign: 'center' }]}>
                Search failed. Check your connection.
              </Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[theme.typography.body, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
                No results for "{debouncedQuery}"
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.placeId}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => {
                const isAdding = addingId === item.placeId;
                const photoRef = item.photos?.[0] ?? null;
                return (
                  <Pressable
                    onPress={() => handleAddPlace(item)}
                    disabled={addMutation.isPending}
                    style={({ pressed }) => [
                      styles.resultRow,
                      {
                        backgroundColor: theme.colors.bg.surface,
                        borderColor: theme.colors.border.default,
                        opacity: pressed || isAdding ? 0.7 : 1,
                      },
                    ]}
                  >
                    {photoRef ? (
                      <Image
                        source={{ uri: getPlacePhotoUrl(photoRef, 128) }}
                        style={styles.resultPhoto}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.resultPhoto, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 28 }}>{tab === 'eats' ? '🍽️' : '🎯'}</Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 2 }]}
                        numberOfLines={1}
                      >
                        {item.address}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        {item.rating ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Star size={11} color="#F59E0B" fill="#F59E0B" />
                            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                              {item.rating.toFixed(1)}
                            </Text>
                          </View>
                        ) : null}
                        {item.priceLevel ? (
                          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                            {priceLevelToSymbol(item.priceLevel)}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {isAdding ? (
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : (
                      <View style={[styles.addBtn, { backgroundColor: '#8B5CF6' + '18' }]}>
                        <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: 13 }}>Add</Text>
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityChips: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
    width: 60,
    height: 60,
    borderRadius: 10,
    flexShrink: 0,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    flexShrink: 0,
  },
  customForm: {
    padding: 16,
  },
  addCustomBtn: {
    marginTop: 24,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
