import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type SectionHeaderProps = {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({
  title,
  count,
  actionLabel,
  onAction,
}: SectionHeaderProps): React.ReactElement {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
        <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>{title}</Text>
        {typeof count === 'number' ? (
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.text.tertiary, marginLeft: 8 },
            ]}
          >
            {count}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable hitSlop={8} onPress={onAction}>
          <Text
            style={[
              theme.typography.bodySmallMedium,
              { color: theme.colors.accentText },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
});
