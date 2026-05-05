import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export type SummaryRowProps = {
  /** Label on the left, e.g. "Voting style". */
  label: string;
  /** Current value on the right, e.g. "Simple vote". */
  value: string;
  /** Optional icon shown before the label. */
  icon?: React.ReactNode;
  /** Tap handler — usually opens a sheet. */
  onPress: () => void;
  /** Show a separator above this row. */
  showTopSeparator?: boolean;
  /** Highlight the value (used when value is meaningful, like a chosen option). */
  highlightValue?: boolean;
};

/**
 * Compact one-line row for secondary form controls.
 *
 * Pattern: label on left, current value on right, chevron.
 * Tapping opens a modal sheet to change the value.
 *
 * Used to replace expanded-by-default form sections — saves a ton of
 * vertical space and keeps the screen focused on the primary content.
 */
export function SummaryRow({
  label,
  value,
  icon,
  onPress,
  showTopSeparator,
  highlightValue = true,
}: SummaryRowProps): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showTopSeparator && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border.default,
        },
        pressed && { backgroundColor: theme.colors.bg.subtle },
      ]}
    >
      {icon ? <View style={{ marginRight: 10 }}>{icon}</View> : null}
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.text.primary, flex: 1 },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          theme.typography.body,
          {
            color: highlightValue
              ? theme.colors.accent
              : theme.colors.text.secondary,
            marginRight: 6,
          },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <ChevronRight size={16} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});
