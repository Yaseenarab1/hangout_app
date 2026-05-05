import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type CardProps = {
  children: React.ReactNode;
  /** Padding preset. Defaults to 'md'. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Variant — flat (no border), bordered (default), or filled. */
  variant?: 'bordered' | 'flat' | 'filled';
  style?: ViewStyle;
};

const PADDING_MAP = { none: 0, sm: 8, md: 14, lg: 20 };

/**
 * Themed surface card. Used everywhere as a content container.
 */
export function Card({
  children,
  padding = 'md',
  variant = 'bordered',
  style,
}: CardProps): React.ReactElement {
  const theme = useTheme();

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'flat':
        return {
          backgroundColor: theme.colors.bg.surface,
        };
      case 'filled':
        return {
          backgroundColor: theme.colors.bg.subtle,
        };
      case 'bordered':
      default:
        return {
          backgroundColor: theme.colors.bg.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border.default,
        };
    }
  })();

  return (
    <View
      style={[
        {
          borderRadius: 14,
          padding: PADDING_MAP[padding],
        },
        variantStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}
