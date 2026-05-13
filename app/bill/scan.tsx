import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useScanReceipt } from '@/features/bills/hooks/useScanReceipt';
import { useBillDraft } from '@/features/bills/context/BillDraftContext';

export default function ScanScreen() {
  const theme = useTheme();
  const { imageBase64 } = useLocalSearchParams<{ imageBase64: string }>();
  const scan = useScanReceipt();
  const { setItems, setField } = useBillDraft();

  useEffect(() => {
    if (!imageBase64) return;
    scan.mutate(imageBase64, {
      onSuccess(result) {
        setItems(
          result.items.map((item) => ({
            description: item.description,
            amount_cents: item.amount_cents,
            quantity: item.quantity,
            source: 'ocr' as const,
            position: item.position,
          })),
        );
        if (result.taxCents != null) setField('taxCents', result.taxCents);
        if (result.tipCents != null) setField('tipCents', result.tipCents);
        router.replace('/bill/review-items');
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen contentPadding={0}>
      <View style={styles.center}>
        {scan.isPending && (
          <>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text
              style={[theme.typography.bodyMedium, { color: theme.colors.text.secondary, marginTop: 16 }]}
            >
              Reading receipt…
            </Text>
          </>
        )}
        {scan.isError && (
          <>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.danger }]}>
              Could not read the receipt.
            </Text>
            <Text
              style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 8, textAlign: 'center' }]}
            >
              {scan.error?.message}
            </Text>
            <Button
              label="Enter manually"
              variant="primary"
              style={{ marginTop: 24 }}
              onPress={() => router.replace('/bill/review-items')}
            />
            <Button
              label="Go back"
              variant="secondary"
              style={{ marginTop: 8 }}
              onPress={() => router.back()}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
});
