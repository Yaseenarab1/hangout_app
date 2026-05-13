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
} from 'react-native';
import { Image } from 'expo-image';
import { X, Receipt } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useBill } from '../hooks/useBill';
import { useSettleShare } from '../hooks/useSettleShare';
import { useVoidBill } from '../hooks/useVoidBill';
import { formatCents } from '../utils/split';
import type { BillShare } from '../types';

type Props = {
  billId: string | null;
  hangoutId: string;
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
  const bill = useBill(billId);
  const settle = useSettleShare(hangoutId);
  const voidBillMut = useVoidBill(hangoutId);
  const [showReceipt, setShowReceipt] = useState(false);

  if (!billId) return null;

  const b = bill.data;
  const isCreator = b?.created_by === myUserId;
  const hasSettledShares = b?.shares?.some((s) => s.settled_at) ?? false;
  const canVoid = isCreator && !b?.voided_at && !hasSettledShares;

  const handleSettle = (share: BillShare) => {
    Alert.alert(
      'Mark as paid?',
      `Mark your $${formatCents(share.amount_cents).replace('$', '')} share as settled?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: () => settle.mutate({ shareId: share.id }),
        },
      ],
    );
  };

  const handleVoid = () => {
    Alert.alert('Void bill?', 'This will remove the bill from everyone\'s balances.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Void',
        style: 'destructive',
        onPress: () => voidBillMut.mutate({ billId: b!.id }, { onSuccess: onClose }),
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
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Bill summary */}
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
              <Text style={[theme.typography.h1, { color: theme.colors.text.primary }]}>
                {formatCents(b.amount_cents)}
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.text.primary, marginTop: 4 }]}>
                {b.description}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 8 }]}>
                Paid by {b.payer?.display_name ?? 'Unknown'} • {new Date(b.paid_at).toLocaleDateString()}
              </Text>
              {b.voided_at && (
                <Text style={[theme.typography.caption, { color: theme.colors.danger, marginTop: 4 }]}>
                  Voided
                </Text>
              )}
            </View>

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

            {/* Shares */}
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, marginTop: 20, marginBottom: 8 }]}>
              Split
            </Text>
            {(b.shares ?? []).map((share) => {
              const isMe = share.user_id === myUserId;
              const name = share.user?.display_name ?? 'Unknown';
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
                      {isMe ? 'You' : name}
                    </Text>
                    <Text style={[theme.typography.caption, { color: share.settled_at ? '#22C55E' : theme.colors.text.secondary }]}>
                      {share.settled_at ? 'Settled' : 'Outstanding'}
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  receiptThumb: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
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
  voidBtn: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
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
