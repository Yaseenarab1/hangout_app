import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';
import { initialFor, colorSlotFor } from '@/lib/format';

const SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
} as const;

export type AvatarSize = keyof typeof SIZES;

export type AvatarProps = {
  /** Used to seed the fallback color. Use the user's id for stability. */
  id: string;
  /** Used for initials and the `accessibilityLabel`. */
  displayName: string;
  uri?: string | null;
  size?: AvatarSize;
  /** If true, show a small green dot in the bottom-right. */
  online?: boolean;
  style?: ViewStyle;
};

const FALLBACK_COLORS = [
  '#F87171', // red
  '#FB923C', // orange
  '#FBBF24', // amber
  '#34D399', // emerald
  '#60A5FA', // blue
  '#A78BFA', // violet
  '#F472B6', // pink
  '#22D3EE', // cyan
];

export function Avatar({
  id,
  displayName,
  uri,
  size = 'md',
  online = false,
  style,
}: AvatarProps): React.ReactElement {
  const theme = useTheme();
  const dim = SIZES[size];
  const fontSize = Math.max(12, Math.round(dim * 0.4));

  const fallbackBg = FALLBACK_COLORS[colorSlotFor(id, FALLBACK_COLORS.length)] ?? FALLBACK_COLORS[0]!;

  const dotSize = Math.max(8, Math.round(dim * 0.22));

  return (
    <View
      accessibilityLabel={`Avatar for ${displayName}`}
      style={[
        styles.wrap,
        { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: fallbackBg },
        style,
      ]}
    >

        {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dim, height: dim, borderRadius: dim / 2 }}
          cachePolicy="none"
          recyclingKey={uri}
          contentFit="cover"
        />
      ) : (
        <Text style={[styles.text, { fontSize, color: '#FFFFFF' }]}>
          {initialFor(displayName)}
        </Text>
      )}
      {online ? (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: Math.max(1.5, dotSize * 0.18),
              backgroundColor: theme.colors.success,
              borderColor: theme.colors.bg.canvas,
              right: -1,
              bottom: -1,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  text: {
    fontWeight: '600',
    includeFontPadding: false,
  },
  dot: {
    position: 'absolute',
  },
});
