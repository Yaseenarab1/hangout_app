import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export type SummaryRowProps = {
  label: string;
  value: string;
  icon?: React.ReactNode;
  onPress: () => void;
  showTopSeparator?: boolean;
  highlightValue?: boolean;
};

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
