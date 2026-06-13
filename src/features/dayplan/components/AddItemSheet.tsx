import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Star } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { searchRestaurants, searchPlaces, getPlacePhotoUrl } from '@/features/places';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { addDayPlanItem } from '../services/dayplan.service';
import { dayPlanKeys } from '../hooks/useDayPlans';
import type { Place } from '@/features/places';
import type { AddDayPlanItemInput } from '../types';

interface Props {
  planId: string;
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

type Tab = 'eats' | 'activities' | 'custom';

const ACTIVITY_CHIPS: { label: string; emoji: string }[] = [
  { label: 'Museum', emoji: '🏛️' },
  { label: 'Park', emoji: '🌿' },
  { label: 'Theater', emoji: '🎭' },
  { label: 'Bowling', emoji: '🎳' },
  { label: 'Movies', emoji: '🎬' },
  { label: 'Bar', emoji: '🍸' },
  { label: 'Golf', emoji: '⛳' },
  { label: 'Art', emoji: '🎨' },
];

const PRICE_CHIPS: { label: string; value: number }[] = [
  { label: '$', value: 1 },
  { label: '$$', value: 2 },
  { label: '$$$', value: 3 },
  { label: '$$$$', value: 4 },
];

function priceLevelToSymbol(level: number | null): string {
  if (!level) return '';
  return '$'.repeat(Math.min(level, 4));
}

export function AddItemSheet({ planId, visible, onClose, onAdded }: Props): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('eats');
  const [query, setQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 400);

