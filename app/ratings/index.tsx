import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Search, Plus, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useMyRatings, RateRestaurantSheet, RestaurantRatingCard } from '@/features/ratings';
import type { RestaurantRating } from '@/features/ratings';

export default function RatingsPage(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const myRatings = useMyRatings();
  const [query, setQuery] = useState('');
  const [showSheet, setShowSheet] = useState(false);

  const filtered = useMemo(() => {
    const all = myRatings.data ?? [];
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter(
      (r) =>
        r.place_name.toLowerCase().includes(q) ||
        (r.place_address ?? '').toLowerCase().includes(q),
    );
  }, [myRatings.data, query]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {/* Nav bar */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: insets.top + 4,
            borderBottomColor: theme.colors.border.default,
            backgroundColor: theme.colors.bg.canvas,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 6 }}>
          <ChevronLeft size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, flex: 1, marginLeft: 8 }]}>
          My Ratings
        </Text>
        {myRatings.data && myRatings.data.length > 0 && (
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
            {myRatings.data.length} places
          </Text>
        )}
      </View>

      {/* Search bar */}
      <View style={[styles.searchWrap, { paddingHorizontal: 16, paddingVertical: 10 }]}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <Search size={16} color={theme.colors.text.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text.primary }]}
            placeholder="Search your ratings…"
            placeholderTextColor={theme.colors.text.tertiary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={15} color={theme.colors.text.tertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* List */}
      {myRatings.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#8B5CF6" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🍽️</Text>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center' }]}>
            {query ? 'No matches for that search' : 'No ratings yet.\nTap + to rate your first place!'}
          </Text>
        </View>
      ) : (
        <FlatList<RestaurantRating>
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
              <RestaurantRatingCard rating={item} fullWidth />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 80 }}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => setShowSheet(true)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 20, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityLabel="Rate a place"
      >
        <Plus size={24} color="#FFFFFF" strokeWidth={2} />
      </Pressable>

      <RateRestaurantSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        onSaved={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchWrap: {},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
