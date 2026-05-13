import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Receipt } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, Skeleton } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useMyBills } from '@/features/bills/hooks/useMyBills';
import type { Bill } from '@/features/bills/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function ProfileBillsScreen() {
  const theme = useTheme();
  const { data: bills, isLoading } = useMyBills();

  return (
    <Screen header={{ title: 'My bills', showBack: true }} contentPadding={0}>
      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={72} radius={14} />)}
        </View>
      ) : (
        <FlatList
          data={bills ?? []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={
            <EmptyState
              icon={<Receipt size={40} color="#A1A1AA" />}
              title="No standalone bills"
              body="Bills you create outside a hangout will appear here."
            />
          }
          renderItem={({ item }) => (
            <BillRow bill={item} theme={theme} />
          )}
        />
      )}
    </Screen>
  );
}

function BillRow({ bill, theme }: { bill: Bill; theme: ReturnType<typeof useTheme> }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.iconBox}>
        <Receipt size={20} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]} numberOfLines={1}>
          {bill.description || 'Bill'}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
          {formatDate(bill.paid_at)} · {bill.mode === 'itemized' ? 'Itemized' : 'Whole'}
        </Text>
      </View>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
        ${centsToDisplay(bill.amount_cents)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
