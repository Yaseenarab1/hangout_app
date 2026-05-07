import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  X,
  Compass,
  UtensilsCrossed,
  MapPinned,
  Settings2,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export type NewHangoutSheetProps = {
  visible: boolean;
  onClose: () => void;
};

type Option = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
};

export function NewHangoutSheet({
  visible,
  onClose,
}: NewHangoutSheetProps): React.ReactElement {
  const theme = useTheme();

  const navigate = (path: string): void => {
    onClose();
    // Small delay so the sheet dismisses before the push animation starts
    setTimeout(() => router.push(path as any), 50);
  };

  const options: Option[] = [
    {
      icon: <Compass size={24} color={theme.colors.accent} strokeWidth={1.5} />,
      title: 'Find what to do',
      subtitle: 'Pick an activity and vote on venues',
      onPress: () => navigate('/hangout/new-activity'),
    },
    {
      icon: (
        <UtensilsCrossed size={24} color={theme.colors.accent} strokeWidth={1.5} />
      ),
      title: 'Plan food',
      subtitle: 'Choose a cuisine or restaurant together',
      onPress: () => navigate('/hangout/new-food'),
    },
    {
      icon: <MapPinned size={24} color={theme.colors.accent} strokeWidth={1.5} />,
      title: 'Plan a day',
      subtitle: 'Multi-stop itinerary builder',
      onPress: () => {
        onClose();
        Alert.alert('Coming soon', 'Plan a Day is in the next phase.');
      },
    },
    {
      icon: (
        <Settings2 size={24} color={theme.colors.text.secondary} strokeWidth={1.5} />
      ),
      title: 'Custom hangout',
      subtitle: 'Start with full control',
      onPress: () => navigate('/hangout/new'),
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        {/* Handle + header */}
        <View style={styles.handle}>
          <View
            style={[styles.handleBar, { backgroundColor: theme.colors.border.default }]}
          />
        </View>

        <View
          style={[
            styles.header,
            { borderBottomColor: theme.colors.border.default },
          ]}
        >
          <Text
            style={[theme.typography.h3, { color: theme.colors.text.primary }]}
          >
            New hangout
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        {/* Options */}
        <View style={styles.options}>
          {options.map((opt, idx) => (
            <Pressable
              key={idx}
              onPress={opt.onPress}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderColor: theme.colors.border.default,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.optionIcon}>{opt.icon}</View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  {opt.title}
                </Text>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.text.tertiary, marginTop: 2 },
                  ]}
                >
                  {opt.subtitle}
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.text.tertiary} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  handle: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  options: { padding: 16, gap: 10 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 14,
  },
  optionIcon: { width: 32, alignItems: 'center' },
});
