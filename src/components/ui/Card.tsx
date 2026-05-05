import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle, type ViewProps } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type CardProps = ViewProps & {
  variant?: 'default' | 'subtle' | 'danger';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** If provided, renders as a Pressable. */
  onPress?: () => void;
  style?: ViewStyle;
  children?: React.ReactNode;
};

export function Card({
  variant = 'default',
  padding = 'md',
  onPress,
  style,
  children,
  ...rest
}: CardProps): React.ReactElement {
  const theme = useTheme();

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'subtle':
        return {
          backgroundColor: theme.colors.bg.subtle,
          borderColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: theme.colors.dangerSubtle,
          borderColor: theme.colors.danger,
        };
      case 'default':
      default:
        return {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        };
    }
  })();

  const paddingStyle: ViewStyle = (() => {
    switch (padding) {
      case 'none':
        return {};
      case 'sm':
        return { padding: theme.spacing[3] };
      case 'lg':
        return { padding: theme.spacing[5] };
      case 'md':
      default:
        return { padding: theme.spacing[4] };
    }
  })();

  const elevation = theme.mode === 'light' ? theme.elevations.e1 : theme.elevations.e0;

  const containerStyle = [styles.base, variantStyle, paddingStyle, elevation, style];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...containerStyle,
          pressed && { opacity: 0.85 },
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={containerStyle} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 14,
  },
});
