import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Check, X } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useHangout } from '@/features/hangouts';
import { useCreateBill } from '@/features/bills/hooks/useCreateBill';
import { uploadReceipt } from '@/features/bills/services/bills.service';
import { computeShares, formatCents, parseDollarsToCents } from '@/features/bills/utils/split';
import type { SplitMethod } from '@/features/bills/types';

type SplitParticipant = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  included: boolean;
  percent: number;
  amount_cents: number;
  weight: number;
};

const SPLIT_METHODS: { key: SplitMethod; label: string }[] = [
  { key: 'equal', label: 'Equal' },
  { key: 'percent', label: 'Percent' },
  { key: 'exact', label: 'Exact' },
  { key: 'shares', label: 'Shares' },
];

export default function BillsNewScreen(): React.ReactElement {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hangoutId = id ?? '';
  const { user } = useSession();
  const hangout = useHangout(hangoutId);
  const createBill = useCreateBill(hangoutId);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [payerId, setPayerId] = useState(user?.id ?? '');
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const participants = hangout.data?.participants.filter((p) => p.status !== 'removed') ?? [];

  const [splits, setSplits] = useState<Map<string, SplitParticipant>>(() => {
    const map = new Map<string, SplitParticipant>();
    for (const p of participants) {
      map.set(p.user_id, {
        user_id: p.user_id,
        display_name: p.profile.display_name,
        avatar_url: p.profile.avatar_url,
        included: true,
        percent: 0,
        amount_cents: 0,
        weight: 1,
      });
    }
    return map;
  });

  const totalCents = parseDollarsToCents(amount) ?? 0;
  const included = Array.from(splits.values()).filter((p) => p.included);

  const preview = useMemo(() => {
    if (totalCents <= 0 || included.length === 0) return [];
    try {
      if (splitMethod === 'equal') {
        return computeShares(totalCents, { method: 'equal', participants: included });
      }
      if (splitMethod === 'percent') {
        return computeShares(totalCents, {
          method: 'percent',
          participants: included.map((p) => ({ user_id: p.user_id, percent: p.percent })),
        });
      }
      if (splitMethod === 'exact') {
        return computeShares(totalCents, {
          method: 'exact',
          participants: included.map((p) => ({ user_id: p.user_id, amount_cents: p.amount_cents })),
        });
      }
      // shares
      return computeShares(totalCents, {
        method: 'shares',
        participants: included.map((p) => ({ user_id: p.user_id, weight: p.weight })),
      });
    } catch {
      return [];
    }
  }, [totalCents, included, splitMethod]);

  const previewSum = preview.reduce((s, p) => s + p.amount_cents, 0);
  const isValid =
    totalCents > 0 &&
    description.trim().length > 0 &&
    description.trim().length <= 200 &&
    included.length > 0 &&
    previewSum === totalCents;

  const handleToggle = (userId: string) => {
    setSplits((prev) => {
      const next = new Map(prev);
      const p = next.get(userId);
      if (p) next.set(userId, { ...p, included: !p.included });
      return next;
    });
  };

  const handlePickReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const handleSave = useCallback(async () => {
    if (!isValid || !user) return;
    setIsUploading(true);
    try {
      let receiptPath: string | null = null;
      if (receiptUri) {
        const tempBillId = `tmp-${Date.now()}`;
        receiptPath = await uploadReceipt(hangoutId, tempBillId, receiptUri);
      }

      await createBill.mutateAsync({
        hangout_id: hangoutId,
        payer_id: payerId,
        amount_cents: totalCents,
        description: description.trim(),
        receipt_storage_path: receiptPath,
        shares: preview,
      });

      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save bill. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [isValid, user, receiptUri, hangoutId, payerId, totalCents, description, preview, createBill]);

  const payer = participants.find((p) => p.user_id === payerId);

  return (
    <Screen
      header={{
        title: 'Add bill',
        showBack: true,
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount */}
          <View style={[styles.section, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
            <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary }]}>
              Amount
            </Text>
            <View style={styles.amountRow}>
              <Text style={[styles.dollarSign, { color: theme.colors.text.primary }]}>$</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="decimal-pad"
                style={[styles.amountInput, { color: theme.colors.text.primary }]}
                autoFocus
              />
            </View>
          </View>

          {/* Description */}
          <View style={[styles.section, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default, marginTop: 12 }]}>
            <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary }]}>
              What for
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Dinner, drinks, Airbnb…"
              placeholderTextColor={theme.colors.text.tertiary}
              style={[styles.descInput, { color: theme.colors.text.primary }]}
              maxLength={200}
            />
          </View>

          {/* Payer */}
          <Text style={[styles.groupTitle, { color: theme.colors.text.primary }]}>
            Who paid
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {participants.map((p) => (
              <Pressable
                key={p.user_id}
                onPress={() => setPayerId(p.user_id)}
                style={[
                  styles.payerChip,
                  {
                    borderColor: payerId === p.user_id ? theme.colors.accent : theme.colors.border.default,
                    backgroundColor: payerId === p.user_id ? `${theme.colors.accent}20` : theme.colors.bg.surface,
                  },
                ]}
              >
                {p.profile.avatar_url ? (
                  <Image source={{ uri: p.profile.avatar_url }} style={styles.chipAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.chipAvatar, { backgroundColor: theme.colors.bg.subtle }]}>
                    <Text style={{ color: theme.colors.text.tertiary, fontSize: 12 }}>
                      {p.profile.display_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[{ color: theme.colors.text.primary, fontSize: 13 }]}>
                  {p.user_id === user?.id ? 'You' : p.profile.display_name}
                </Text>
                {payerId === p.user_id && <Check size={14} color={theme.colors.accent} />}
              </Pressable>
            ))}
          </ScrollView>

          {/* Split method */}
          <Text style={[styles.groupTitle, { color: theme.colors.text.primary }]}>
            Split method
          </Text>
          <View style={styles.methodRow}>
            {SPLIT_METHODS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setSplitMethod(m.key)}
                style={[
                  styles.methodBtn,
                  {
                    borderColor: splitMethod === m.key ? theme.colors.accent : theme.colors.border.default,
                    backgroundColor: splitMethod === m.key ? `${theme.colors.accent}20` : theme.colors.bg.surface,
                  },
                ]}
              >
                <Text
                  style={{
                    color: splitMethod === m.key ? theme.colors.accent : theme.colors.text.secondary,
                    fontSize: 13,
                    fontWeight: '500',
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Who shares */}
          <Text style={[styles.groupTitle, { color: theme.colors.text.primary }]}>
            Who shares
          </Text>
          <View style={styles.sharesList}>
            {Array.from(splits.values()).map((sp) => {
              const previewItem = preview.find((p) => p.user_id === sp.user_id);
              return (
                <View
                  key={sp.user_id}
                  style={[
                    styles.shareRow,
                    {
                      backgroundColor: theme.colors.bg.surface,
                      borderColor: theme.colors.border.default,
                    },
                  ]}
                >
                  <Pressable onPress={() => handleToggle(sp.user_id)} style={styles.shareLeft}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: sp.included ? theme.colors.accent : theme.colors.border.default,
                          backgroundColor: sp.included ? theme.colors.accent : 'transparent',
                        },
                      ]}
                    >
                      {sp.included && <Check size={10} color="#fff" />}
                    </View>
                    <Text style={[{ color: theme.colors.text.primary, fontSize: 15 }]}>
                      {sp.user_id === user?.id ? 'You' : sp.display_name}
                    </Text>
                  </Pressable>

                  <View style={styles.shareRight}>
                    {/* Per-method input */}
                    {sp.included && splitMethod === 'percent' && (
                      <View style={styles.inputWrap}>
                        <TextInput
                          value={sp.percent > 0 ? sp.percent.toString() : ''}
                          onChangeText={(v) => {
                            const n = parseFloat(v) || 0;
                            setSplits((prev) => {
                              const next = new Map(prev);
                              next.set(sp.user_id, { ...sp, percent: n });
                              return next;
                            });
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={theme.colors.text.tertiary}
                          style={[styles.smallInput, { color: theme.colors.text.primary, borderColor: theme.colors.border.default }]}
                        />
                        <Text style={{ color: theme.colors.text.secondary, fontSize: 13 }}>%</Text>
                      </View>
                    )}
                    {sp.included && splitMethod === 'exact' && (
                      <View style={styles.inputWrap}>
                        <Text style={{ color: theme.colors.text.secondary, fontSize: 13 }}>$</Text>
                        <TextInput
                          value={sp.amount_cents > 0 ? (sp.amount_cents / 100).toFixed(2) : ''}
                          onChangeText={(v) => {
                            const cents = parseDollarsToCents(v) ?? 0;
                            setSplits((prev) => {
                              const next = new Map(prev);
                              next.set(sp.user_id, { ...sp, amount_cents: cents });
                              return next;
                            });
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={theme.colors.text.tertiary}
                          style={[styles.smallInput, { color: theme.colors.text.primary, borderColor: theme.colors.border.default }]}
                        />
                      </View>
                    )}
                    {sp.included && splitMethod === 'shares' && (
                      <View style={styles.inputWrap}>
                        <TextInput
                          value={sp.weight > 0 ? sp.weight.toString() : ''}
                          onChangeText={(v) => {
                            const n = parseInt(v, 10) || 1;
                            setSplits((prev) => {
                              const next = new Map(prev);
                              next.set(sp.user_id, { ...sp, weight: n });
                              return next;
                            });
                          }}
                          keyboardType="number-pad"
                          placeholder="1"
                          placeholderTextColor={theme.colors.text.tertiary}
                          style={[styles.smallInput, { color: theme.colors.text.primary, borderColor: theme.colors.border.default }]}
                        />
                        <Text style={{ color: theme.colors.text.secondary, fontSize: 13 }}>shares</Text>
                      </View>
                    )}

                    {/* Preview amount */}
                    {sp.included && previewItem && (
                      <Text style={{ color: theme.colors.text.secondary, fontSize: 13, minWidth: 60, textAlign: 'right' }}>
                        {formatCents(previewItem.amount_cents)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Sum mismatch warning */}
          {splitMethod !== 'equal' && totalCents > 0 && previewSum !== totalCents && (
            <Text style={{ color: theme.colors.danger, fontSize: 13, marginTop: 4 }}>
              Shares total {formatCents(previewSum)}, bill is {formatCents(totalCents)}
            </Text>
          )}

          {/* Receipt */}
          <Text style={[styles.groupTitle, { color: theme.colors.text.primary }]}>
            Receipt (optional)
          </Text>
          {receiptUri ? (
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: receiptUri }} style={styles.receiptPreview} contentFit="cover" />
              <Pressable
                onPress={() => setReceiptUri(null)}
                style={styles.removeReceipt}
              >
                <X size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handlePickReceipt}
              style={[styles.receiptBtn, { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.surface }]}
            >
              <Camera size={20} color={theme.colors.text.secondary} />
              <Text style={{ color: theme.colors.text.secondary, fontSize: 14 }}>
                Add receipt photo
              </Text>
            </Pressable>
          )}

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={!isValid || isUploading || createBill.isPending}
            style={[
              styles.saveBtn,
              {
                backgroundColor:
                  isValid && !isUploading && !createBill.isPending
                    ? theme.colors.accent
                    : theme.colors.bg.subtle,
              },
            ]}
          >
            {isUploading || createBill.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnLabel}>Save bill</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 60,
    gap: 0,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dollarSign: {
    fontSize: 28,
    fontWeight: '700',
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '700',
    flex: 1,
  },
  descInput: {
    fontSize: 16,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  payerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sharesList: { gap: 6 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shareLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smallInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    width: 64,
    textAlign: 'right',
  },
  receiptPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },
  removeReceipt: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
    padding: 4,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
  },
  saveBtn: {
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
