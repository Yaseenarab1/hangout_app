import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';
import { formatCents } from '../utils/split';
import type { Bill } from '../types';

type Props = {
  bill: Bill;
  myUserId: string;
  onPress: (bill: Bill) => void;
};

export function BillCard({ bill, myUserId, onPress }: Props): React.ReactElement {
  const theme = useTheme();
  const isVoided = !!bill.voided_at;
  const payerName =
    bill.payer?.display_name ?? 'Someone';
  const iPaid = bill.payer_id === myUserId;

  const myShare = bill.shares?.find((s) => s.user_id === myUserId);
  const myAmountLabel = myShare
    ? myShare.settled_at
      ? 'Settled'
      : `You owe ${formatCents(myShare.amount_cents)}`
    : iPaid
    ? 'You paid'
    : null;

  return (
    <Pressable
      onPress={() => onPress(bill)}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
          opacity: isVoided ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.left}>
        {bill.payer?.avatar_url ? (
          <Image
            source={{ uri: bill.payer.avatar_url }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.colors.bg.subtle }]}>
            <Text style={{ color: theme.colors.text.tertiary, fontSize: 16 }}>
              {payerName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.middle}>
        <Text
          style={[
            theme.typography.bodyMedium,
            {
              color: theme.colors.text.primary,
              textDecorationLine: isVoided ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={1}
        >
          {bill.description}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
          {iPaid ? 'You paid' : `${payerName} paid`}
          {myAmountLabel && !iPaid ? ` • ${myAmountLabel}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {formatCents(bill.amount_cents)}
        </Text>
        {isVoided && (
          <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>Voided</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  left: {},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
});
