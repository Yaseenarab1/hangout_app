import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type Props = { date: Date };

function formatLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function DateSeparator({ date }: Props): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: theme.colors.border.default }]} />
      <Text style={[styles.label, { color: theme.colors.text.tertiary }]}>
        {formatLabel(date)}
      </Text>
      <View style={[styles.line, { backgroundColor: theme.colors.border.default }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  label: { fontSize: 11, fontWeight: '500', marginHorizontal: 10 },
});
