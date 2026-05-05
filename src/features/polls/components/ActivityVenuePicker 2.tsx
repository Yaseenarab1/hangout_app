import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Search as SearchIcon,
  X,
  Star,
  Plus,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Input, Button } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { searchPlaces } from '@/features/places';
import { useQuery } from '@tanstack/react-query';
import type { Place } from '@/features/places';

export type ActivityVenueOption = {
  id: string;
  name: string;
  address?: string | null;
  placeId?: string;
  rating?: number | null;
  primaryType?: string | null;
  mapsUrl?: string | null;
  isCustom?: boolean;
};

export type ActivityVenuePickerProps = {
  value: ActivityVenueOption[];
  onChange: (options: ActivityVenueOption[]) => void;
  /** Activity-specific search query (e.g. "bar", "bowling alley"). */
  activityQuery: string;
  /** Display name (used in headers/titles). */
  activityLabel: string;
  min?: number;
  max?: number;
};

/**
 * Search Google Places for venues matching a specific activity.
 *
 * Used in the "find what to do AND where" flow — once the activity is
 * decided (or once an activity poll closes), this picker lets the host
 * pick specific venues from Google for the group to vote on.
 */
export function ActivityVenuePicker({
  value,
  onChange,
  activityQuery,
  activityLabel,
  min = 2,
  max = 8,
}: ActivityVenuePickerProps): React.ReactElement {
  const theme = useTheme();
  const [extraQuery, setExtraQuery] = useState('');
  const debouncedQuery = useDebounce(extraQuery, 300);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');

  // Combine the activity query with any extra text (e.g. "bar" + "rooftop")
  const fullQuery = [activityQuery, debouncedQuery].filter(Boolean).join(' ');

  const search = useQuery({
    queryKey: ['places', 'activity-search', fullQuery],
    queryFn: () => searchPlaces({ query: fullQuery }),
    enabled: fullQuery.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const selectedPlaceIds = useMemo(
    () => new Set(value.map((v) => v.placeId).filter(Boolean) as string[]),
    [value],
  );

  const isAtMax = value.length >= max;

  const addPlace = (place: Place): void => {
    if (isAtMax || (place.placeId && selectedPlaceIds.has(place.placeId))) return;
    onChange([
      ...value,
      {
        id: `place:${place.placeId}`,
        name: place.name,
        address: place.address,
        placeId: place.placeId,
        rating: place.rating,
        primaryType: place.primaryType,
        mapsUrl: place.mapsUrl,
        isCustom: false,
      },
    ]);
  };

  const remove = (optId: string): void => {
    onChange(value.filter((o) => o.id !== optId));
  };

  const addCustom = (): void => {
    const name = customName.trim();
    if (!name || isAtMax) return;
    onChange([
      ...value,
      {
        id: `custom:${Date.now()}`,
        name,
        address: customAddress.trim() || null,
        isCustom: true,
      },
    ]);
    setCustomName('');
    setCustomAddress('');
    setShowCustomInput(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Activity context header */}
      <View
        style={[
          styles.contextHeader,
          {
            backgroundColor: theme.colors.accent + '10',
            borderColor: theme.colors.accent + '40',
          },
        ]}
      >
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary },
          ]}
        >
          Looking for places to{' '}
          <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>
            {activityLabel.toLowerCase()}
          </Text>
        </Text>
      </View>

      {/* Selected — horizontal scroll */}
      {value.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.tertiary, marginBottom: 8 },
            ]}
          >
            Selected ({value.length}/{max})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingRight: 16 }}
          >
            {value.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => remove(opt.id)}
                style={({ pressed }) => [
                  styles.selectedChip,
                  {
                    backgroundColor: theme.colors.accent + '20',
                    borderColor: theme.colors.accent,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    theme.typography.bodySmall,
                    { color: theme.colors.text.primary },
                  ]}
                  numberOfLines={1}
                >
                  {opt.name}
                </Text>
                <X size={14} color={theme.colors.text.secondary} style={{ marginLeft: 6 }} />
              </Pressable>
            ))}
          </ScrollView>
          {value.length < min ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.warning, marginTop: 8 },
              ]}
            >
              Add at least {min - value.length} more
            </Text>
          ) : null}
        </View>
      ) : null}

      <Input
        placeholder={`Refine search (e.g. "rooftop")`}
        value={extraQuery}
        onChangeText={setExtraQuery}
        autoCapitalize="none"
        autoCorrect={false}
        trailing={<SearchIcon size={18} color={theme.colors.text.tertiary} />}
        containerStyle={{ marginBottom: 12 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {search.isLoading ? (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.text.tertiary} />
          </View>
        ) : search.data && search.data.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text
              style={[
                theme.typography.bodySmallMedium,
                { color: theme.colors.text.secondary, marginBottom: 8 },
              ]}
            >
              Nearby
            </Text>
            {search.data.slice(0, 15).map((p) => (
              <PlaceRow key={p.placeId} place={p} onAdd={() => addPlace(p)} />
            ))}
          </View>
        ) : (
          <Text
            style={[
              theme.typography.bodySmall,
              {
                color: theme.colors.text.tertiary,
                textAlign: 'center',
                paddingVertical: 16,
              },
            ]}
          >
            {search.isError ? 'Search failed.' : 'Loading…'}
          </Text>
        )}

        {/* Custom add */}
        <View style={{ marginBottom: 24 }}>
          {showCustomInput ? (
            <View style={{ gap: 8 }}>
              <Input
                placeholder="Place name"
                value={customName}
                onChangeText={setCustomName}
                autoFocus
                maxLength={200}
              />
              <Input
                placeholder="Address (optional)"
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
                  onPress={() => {
                    setShowCustomInput(false);
                    setCustomName('');
                    setCustomAddress('');
                  }}
                  size="sm"
                />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowCustomInput(true)}
              disabled={isAtMax}
              style={({ pressed }) => [
                styles.addCustomButton,
                {
                  borderColor: theme.colors.border.default,
                  opacity: isAtMax ? 0.4 : 1,
                },
                pressed && { backgroundColor: theme.colors.bg.subtle },
              ]}
            >
              <Plus size={16} color={theme.colors.text.secondary} />
              <Text
                style={[
                  theme.typography.bodySmall,
                  { color: theme.colors.text.secondary, marginLeft: 6 },
                ]}
              >
                Add a place not on Google
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function PlaceRow({
  place,
  onAdd,
}: {
  place: Place;
  onAdd: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onAdd}
      style={({ pressed }) => [
        styles.resultRow,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && { backgroundColor: theme.colors.bg.subtle },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[theme.typography.body, { color: theme.colors.text.primary }]}
          numberOfLines={1}
        >
          {place.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          {place.rating !== null && place.rating !== undefined ? (
            <>
              <Star size={12} color={theme.colors.warning} fill={theme.colors.warning} />
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.text.secondary, marginLeft: 4, marginRight: 8 },
                ]}
              >
                {place.rating.toFixed(1)}
              </Text>
            </>
          ) : null}
          {place.primaryType ? (
            <Text
              style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}
              numberOfLines={1}
            >
              {place.primaryType}
            </Text>
          ) : null}
        </View>
        {place.address ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.tertiary, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {place.address}
          </Text>
        ) : null}
      </View>
      <Plus size={18} color={theme.colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contextHeader: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 200,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  addCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
