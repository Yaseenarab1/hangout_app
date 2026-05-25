import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { X, MapPin, Navigation } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { AddressAutocomplete } from './AddressAutocomplete';
import {
  useSearchLocation,
  useSaveSearchLocation,
  useClearSearchLocation,
} from '../hooks/useSearchLocation';
import type { PlaceDetails } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LocationPickerSheet({ visible, onClose }: Props): React.ReactElement {
  const theme = useTheme();
  const [text, setText] = useState('');
  const location = useSearchLocation();
  const save = useSaveSearchLocation();
  const clear = useClearSearchLocation();

  function handleSelectPlace(place: PlaceDetails): void {
    if (!place.location) return;
    save.mutate(
      { name: place.name, lat: place.location.lat, lng: place.location.lng },
      { onSuccess: () => { setText(''); onClose(); } },
    );
  }

  function handleClear(): void {
    clear.mutate(undefined, { onSuccess: onClose });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
            Set location
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.text.tertiary} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginBottom: 12 }]}>
            Search for a neighborhood, city, or address. Recommendations will be centered here.
          </Text>

          <AddressAutocomplete
            value={text}
            onChangeText={setText}
            onSelectPlace={handleSelectPlace}
            label="Location"
            placeholder="e.g. Brooklyn, NYC"
          />

          {/* Current location pill */}
          {location.data && (
            <View style={[styles.currentRow, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
              <Navigation size={14} color={theme.colors.accent} />
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary, flex: 1 }]} numberOfLines={1}>
                {location.data.name}
              </Text>
              <Pressable onPress={handleClear} hitSlop={8}>
                <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
                  Clear
                </Text>
              </Pressable>
            </View>
          )}

          {!location.data && (
            <View style={[styles.hintRow, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
              <MapPin size={14} color={theme.colors.text.tertiary} />
              <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
                No location set — defaulting to NYC
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    padding: 20,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
});
