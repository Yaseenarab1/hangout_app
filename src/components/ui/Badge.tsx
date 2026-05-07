import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type BadgeProps = {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'danger' | 'info' | 'brand';
  size?: 'sm' | 'md';
  style?: import('react-native').ViewStyle;
};

/**
 * Small pill badge for status, counts, etc.
 */
export function Badge({
  label,
  variant = 'default',
  size = 'sm',
  style,
}: BadgeProps): React.ReactElement {
  const theme = useTheme();

  const colors = (() => {
    switch (variant) {
      case 'success':
        return { bg: theme.colors.success + '20', fg: theme.colors.success };
      case 'warning':
        return { bg: theme.colors.warning + '20', fg: theme.colors.warning };
      case 'error':
      case 'danger':
        return { bg: theme.colors.danger + '20', fg: theme.colors.danger };
      case 'info':
        return { bg: theme.colors.accent + '20', fg: theme.colors.accent };
      case 'brand':
        return { bg: theme.colors.accent + '20', fg: theme.colors.accent };
      case 'default':
      default:
        return { bg: theme.colors.bg.subtle, fg: theme.colors.text.secondary };
    }
  })();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          paddingHorizontal: size === 'sm' ? 8 : 10,
          paddingVertical: size === 'sm' ? 2 : 4,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: colors.fg,
          fontSize: size === 'sm' ? 11 : 12,
          fontWeight: '600',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
