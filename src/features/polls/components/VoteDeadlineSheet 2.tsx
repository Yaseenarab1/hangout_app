import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import { X, Clock } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';

export type VoteDeadlineSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: Date | null;
  onChange: (date: Date) => void;
};

const PRESETS = [
  { label: 'In 30 minutes', minutes: 30 },
  { label: 'In 1 hour', minutes: 60 },
  { label: 'In 3 hours', minutes: 180 },
  { label: 'Tonight at 6pm', tonight: 18 },
  { label: 'Tomorrow morning', minutes: 60 * 16 },
  { label: 'Tomorrow night', minutes: 60 * 30 },
];

export function VoteDeadlineSheet({
  visible,
  onClose,
  value,
  onChange,
}: VoteDeadlineSheetProps): React.ReactElement {
  const theme = useTheme();
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const select = (date: Date): void => {
    onChange(date);
    onClose();
  };

  const presetIsActive = (preset: typeof PRESETS[number]): boolean => {
    if (!value) return false;
    const presetDate = computePresetDate(preset);
    return Math.abs(value.getTime() - presetDate.getTime()) < 60 * 1000;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        <View style={styles.header}>
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
            When does voting close?
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary, marginBottom: 20 },
          ]}
        >
          After this time, no one can vote and the winner is decided.
        </Text>

        <View style={{ gap: 8 }}>
          {PRESETS.map((preset) => {
            const isActive = presetIsActive(preset);
            const presetDate = computePresetDate(preset);
            return (
              <Pressable
                key={preset.label}
                onPress={() => select(presetDate)}
                style={({ pressed }) => [
                  styles.presetRow,
                  {
                    backgroundColor: isActive
                      ? theme.colors.accent + '15'
                      : theme.colors.bg.surface,
                    borderColor: isActive
                      ? theme.colors.accent
                      : theme.colors.border.default,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      theme.typography.bodyMedium,
                      { color: theme.colors.text.primary },
                    ]}
                  >
                    {preset.label}
                  </Text>
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.text.tertiary, marginTop: 2 },
                    ]}
                  >
                    {presetDate.toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setShowCustomPicker(true)}
            style={({ pressed }) => [
              styles.presetRow,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Clock size={18} color={theme.colors.text.tertiary} />
            <Text
              style={[
                theme.typography.bodyMedium,
                { color: theme.colors.text.primary, marginLeft: 12 },
              ]}
            >
              Pick a specific time
            </Text>
          </Pressable>
        </View>

        {showCustomPicker ? (
          <View style={{ marginTop: 16 }}>
            <DateTimePicker
              mode="datetime"
              value={value ?? new Date(Date.now() + 60 * 60 * 1000)}
              minimumDate={new Date(Date.now() + 5 * 60 * 1000)}
              onChange={(event, date) => {
                setShowCustomPicker(false);
                if (event.type === 'set' && date) select(date);
              }}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function computePresetDate(preset: typeof PRESETS[number]): Date {
  if ('tonight' in preset && preset.tonight !== undefined) {
    const d = new Date();
    d.setHours(preset.tonight, 0, 0, 0);
    if (d.getTime() < Date.now()) {
      // If 6pm has passed, push to tomorrow's 6pm
      d.setDate(d.getDate() + 1);
    }
    return d;
  }
  return new Date(Date.now() + (preset.minutes ?? 60) * 60 * 1000);
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
