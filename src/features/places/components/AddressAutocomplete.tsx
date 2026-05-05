import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MapPin, X } from 'lucide-react-native';
import { Input } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useAddressAutocomplete } from '../hooks/usePlaces';
import { getPlaceDetails } from '../services/places.service';
import type { AutocompletePrediction, PlaceDetails } from '../types';

export type AddressAutocompleteProps = {
  /** Current human-readable value of the input. */
  value: string;
  /** Called as the user types — the parent should mirror this in state. */
  onChangeText: (text: string) => void;
  /** Called when the user picks a suggestion. Includes coordinates. */
  onSelectPlace?: (place: PlaceDetails) => void;
  label?: string;
  placeholder?: string;
  error?: string;
};

/**
 * Address autocomplete input. As the user types, hits Google Places
 * autocomplete via Edge Function, shows suggestions in a dropdown.
 *
 * Uses a per-mount session token so Google bills typing+select as a single
 * billable session.
 */
export function AddressAutocomplete({
  value,
  onChangeText,
  onSelectPlace,
  label = 'Address',
  placeholder = 'Start typing an address',
  error,
}: AddressAutocompleteProps): React.ReactElement {
  const theme = useTheme();
  const debouncedValue = useDebounce(value, 250);
  const [showDropdown, setShowDropdown] = useState(false);
  const [resolving, setResolving] = useState(false);
  const sessionTokenRef = useRef<string>(generateSessionToken());

  const autocomplete = useAddressAutocomplete(
    debouncedValue,
    sessionTokenRef.current,
  );

  // Hide dropdown when value is empty
  useEffect(() => {
    if (!value.trim()) setShowDropdown(false);
  }, [value]);

  const handleSelect = async (prediction: AutocompletePrediction): Promise<void> => {
    setShowDropdown(false);
    setResolving(true);
    try {
      const details = await getPlaceDetails(
        prediction.placeId,
        sessionTokenRef.current,
      );
      // After selection, generate new session token for next session
      sessionTokenRef.current = generateSessionToken();
      if (details) {
        onChangeText(details.address || prediction.fullText);
        onSelectPlace?.(details);
      } else {
        onChangeText(prediction.fullText);
      }
    } catch {
      onChangeText(prediction.fullText);
    } finally {
      setResolving(false);
    }
  };

  return (
    <View>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={(t) => {
          onChangeText(t);
          if (t.length >= 2) setShowDropdown(true);
        }}
        onFocus={() => {
          if (value.length >= 2) setShowDropdown(true);
        }}
        error={error}
        autoCorrect={false}
        autoCapitalize="words"
        trailing={
          resolving ? (
            <ActivityIndicator size="small" color={theme.colors.text.tertiary} />
          ) : value ? (
            <Pressable onPress={() => onChangeText('')} hitSlop={8}>
              <X size={16} color={theme.colors.text.tertiary} />
            </Pressable>
          ) : (
            <MapPin size={18} color={theme.colors.text.tertiary} />
          )
        }
      />

      {showDropdown && autocomplete.data && autocomplete.data.length > 0 ? (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          {autocomplete.data.map((p, idx) => (
            <Pressable
              key={p.placeId}
              onPress={() => handleSelect(p)}
              style={({ pressed }) => [
                styles.row,
                idx > 0 && {
                  borderTopColor: theme.colors.border.default,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
                pressed && { backgroundColor: theme.colors.bg.subtle },
              ]}
            >
              <MapPin size={14} color={theme.colors.text.tertiary} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.text.primary },
                  ]}
                  numberOfLines={1}
                >
                  {p.primaryText}
                </Text>
                {p.secondaryText ? (
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.text.tertiary, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {p.secondaryText}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function generateSessionToken(): string {
  // Simple UUID-like — doesn't need to be cryptographically perfect for this purpose
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

const styles = StyleSheet.create({
  dropdown: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
