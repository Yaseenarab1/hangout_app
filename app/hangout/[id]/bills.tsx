import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, SectionList, Alert } from 'react-native';
import { Plus, Receipt } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader, EmptyState, Skeleton } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useHangout } from '@/features/hangouts';
import {
  useBills,
  useSimplifiedDebts,
  BillCard,
  BalanceBanner,
  SimplifiedPayments,
  BillDetailSheet,
} from '@/features/bills';
import { fetchBillShares, settleShare } from '@/features/bills/services/bills.service';
import type { Bill, SimplifiedDebt } from '@/features/bills';

export default function BillsScreen(): React.ReactElement {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hangoutId = id ?? '';
  const { user } = useSession();
  const hangout = useHangout(hangoutId);
  const bills = useBills(hangoutId);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  const profilesMap = useMemo(() => {
    const map = new Map<string, { id: string; display_name: string; avatar_url: string | null }>();
    for (const p of hangout.data?.participants ?? []) {
      map.set(p.user_id, {
        id: p.user_id,
        display_name: p.profile.display_name,
        avatar_url: p.profile.avatar_url,
      });
    }
    return map;
  }, [hangout.data?.participants]);

  const debts = useSimplifiedDebts(hangoutId, profilesMap);

  const handleSettle = async (debt: SimplifiedDebt) => {
    if (!user) return;
    if (debt.from_user_id !== user.id) {
      Alert.alert('Not your debt', 'You can only settle your own shares.');
      return;
    }
    const myBills = (bills.data ?? []).filter(
      (b) => b.payer_id === debt.to_user_id && !b.voided_at,
    );
    for (const bill of myBills) {
      const shares = await fetchBillShares(bill.id);
      const myShare = shares.find((s) => s.user_id === user.id && !s.settled_at);
      if (myShare) await settleShare(myShare.id);
    }
  };

  type Section = { title: string; data: Bill[] };
  const sections: Section[] = useMemo(() => {
    const grouped = new Map<string, Bill[]>();
    for (const bill of bills.data ?? []) {
      const d = new Date(bill.paid_at);
      const label = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });
      const arr = grouped.get(label) ?? [];
      arr.push(bill);
      grouped.set(label, arr);
    }
    return Array.from(grouped.entries()).map(([title, data]) => ({ title, data }));
  }, [bills.data]);

  const myDebts =
    debts.data?.filter((d) => d.from_user_id === user?.id || d.to_user_id === user?.id) ?? [];

  return (
    <Screen
      header={{
        title: 'Bills',
        showBack: true,
        right: (
          <Pressable
            onPress={() => router.push(`/hangout/${hangoutId}/bills-new` as any)}
            hitSlop={12}
            style={{ padding: 8 }}
            accessibilityLabel="Add bill"
          >
            <Plus size={22} color={theme.colors.text.primary} />
          </Pressable>
        ),
      }}
      scroll
    >
      <BalanceBanner hangoutId={hangoutId} />

      {myDebts.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <SectionHeader title="Settle up" />
          <SimplifiedPayments
            debts={myDebts}
            myUserId={user?.id ?? ''}
            isLoading={debts.isLoading}
            onSettle={handleSettle}
          />
        </View>
      )}

      <View style={{ marginTop: 20 }}>
        <SectionHeader title="All bills" count={bills.data?.length} />
      </View>

      {bills.isLoading ? (
        <View style={{ gap: 10 }}>
          {[1, 2, 3].map((k) => (
            <Skeleton key={k} height={68} radius={12} />
          ))}
        </View>
      ) : sections.length === 0 ? (
        <EmptyState
          icon={<Receipt size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
          title="No bills yet"
          body="Tap + to add the first expense."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(b) => b.id}
          scrollEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.tertiary, marginBottom: 6, marginTop: 12 },
              ]}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 8 }}>
              <BillCard
                bill={item}
                myUserId={user?.id ?? ''}
                onPress={(b) => setSelectedBillId(b.id)}
              />
            </View>
          )}
          stickySectionHeadersEnabled={false}
        />
      )}

      <BillDetailSheet
        billId={selectedBillId}
        hangoutId={hangoutId}
        myUserId={user?.id ?? ''}
        onClose={() => setSelectedBillId(null)}
      />
    </Screen>
  );
}
