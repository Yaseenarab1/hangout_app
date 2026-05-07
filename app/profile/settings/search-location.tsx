import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin, X } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, Card } from '@/components/ui';
import { AddressAutocomplete } from '@/features/places';
import {
  useSearchLocation,
  useSaveSearchLocation,
  useClearSearchLocation,
} from '@/features/places/hooks/useSearchLocation';
import { useTheme } from '@/hooks/useTheme';
import type { PlaceDetails } from '@/features/places';

export default function SearchLocationScreen(): React.ReactElement {
  const theme = useTheme();
  const [input, setInput] = useState('');

  const searchLoc = useSearchLocation();
  const save = useSaveSearchLocation();
  const clear = useClearSearchLocation();

  const handleSelect = (place: PlaceDetails): void => {
    if (!place.location) return;
    save.mutate({
      name: place.address || input,
      lat: place.location.lat,
      lng: place.location.lng,
    });
    setInput('');
  };

  const handleClear = (): void => {
    clear.mutate();
  };

  return (
    <Screen header={{ title: 'Search location', showBack: true }} scroll>
      <Text
        style={[
          theme.typography.bodySmall,
          { color: theme.colors.text.secondary, marginBottom: 20 },
        ]}
      >
        Restaurant and venue searches use this location as the center point.
        Defaults to New York City if not set.
      </Text>

      {/* Current location */}
      <Text
        style={[
          theme.typography.caption,
          {
            color: theme.colors.text.tertiary,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
          },
        ]}
      >
        Current location
      </Text>
      <Card padding="md" style={{ marginBottom: 24 }}>
        {searchLoc.data ? (
          <View style={styles.currentRow}>
            <MapPin size={16} color={theme.colors.accent} />
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.text.primary, flex: 1, marginLeft: 10 },
              ]}
              numberOfLines={2}
            >
              {searchLoc.data.name}
            </Text>
            <Button
              label="Reset to NYC"
              variant="ghost"
              size="sm"
              onPress={handleClear}
              loading={clear.isPending}
            />
          </View>
        ) : (
          <View style={styles.currentRow}>
            <MapPin size={16} color={theme.colors.text.tertiary} />
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.text.tertiary, marginLeft: 10 },
              ]}
            >
              New York City (default)
            </Text>
          </View>
        )}
      </Card>

      {/* Picker */}
      <Text
        style={[
          theme.typography.caption,
          {
            color: theme.colors.text.tertiary,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
          },
        ]}
      >
        Change location
      </Text>
      <AddressAutocomplete
        value={input}
        onChangeText={setInput}
        onSelectPlace={handleSelect}
        label=""
        placeholder="City, neighborhood, or address"
      />

      {save.isSuccess ? (
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.success, marginTop: 12 },
          ]}
        >
          Location saved.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
