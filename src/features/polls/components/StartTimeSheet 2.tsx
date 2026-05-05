import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import { X, CalendarPlus, CalendarOff } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';

export type StartTimeSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: Date | null;
  onChange: (date: Date | null) => void;
};

const PRESETS = [
  { label: 'Tonight', hours: 5 },
  { label: 'Tomorrow', hours: 24 },
  { label: 'This weekend', hours: 24 * 4 },
];

export function StartTimeSheet({
  visible,
  onClose,
  value,
  onChange,
}: StartTimeSheetProps): React.ReactElement {
  const theme = useTheme();
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const select = (date: Date | null): void => {
    onChange(date);
    onClose();
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
            When?
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
          When does the hangout start? You can decide later if you're not sure.
        </Text>

        <View style={{ gap: 8 }}>
          {PRESETS.map((preset) => {
            const presetDate = new Date(Date.now() + preset.hours * 60 * 60 * 1000);
            presetDate.setMinutes(0, 0, 0);
            const isActive =
              value &&
              Math.abs(value.getTime() - presetDate.getTime()) < 60 * 60 * 1000;
            return (
              <Pressable
                key={preset.label}
                onPress={() => select(presetDate)}
                style={({ pressed }) => [
                  styles.row,
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
                    style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
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
                    })}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setShowCustomPicker(true)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <CalendarPlus size={20} color={theme.colors.text.tertiary} />
            <Text
              style={[
                theme.typography.bodyMedium,
                { color: theme.colors.text.primary, marginLeft: 12 },
              ]}
            >
              Pick a specific time
            </Text>
          </Pressable>

          <Pressable
            onPress={() => select(null)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: value === null
                  ? theme.colors.accent + '10'
                  : theme.colors.bg.surface,
                borderColor: value === null
                  ? theme.colors.accent
                  : theme.colors.border.default,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <CalendarOff size={20} color={theme.colors.text.tertiary} />
            <Text
              style={[
                theme.typography.bodyMedium,
                { color: theme.colors.text.primary, marginLeft: 12 },
              ]}
            >
              We'll figure it out later
            </Text>
          </Pressable>
        </View>

        {showCustomPicker ? (
          <View style={{ marginTop: 16 }}>
            <DateTimePicker
              mode="datetime"
              value={value ?? new Date(Date.now() + 24 * 60 * 60 * 1000)}
              minimumDate={new Date()}
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

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
});
