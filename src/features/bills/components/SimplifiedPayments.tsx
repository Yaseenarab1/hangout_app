import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { formatCents } from '../utils/split';
import type { SimplifiedDebt } from '../types';

type Props = {
  debts: SimplifiedDebt[];
  myUserId: string;
  isLoading: boolean;
  onSettle: (debt: SimplifiedDebt) => void;
};

export function SimplifiedPayments({
  debts,
  myUserId,
  isLoading,
  onSettle,
}: Props): React.ReactElement | null {
  const theme = useTheme();

  if (isLoading) {
    return <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 16 }} />;
  }

  if (debts.length === 0) return null;

  return (
    <View style={styles.container}>
      {debts.map((d, i) => {
        const fromName = d.from_user?.display_name ?? 'Someone';
        const toName = d.to_user?.display_name ?? 'Someone';
        const iFromMe = d.from_user_id === myUserId;
        const iToMe = d.to_user_id === myUserId;
        const canSettle = iFromMe || iToMe;

        return (
          <View
            key={i}
            style={[
              styles.row,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
              },
            ]}
          >
            <View style={styles.left}>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                {iFromMe ? 'You' : fromName}
                {'  '}
                <ArrowRight size={14} color={theme.colors.text.secondary} />
                {'  '}
                {iToMe ? 'You' : toName}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                {formatCents(d.amount_cents)}
              </Text>
            </View>
            {canSettle && (
              <Pressable
                onPress={() => onSettle(d)}
                style={[styles.settleBtn, { borderColor: theme.colors.accent }]}
              >
                <Text style={[{ color: theme.colors.accent, fontSize: 13, fontWeight: '600' }]}>
                  Settle
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  left: { gap: 2, flex: 1 },
  settleBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
