import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

export type CardProps = {
  children: React.ReactNode;
  /** Padding preset. Defaults to 'md'. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Variant — bordered (default), flat, filled, subtle (alias for filled), or danger. */
  variant?: 'bordered' | 'flat' | 'filled' | 'subtle' | 'danger';
  /** If provided, the card becomes tappable. */
  onPress?: () => void;
  /** Long-press handler. */
  onLongPress?: () => void;
  /** Disable touch interactions. */
  disabled?: boolean;
  style?: ViewStyle;
};

const PADDING_MAP = { none: 0, sm: 8, md: 14, lg: 20 };

/**
 * Themed surface card. Acts as a Pressable when `onPress` is provided,
 * otherwise a plain View.
 */
export function Card({
  children,
  padding = 'md',
  variant = 'bordered',
  onPress,
  onLongPress,
  disabled,
  style,
}: CardProps): React.ReactElement {
  const theme = useTheme();

  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'flat':
        return { backgroundColor: theme.colors.bg.surface };
      case 'filled':
      case 'subtle':
        return { backgroundColor: theme.colors.bg.subtle };
      case 'danger':
        return {
          backgroundColor: theme.colors.dangerSubtle,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.danger,
        };
      case 'bordered':
      default:
        return {
          backgroundColor: theme.colors.bg.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border.default,
          ...(theme.mode === 'light' ? theme.elevations.e1 : {}),
        };
    }
  })();

  const baseStyle: ViewStyle = {
    borderRadius: 16,
    padding: PADDING_MAP[padding],
    ...variantStyle,
  };

  if (onPress || onLongPress) {
    return <TappableCard baseStyle={baseStyle} onPress={onPress} onLongPress={onLongPress} disabled={disabled} style={style}>{children}</TappableCard>;
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}

type TappableCardProps = {
  children: React.ReactNode;
  baseStyle: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

function TappableCard({ children, baseStyle, onPress, onLongPress, disabled, style }: TappableCardProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        onPressIn={() => {
          if (!disabled) {
            scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.cubic) });
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        style={({ pressed }) => [
          baseStyle,
          pressed && { opacity: 0.85 },
          disabled && { opacity: 0.4 },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