  const searchQuery = useQuery({
    queryKey: ['place-search', tab, debouncedQuery, priceFilter],
    queryFn: () =>
      tab === 'eats'
        ? searchRestaurants({
            query: debouncedQuery,
            maxPriceLevel: priceFilter ?? undefined,
          })
        : searchPlaces({ query: debouncedQuery }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: (input: AddDayPlanItemInput) => addDayPlanItem(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dayPlanKeys.detail(planId) });
      onAdded();
      onClose();
    },
    onError: (error) => {
      logError(error, { where: 'AddItemSheet.addDayPlanItem' });
      toast.error('Could not add stop. Try again.');
    },
    onSettled: () => setAddingId(null),
  });

  function handleAddPlace(place: Place): void {
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
    if (!customTitle.trim()) return;
    addMutation.mutate({
      planId,
      itemType: 'custom',
      title: customTitle.trim(),
      notes: customNotes.trim() || null,
    });
  }

  function resetAndClose(): void {
    setQuery('');
    setPriceFilter(null);
    setCustomTitle('');
    setCustomNotes('');
    setTab('eats');
    onClose();
  }

  // Search result rendering
  function renderSearchState(): React.ReactElement {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      return (
        <View style={styles.emptySearch}>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.text.tertiary, textAlign: 'center' },
            ]}
          >
            {tab === 'eats' ? 'Search for a restaurant' : 'Search or pick a category above'}
          </Text>
        </View>
      );
    }
    if (searchQuery.isLoading) {
      return (
        <View style={styles.emptySearch}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      );
    }
    if (searchQuery.isError) {
      return (
        <View style={styles.emptySearch}>
          <Text
            style={[theme.typography.body, { color: theme.colors.danger, textAlign: 'center' }]}
          >
            Search failed. Check your connection and try again.
          </Text>
        </View>
      );
    }
    const results = searchQuery.data ?? [];
    if (results.length === 0) {
      return (
        <View style={styles.emptySearch}>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.text.tertiary, textAlign: 'center' },
            ]}
          >
            No results found for "{debouncedQuery}"
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => item.placeId}
        scrollEnabled={false}
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
                <View
                  style={[
                    styles.resultPhoto,
                    {
                      backgroundColor: theme.colors.bg.subtle,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <Text style={{ fontSize: 28 }}>{tab === 'eats' ? '🍽️' : '🎯'}</Text>
                </View>
              )}
              <View style={styles.resultText}>
                <Text
                  style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.text.secondary, marginTop: 2 },
                  ]}
                  numberOfLines={1}
                >
                  {item.address}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {item.rating ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Star size={11} color="#F59E0B" fill="#F59E0B" />
                      <Text
                        style={[theme.typography.caption, { color: theme.colors.text.secondary }]}
                      >
                        {item.rating.toFixed(1)}
                      </Text>
                    </View>
                  ) : null}
                  {item.priceLevel ? (
                    <Text
                      style={[theme.typography.caption, { color: theme.colors.text.secondary }]}
                    >
                      {priceLevelToSymbol(item.priceLevel)}
                    </Text>
                  ) : null}
                </View>
              </View>
              {isAdding ? <ActivityIndicator size="small" color={theme.colors.accent} /> : null}
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        style={{ marginTop: 12 }}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        style={[styles.sheet, { backgroundColor: theme.colors.bg.canvas }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: theme.colors.border.default,
              paddingTop: insets.top > 0 ? insets.top + 8 : 20,
            },
          ]}
        >
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
            Add a stop
          </Text>
          <Pressable
            onPress={resetAndClose}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            accessibilityLabel="Close"
          >
            <X size={22} color={theme.colors.text.primary} />
          </Pressable>
        </View>

        {/* Tab bar */}
        <View style={[styles.tabBar, { borderBottomColor: theme.colors.border.default }]}>
          {(['eats', 'activities', 'custom'] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              eats: '🍽️ Eats',
              activities: '🎯 Activities',
              custom: '✏️ Custom',
            };
            const active = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setTab(t);
                  setQuery('');
                  setPriceFilter(null);
                }}
                style={[
                  styles.tab,
                  active && { borderBottomColor: '#8B5CF6', borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    {
                      color: active ? '#8B5CF6' : theme.colors.text.secondary,
                    },
                  ]}
                >
                  {labels[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        >
          {/* Eats tab */}
          {tab === 'eats' && (
            <>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.colors.bg.subtle,
                    borderColor: theme.colors.border.default,
                    color: theme.colors.text.primary,
                  },
                ]}
                placeholder="Search restaurants…"
                placeholderTextColor={theme.colors.text.tertiary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {/* Price filter chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 10 }}
                contentContainerStyle={{ gap: 8 }}
              >
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
                          {
                            color: active ? '#FFFFFF' : theme.colors.text.secondary,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {renderSearchState()}
            </>
          )}

          {/* Activities tab */}
          {tab === 'activities' && (
            <>
              {/* Category chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 12 }}
              >
                {ACTIVITY_CHIPS.map((chip) => {
                  const active = query === chip.label;
                  return (
                    <Pressable
                      key={chip.label}
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
                          {
                            color: active ? '#FFFFFF' : theme.colors.text.secondary,
                            marginLeft: 4,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: theme.colors.bg.subtle,
                    borderColor: theme.colors.border.default,
                    color: theme.colors.text.primary,
                  },
                ]}
                placeholder="Search activities…"
                placeholderTextColor={theme.colors.text.tertiary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {renderSearchState()}
            </>
          )}

          {/* Custom tab */}
          {tab === 'custom' && (
            <>
              <Text
                style={[
                  theme.typography.bodySmallMedium,
                  { color: theme.colors.text.primary, marginBottom: 6 },
                ]}
              >
                Name
              </Text>
              <TextInput
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
                autoCapitalize="sentences"
                returnKeyType="next"
              />
              <Text
                style={[
                  theme.typography.bodySmallMedium,
                  { color: theme.colors.text.primary, marginTop: 16, marginBottom: 6 },
                ]}
              >
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
                  styles.addBtn,
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
                        fontWeight: '600',
                      },
                    ]}
                  >
                    Add to plan
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultPhoto: {
    width: 64,
    height: 64,
    borderRadius: 10,
    flexShrink: 0,
  },
  resultText: {
    flex: 1,
  },
  emptySearch: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  addBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
