import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { SPORTS, type Sport } from '../catalog/sports';

export type SportPickerProps = {
  onSelect: (sport: Sport) => void;
};

export function SportPicker({ onSelect }: SportPickerProps): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {SPORTS.map((sport) => (
        <Pressable
          key={sport.id}
          onPress={() => onSelect(sport)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={styles.emoji}>{sport.emoji}</Text>
          <Text
            style={[theme.typography.bodySmallMedium, { color: theme.colors.text.primary, marginTop: 8, textAlign: 'center' }]}
            numberOfLines={1}
          >
            {sport.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 34,
  },
});
