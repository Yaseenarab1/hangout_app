import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Camera, Image as ImageIcon, PenLine } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useBillDraft } from '@/features/bills/context/BillDraftContext';
import { useSession } from '@/features/auth';

export default function BillsNewScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hangoutId = id ?? '';
  const { user } = useSession();
  const { resetDraft, setField } = useBillDraft();

  function initDraft() {
    resetDraft({
      payerId: user?.id ?? '',
      hangoutId,
    });
  }

  async function pickAndScan(source: 'camera' | 'library') {
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8, mediaTypes: 'images' })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8, mediaTypes: 'images' });

    if (result.canceled || !result.assets?.[0]) return;

    initDraft();
    const asset = result.assets[0];
    let base64 = asset.base64;

    if (!base64 && asset.uri) {
      base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (!base64) {
      router.push('/bill/review-items');
      return;
    }

    setField('description', '');
    router.push({ pathname: '/bill/scan', params: { imageBase64: base64 } });
  }

  function goManual() {
    initDraft();
    router.push('/bill/review-items');
  }

  return (
    <Screen header={{ title: 'Add bill', showBack: true }}>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.text.secondary, marginBottom: 32 },
        ]}
      >
        Snap the receipt and we'll pull out each item. You can edit anything before splitting.
      </Text>

      <View style={styles.options}>
        <OptionCard
          icon={<Camera size={28} color={theme.colors.accent} />}
          title="Take a photo"
          subtitle="Scan receipt with your camera"
          onPress={() => pickAndScan('camera')}
          theme={theme}
        />
        <OptionCard
          icon={<ImageIcon size={28} color={theme.colors.accent} />}
          title="Upload from library"
          subtitle="Choose an existing photo"
          onPress={() => pickAndScan('library')}
          theme={theme}
        />
        <OptionCard
          icon={<PenLine size={28} color={theme.colors.accent} />}
          title="Enter manually"
          subtitle="Type in items yourself"
          onPress={goManual}
          theme={theme}
        />
      </View>
    </Screen>
  );
}

function OptionCard({
  icon,
  title,
  subtitle,
  onPress,
  theme,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.cardIcon}>{icon}</View>
      <View style={styles.cardText}>
        <Text
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
        >
          {title}
        </Text>
        <Text
          style={[theme.typography.caption, { color: theme.colors.text.secondary }]}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  cardIcon: { width: 44, alignItems: 'center' },
  cardText: { flex: 1, gap: 2 },
});
