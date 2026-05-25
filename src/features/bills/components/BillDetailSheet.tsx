import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { X, CalendarCheck, ChevronRight, UtensilsCrossed, Package, Share2 } from 'lucide-react-native';
import { supabase } from '@/services/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useBill } from '../hooks/useBill';
import { useSettleShare } from '../hooks/useSettleShare';
import { useVoidBill } from '../hooks/useVoidBill';
import { formatCents } from '../utils/split';
import { billsKey } from '../hooks/useBills';
import { myBillsKey } from '../hooks/useMyBills';
import { crossBalancesKey } from '../hooks/useCrossHangoutBalances';
import type { BillShare } from '../types';

type Props = {
  billId: string | null;
  hangoutId?: string | null;
  myUserId: string;
  onClose: () => void;
};

export function BillDetailSheet({
  billId,
  hangoutId,
  myUserId,
  onClose,
}: Props): React.ReactElement | null {
  const theme = useTheme();
  const qc = useQueryClient();
  const bill = useBill(billId);
  const settle = useSettleShare(hangoutId ?? '');
  const voidBillMut = useVoidBill(hangoutId ?? '');
  const [showReceipt, setShowReceipt] = useState(false);
  const [sharingBill, setSharingBill] = useState(false);

  async function handleShareBill() {
    if (!b) return;
    setSharingBill(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Not authenticated');

      let token: string;
      const { data: existing } = await (supabase as any)
        .from('bill_share_tokens')
        .select('token')
        .eq('bill_id', b.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        token = existing.token;
      } else {
        const { data: created, error } = await (supabase as any)
          .from('bill_share_tokens')
          .insert({ bill_id: b.id, created_by: auth.user.id })
          .select('token')
          .single();
        if (error) throw error;
        token = created.token;
      }

      const url = `https://cruosjnuhcuewjnzhlja.supabase.co/functions/v1/bill-page?token=${token}`;
      await Share.share({ url, message: `Here's the bill breakdown: ${url}` });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not share bill.');
    } finally {
      setSharingBill(false);
    }
  }

  function invalidateStandaloneCache() {
    if (!hangoutId) {
      qc.invalidateQueries({ queryKey: myBillsKey() });
      qc.invalidateQueries({ queryKey: crossBalancesKey() });
    }
  }

  if (!billId) return null;

  const b = bill.data;
  const isCreator = b?.created_by === myUserId;
  const hasSettledShares = b?.shares?.some((s) => s.settled_at) ?? false;
  const canVoid = isCreator && !b?.voided_at && !hasSettledShares;

  const handleSettle = (share: BillShare) => {
    Alert.alert(
      'Mark as paid?',
      `Mark your ${formatCents(share.amount_cents)} share as settled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: () =>
            settle.mutate({ shareId: share.id }, { onSuccess: invalidateStandaloneCache }),
        },
      ],
    );
  };

  const handleVoid = () => {
    Alert.alert('Void bill?', "This will remove the bill from everyone's balances.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Void',
        style: 'destructive',
        onPress: () =>
          voidBillMut.mutate(
            { billId: b!.id },
            {
              onSuccess: () => {
                invalidateStandaloneCache();
                onClose();
              },
            },
          ),
      },
    ]);
  };

  return (
    <Modal
      visible={!!billId}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.colors.bg.canvas }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>
            Bill details
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {bill.isLoading ? (
          <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />
        ) : !b ? null : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Bill summary */}
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
              <Text style={[theme.typography.h1, { color: theme.colors.text.primary }]}>
                {formatCents(b.amount_cents)}
              </Text>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, marginTop: 4 }]}>
                {b.description}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 6 }]}>
                Paid by {b.payer?.display_name ?? 'Unknown'} · {new Date(b.paid_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              {b.mode === 'itemized' && (b.subtotal_cents != null || b.tax_cents != null || b.tip_cents != null) && (
                <View style={{ marginTop: 10, gap: 3 }}>
                  {b.subtotal_cents != null && (
                    <View style={styles.breakdownRow}>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>Subtotal</Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>{formatCents(b.subtotal_cents)}</Text>
                    </View>
                  )}
                  {(b.tax_cents ?? 0) > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>Tax</Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>{formatCents(b.tax_cents!)}</Text>
                    </View>
                  )}
                  {(b.tip_cents ?? 0) > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>Tip</Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>{formatCents(b.tip_cents!)}</Text>
                    </View>
                  )}
                </View>
              )}
              {b.voided_at && (
                <Text style={[theme.typography.caption, { color: theme.colors.danger, marginTop: 6, fontWeight: '600' }]}>
                  Voided
                </Text>
              )}
            </View>

            {/* Hangout link */}
            {b.hangout && (
              <Pressable
                onPress={() => {
                  onClose();
                  setTimeout(() => router.push(`/hangout/${b.hangout!.id}`), 300);
                }}
                style={({ pressed }) => [
                  styles.hangoutRow,
                  { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={[styles.hangoutIcon, { backgroundColor: theme.colors.accent + '14' }]}>
                  <CalendarCheck size={18} color={theme.colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>From hangout</Text>
                  <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]} numberOfLines={1}>
                    {b.hangout.title}
                  </Text>
                </View>
                <ChevronRight size={16} color={theme.colors.text.tertiary} />
              </Pressable>
            )}

            {/* Receipt */}
            {b.receiptSignedUrl && (
              <Pressable onPress={() => setShowReceipt(true)} style={{ marginTop: 12 }}>
                <Image
                  source={{ uri: b.receiptSignedUrl }}
                  style={styles.receiptThumb}
                  contentFit="cover"
                />
              </Pressable>
            )}

            {/* Items (itemized bills) */}
            {b.mode === 'itemized' && (b.items ?? []).length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={styles.sectionHeader}>
                  <UtensilsCrossed size={14} color={theme.colors.text.tertiary} />
                  <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Items</Text>
                </View>
                <View style={[styles.itemsCard, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
                  {(b.items ?? []).map((item, idx) => (
                    <View key={item.id ?? idx}>
                      <View style={styles.itemRow}>
                        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary, flex: 1 }]} numberOfLines={1}>
                          {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.description}
                        </Text>
                        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary }]}>
                          {formatCents(item.amount_cents * item.quantity)}
                        </Text>
                      </View>
                      {idx < (b.items ?? []).length - 1 && (
                        <View style={[styles.itemDivider, { backgroundColor: theme.colors.border.default }]} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Shares */}
            <View style={{ marginTop: 20 }}>
              <View style={styles.sectionHeader}>
                <Package size={14} color={theme.colors.text.tertiary} />
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Split</Text>
              </View>
              {(b.shares ?? []).map((share) => {
                const isMe = share.user_id === myUserId;
                const displayName = isMe
                  ? 'You'
                  : share.guest_name ?? share.user?.display_name ?? 'Unknown';
                const isGuest = !share.user_id;
                return (
                  <View
                    key={share.id}
                    style={[
                      styles.shareRow,
                      {
                        backgroundColor: theme.colors.bg.surface,
                        borderColor: theme.colors.border.default,
                      },
                    ]}
                  >
                    <View style={styles.shareLeft}>
                      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                        {displayName}
                      </Text>
                      <Text style={[theme.typography.caption, {
                        color: share.settled_at ? theme.colors.success : isGuest ? theme.colors.text.tertiary : theme.colors.text.secondary,
                      }]}>
                        {share.settled_at ? '✓ Settled' : isGuest ? 'Guest · cash' : 'Outstanding'}
                      </Text>
                    </View>
                    <View style={styles.shareRight}>
                      <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                        {formatCents(share.amount_cents)}
                      </Text>
                      {isMe && !share.settled_at && !b.voided_at && (
                        <Pressable
                          onPress={() => handleSettle(share)}
                          style={[styles.settleBtn, { borderColor: theme.colors.accent }]}
                        >
                          <Text style={{ color: theme.colors.accent, fontSize: 12, fontWeight: '600' }}>
                            Mark paid
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Share bill */}
            {!b.voided_at && (
              <Pressable
                onPress={handleShareBill}
                disabled={sharingBill}
                style={[styles.shareBtn, { borderColor: theme.colors.accent, opacity: sharingBill ? 0.6 : 1 }]}
              >
                <Share2 size={15} color={theme.colors.accent} />
                <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: '600' }}>
                  {sharingBill ? 'Creating link…' : 'Share bill'}
                </Text>
              </Pressable>
            )}

            {/* Void */}
            {canVoid && (
              <Pressable onPress={handleVoid} style={[styles.voidBtn, { borderColor: theme.colors.danger }]}>
                <Text style={{ color: theme.colors.danger, fontSize: 14, fontWeight: '600' }}>
                  Void bill
                </Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        {/* Receipt full-screen */}
        {showReceipt && b?.receiptSignedUrl && (
          <Modal visible transparent onRequestClose={() => setShowReceipt(false)}>
            <Pressable style={styles.receiptOverlay} onPress={() => setShowReceipt(false)}>
              <Image
                source={{ uri: b.receiptSignedUrl }}
                style={styles.receiptFull}
                contentFit="contain"
              />
            </Pressable>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hangoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  hangoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  itemsCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
  receiptThumb: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginTop: 10,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  shareLeft: { gap: 2 },
  shareRight: { alignItems: 'flex-end', gap: 4 },
  settleBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },
  voidBtn: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  receiptOverlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  receiptFull: {
    width: '100%',
    height: '100%',
  },
});
