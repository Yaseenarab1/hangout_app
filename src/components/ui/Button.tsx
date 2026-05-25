import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** Trigger a light haptic on press (default true on primary/danger). */
  haptic?: boolean;
  style?: ViewStyle;
};

/**
 * The one button component. Use this everywhere; do not roll a custom button.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  haptic,
  onPress,
  style,
  accessibilityLabel,
  ...rest
}: ButtonProps): React.ReactElement {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const shouldHaptic =
    haptic ?? (variant === 'primary' || variant === 'danger');

  const base = stylesByVariant(theme, variant, isDisabled);
  const sizeStyles = stylesBySize(theme, size);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, fullWidth && styles.fullWidth, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={accessibilityLabel ?? label}
        hitSlop={8}
        onPressIn={() => {
          if (!isDisabled) {
            scale.value = withTiming(0.97, {
              duration: 100,
              easing: Easing.out(Easing.cubic),
            });
          }
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        onPress={(event) => {
          if (isDisabled) return;
          if (shouldHaptic) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress?.(event);
        }}
        style={({ pressed }) => [
          styles.base,
          sizeStyles.container,
          base.container,
          pressed && !isDisabled && base.pressed,
        ]}
        disabled={isDisabled}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={base.label.color as string} />
        ) : (
          <View style={styles.content}>
            {leadingIcon ? <View style={styles.iconLead}>{leadingIcon}</View> : null}
            <Text
              style={[styles.label, sizeStyles.label, base.label] as TextStyle[]}
              numberOfLines={1}
            >
              {label}
            </Text>
            {trailingIcon ? <View style={styles.iconTrail}>{trailingIcon}</View> : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44, // Apple HIG hit target
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    textAlign: 'center',
  },
  iconLead: { marginRight: 8 },
  iconTrail: { marginLeft: 8 },
});

function stylesByVariant(
  theme: ReturnType<typeof useTheme>,
  variant: Variant,
  disabled: boolean,
): { container: ViewStyle; pressed: ViewStyle; label: TextStyle } {
  const c = theme.colors;
  const dimmed = disabled ? 0.5 : 1;

  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: c.accent,
          opacity: dimmed,
          shadowColor: c.accent,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: disabled ? 0 : 0.28,
          shadowRadius: 8,
          elevation: disabled ? 0 : 4,
        },
        pressed: { backgroundColor: c.accentHover },
        label: { color: c.text.inverse, fontWeight: '600' },
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: c.bg.subtle,
          borderWidth: 1,
          borderColor: c.border.default,
          opacity: dimmed,
        },
        pressed: { backgroundColor: c.bg.muted },
        label: { color: c.text.primary, fontWeight: '500' },
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'transparent',
          opacity: dimmed,
        },
        pressed: { backgroundColor: c.bg.subtle },
        label: { color: c.accentText, fontWeight: '500' },
      };
    case 'danger':
      return {
        container: {
          backgroundColor: c.danger,
          opacity: dimmed,
        },
        pressed: { backgroundColor: c.danger, opacity: 0.85 },
        label: { color: c.text.inverse, fontWeight: '600' },
      };
  }
}

function stylesBySize(
  theme: ReturnType<typeof useTheme>,
  size: Size,
): { container: ViewStyle; label: TextStyle } {
  const t = theme.typography;
  switch (size) {
    case 'sm':
      return {
        container: {
          paddingHorizontal: theme.spacing[3],
          paddingVertical: theme.spacing[2],
          minHeight: 36,
        },
        label: { ...t.bodySmall, fontWeight: '500' },
      };
    case 'md':
      return {
        container: {
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[3],
        },
        label: { ...t.body },
      };
    case 'lg':
      return {
        container: {
          paddingHorizontal: theme.spacing[5],
          paddingVertical: theme.spacing[4],
          minHeight: 52,
        },
        label: { ...t.body, fontSize: 17 },
      };
  }
}
