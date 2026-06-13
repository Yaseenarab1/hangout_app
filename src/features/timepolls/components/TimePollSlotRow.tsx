import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check, Minus, X, Trophy } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { TimePollSlot, SlotResponse } from '../types';

function formatSlotTime(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${startTime}–${endTime}`;
}

type Props = {
  slot: TimePollSlot;
  isReadOnly: boolean;
  isWinner?: boolean;
  onVote: (response: SlotResponse) => void;
};

export function TimePollSlotRow({ slot, isReadOnly, isWinner, onVote }: Props) {
  const theme = useTheme();

  const buttons: {
    r: SlotResponse;
    count: number;
    activeColor: string;
    Icon: typeof Check;
  }[] = [
    { r: 'yes', count: slot.yesCount, activeColor: '#22C55E', Icon: Check },
    { r: 'maybe', count: slot.maybeCount, activeColor: '#F59E0B', Icon: Minus },
    { r: 'no', count: slot.noCount, activeColor: theme.colors.danger, Icon: X },
  ];

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: isWinner ? '#22C55E12' : theme.colors.bg.surface,
          borderColor: isWinner ? '#22C55E' : theme.colors.border.default,
        },
      ]}
    >
      <View style={styles.left}>
        {isWinner && (
          <Trophy size={14} color="#22C55E" strokeWidth={2} style={{ marginBottom: 2 }} />
        )}
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {formatSlotTime(slot.starts_at, slot.ends_at)}
        </Text>
      </View>

      <View style={styles.buttons}>
        {buttons.map(({ r, count, activeColor, Icon }) => {
          const isActive = slot.myResponse === r;
          const iconColor = isActive ? '#fff' : activeColor;
          return isReadOnly ? (
            <View
              key={r}
              style={[
                styles.btn,
                {
                  backgroundColor: theme.colors.bg.muted,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Icon size={14} strokeWidth={2.5} color={activeColor} />
              <Text style={[styles.btnLabel, { color: theme.colors.text.secondary }]}>{count}</Text>
            </View>
          ) : (
            <Pressable
              key={r}
              onPress={() => onVote(r)}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: isActive ? activeColor : theme.colors.bg.muted,
                  borderColor: isActive ? activeColor : theme.colors.border.default,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Icon size={14} strokeWidth={2.5} color={iconColor} />
              <Text
                style={[
                  styles.btnLabel,
                  { color: isActive ? '#fff' : theme.colors.text.secondary },
                ]}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  buttons: {
    flexDirection: 'row',
    gap: 6,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 3,
  },
  btnLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
