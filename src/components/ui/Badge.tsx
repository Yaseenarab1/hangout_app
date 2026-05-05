import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'brand' | 'info';

export type BadgeProps = {
  label: string;
  variant?: Variant;
  /** Display as a circle if the label is 1-3 chars (for unread counts). */
  pill?: boolean;
  style?: ViewStyle;
};

export function Badge({
  label,
  variant = 'default',
  pill = true,
  style,
}: BadgeProps): React.ReactElement {
  const theme = useTheme();
  const c = theme.colors;

  const palette: Record<Variant, { bg: string; text: string }> = {
    default: { bg: c.bg.muted, text: c.text.secondary },
    success: { bg: c.successSubtle, text: c.success },
    warning: { bg: c.warningSubtle, text: c.warning },
    danger: { bg: c.dangerSubtle, text: c.danger },
    brand: { bg: c.accentSubtle, text: c.accentText },
    info: { bg: c.infoSubtle, text: c.info },
  };
  const colors = palette[variant];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          borderRadius: pill ? 9999 : 6,
        },
        style,
      ]}
    >
      <Text style={[theme.typography.tiny, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
});
