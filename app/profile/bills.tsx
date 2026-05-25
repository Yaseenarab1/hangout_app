import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { Receipt, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Avatar, EmptyState, Skeleton } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useMyBills } from '@/features/bills/hooks/useMyBills';
import { useCrossHangoutBalances } from '@/features/bills/hooks/useCrossHangoutBalances';
import { BillDetailSheet } from '@/features/bills';
import type { Bill } from '@/features/bills/types';
import type { CrossHangoutBalance } from '@/features/bills/services/bills.service';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmt(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default function ProfileBillsScreen() {
  const theme = useTheme();
  const { user } = useSession();
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const { data: bills, isLoading: billsLoading } = useMyBills();
  const { data: balances, isLoading: balancesLoading } = useCrossHangoutBalances();

  const isLoading = billsLoading || balancesLoading;

  const owedToMe = (balances ?? []).filter((b) => b.net_cents > 0);
  const iOwe = (balances ?? []).filter((b) => b.net_cents < 0);

  const totalOwedToMe = owedToMe.reduce((s, b) => s + b.net_cents, 0);
  const totalIOwe = iOwe.reduce((s, b) => s + Math.abs(b.net_cents), 0);
  const allSettled = (balances ?? []).length === 0 && !balancesLoading;

  return (
    <Screen header={{ title: 'Bills', showBack: true }} contentPadding={0}>
      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          <Skeleton width="100%" height={120} radius={16} />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={72} radius={14} />
          ))}
        </View>
      ) : (
        <FlatList
          data={bills ?? []}
          keyExtractor={(b) => b.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              {/* ── Net balance summary ── */}
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
                ]}
              >
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.secondary, marginBottom: 12 }]}>
                  Across all hangouts
                </Text>

                {allSettled ? (
                  <View style={styles.settledRow}>
                    <CheckCircle2 size={20} color="#22C55E" />
                    <Text style={[theme.typography.bodyMedium, { color: '#22C55E', marginLeft: 8 }]}>
                      You're all settled up!
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Totals row */}
                    <View style={styles.totalsRow}>
                      {totalOwedToMe > 0 && (
                        <View style={styles.totalPill}>
                          <View style={[styles.totalIcon, { backgroundColor: '#DCFCE7' }]}>
                            <ArrowDownLeft size={16} color="#22C55E" />
                          </View>
                          <View>
                            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                              You're owed
                            </Text>
                            <Text style={[theme.typography.h2, { color: '#22C55E' }]}>
                              {fmt(totalOwedToMe)}
                            </Text>
                          </View>
                        </View>
                      )}
                      {totalIOwe > 0 && (
                        <View style={styles.totalPill}>
                          <View style={[styles.totalIcon, { backgroundColor: '#FEE2E2' }]}>
                            <ArrowUpRight size={16} color="#EF4444" />
                          </View>
                          <View>
                            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                              You owe
                            </Text>
                            <Text style={[theme.typography.h2, { color: '#EF4444' }]}>
                              {fmt(totalIOwe)}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Per-person breakdown */}
                    {owedToMe.length > 0 && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                          Owed to you
                        </Text>
                        {owedToMe.map((b) => (
                          <BalanceRow key={b.other_user_id} balance={b} theme={theme} />
                        ))}
                      </View>
                    )}

                    {iOwe.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                          You owe
                        </Text>
                        {iOwe.map((b) => (
                          <BalanceRow key={b.other_user_id} balance={b} theme={theme} />
                        ))}
                      </View>
                    )}

                    <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 14 }]}>
                      Net across all hangouts — settled amounts not included
                    </Text>
                  </>
                )}
              </View>

              {/* ── Bills list header ── */}
              {(bills ?? []).length > 0 && (
                <Text
                  style={[
                    theme.typography.caption,
                    {
                      color: theme.colors.text.secondary,
                      marginHorizontal: 16,
                      marginTop: 24,
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    },
                  ]}
                >
                  Recent bills
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            balances && balances.length > 0 ? null : (
              <EmptyState
                icon={<Receipt size={32} color="#A1A1AA" />}
                title="No bills yet"
                body="Bills from your hangouts and standalone splits will show up here."
              />
            )
          }
          renderItem={({ item }) => (
            <BillRow bill={item} theme={theme} onPress={() => setSelectedBillId(item.id)} myUserId={user?.id ?? ''} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          style={{ paddingHorizontal: 16 }}
        />
      )}

      <BillDetailSheet
        billId={selectedBillId}
        hangoutId={(bills ?? []).find((b) => b.id === selectedBillId)?.hangout_id ?? null}
        myUserId={user?.id ?? ''}
        onClose={() => setSelectedBillId(null)}
      />
    </Screen>
  );
}

function BalanceRow({
  balance,
  theme,
}: {
  balance: CrossHangoutBalance;
  theme: ReturnType<typeof useTheme>;
}) {
  const isOwedToMe = balance.net_cents > 0;
  return (
    <View style={styles.balanceRow}>
      <Avatar
        id={balance.other_user_id}
        displayName={balance.display_name}
        uri={balance.avatar_url}
        size="sm"
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {balance.display_name}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
          @{balance.username}
        </Text>
      </View>
      <Text
        style={[
          theme.typography.bodyMedium,
          { color: isOwedToMe ? '#22C55E' : '#EF4444', fontVariant: ['tabular-nums'] },
        ]}
      >
        {isOwedToMe ? '+' : '-'}{fmt(balance.net_cents)}
      </Text>
    </View>
  );
}

function BillRow({
  bill,
  theme,
  onPress,
  myUserId,
}: {
  bill: Bill;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
  myUserId: string;
}) {
  const myShare = bill.shares?.find((s) => s.user_id === myUserId);
  const iAmPayer = bill.payer_id === myUserId;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSubtle }]}>
        <Receipt size={20} color={theme.colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
          numberOfLines={1}
        >
          {bill.description || 'Bill'}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]} numberOfLines={1}>
          {formatDate(bill.paid_at)}
          {(bill as any).hangout?.title ? ` · ${(bill as any).hangout.title}` : ''}
          {bill.mode === 'itemized' ? ' · Itemized' : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          ${(bill.amount_cents / 100).toFixed(2)}
        </Text>
        {iAmPayer ? (
          <Text style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '600' }]}>
            You paid
          </Text>
        ) : myShare && !myShare.settled_at ? (
          <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>
            You owe ${(myShare.amount_cents / 100).toFixed(2)}
          </Text>
        ) : myShare?.settled_at ? (
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
            Settled
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  settledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  totalPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
