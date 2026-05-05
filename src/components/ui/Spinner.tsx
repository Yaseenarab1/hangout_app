import React from 'react';
import { ActivityIndicator, View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  /** If true, fills its parent and centers itself. */
  fullScreen?: boolean;
  style?: ViewStyle;
};

const SIZE_MAP = { sm: 'small', md: 'small', lg: 'large' } as const;
const NUMERIC_SIZE = { sm: 16, md: 24, lg: 36 } as const;

export function Spinner({ size = 'md', fullScreen = false, style }: SpinnerProps): React.ReactElement {
  const theme = useTheme();

  const indicator = (
    <ActivityIndicator
      size={size === 'sm' || size === 'md' ? 'small' : 'large'}
      color={theme.colors.accent}
      style={
        size === 'md' || size === 'sm'
          ? { transform: [{ scale: NUMERIC_SIZE[size] / 20 }] }
          : undefined
      }
    />
  );

  if (fullScreen) {
    return <View style={[styles.full, style]}>{indicator}</View>;
  }
  return <View style={style}>{indicator}</View>;
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
