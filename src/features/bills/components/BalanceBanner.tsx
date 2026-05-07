import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUserBalance } from '../hooks/useUserBalance';
import { formatCents } from '../utils/split';

export function BalanceBanner({ hangoutId }: { hangoutId: string }): React.ReactElement {
  const theme = useTheme();
  const balance = useUserBalance(hangoutId);
  const net = balance.data?.net_cents ?? 0;

  const isPositive = net > 0;
  const isNegative = net < 0;

  const color = isPositive
    ? '#22C55E'
    : isNegative
    ? theme.colors.danger
    : theme.colors.text.secondary;

  const label = isPositive
    ? `${formatCents(net)} owed to you`
    : isNegative
    ? `You owe ${formatCents(-net)}`
    : 'All settled up';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: isPositive
            ? 'rgba(34,197,94,0.3)'
            : isNegative
            ? 'rgba(239,68,68,0.3)'
            : theme.colors.border.default,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
        Your balance
      </Text>
      <Text style={[styles.amount, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  label: { fontSize: 12, fontWeight: '500' },
  amount: { fontSize: 20, fontWeight: '700' },
});
