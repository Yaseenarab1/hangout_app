import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { X, Scale } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { useSetParticipantVoteWeight } from '@/features/polls';

export type VoteWeightSheetProps = {
  visible: boolean;
  onClose: () => void;
  hangoutId: string;
  userId: string;
  userName: string;
  currentWeight: number;
};

const PRESETS = [
  { label: 'Half (0.5×)', value: 0.5 },
  { label: 'Normal (1×)', value: 1.0 },
  { label: 'Double (2×)', value: 2.0 },
  { label: 'Triple (3×)', value: 3.0 },
  { label: "Doesn't vote (0×)", value: 0 },
];

/**
 * Modal for host to change a participant's vote weight.
 * Vote weight scales how much a person's vote counts in poll tallies.
 */
export function VoteWeightSheet({
  visible,
  onClose,
  hangoutId,
  userId,
  userName,
  currentWeight,
}: VoteWeightSheetProps): React.ReactElement {
  const theme = useTheme();
  const [selectedWeight, setSelectedWeight] = useState<number>(currentWeight);
  const setWeight = useSetParticipantVoteWeight();

  const handleSave = (): void => {
    setWeight.mutate(
      { hangoutId, userId, weight: selectedWeight },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg.canvas,
          paddingHorizontal: 16,
          paddingTop: 12,
        }}
      >
        <View style={styles.header}>
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
            Vote weight
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        <View style={styles.preview}>
          <Scale size={20} color={theme.colors.accent} />
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.text.primary, marginLeft: 8 },
            ]}
          >
            <Text style={{ fontWeight: '600' }}>{userName}</Text>'s vote counts as{' '}
            <Text style={{ fontWeight: '600', color: theme.colors.accent }}>
              {selectedWeight}×
            </Text>
          </Text>
        </View>

        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary, marginTop: 16, marginBottom: 12 },
          ]}
        >
          Vote weight changes how much this person's vote counts in poll tallies.
          Use double for the birthday person, half for plus-ones, or zero to
          exclude them from voting entirely.
        </Text>

        <View style={{ gap: 8 }}>
          {PRESETS.map((preset) => {
            const isActive = Math.abs(selectedWeight - preset.value) < 0.01;
            return (
              <Pressable
                key={preset.value}
                onPress={() => setSelectedWeight(preset.value)}
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
                <Text
                  style={[
                    theme.typography.body,
                    {
                      color: theme.colors.text.primary,
                      fontWeight: isActive ? '600' : '400',
                    },
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 'auto', paddingBottom: 16, paddingTop: 16 }}>
          <Button
            label="Save"
            onPress={handleSave}
            loading={setWeight.isPending}
            disabled={
              setWeight.isPending ||
              Math.abs(selectedWeight - currentWeight) < 0.01
            }
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  presetRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
});
