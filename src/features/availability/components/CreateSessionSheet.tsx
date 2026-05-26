import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { X, Check } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { useCreateSession } from '../hooks/useCreateSession';
import type { CreateSessionInput } from '../types';

const ACCENT = '#8B5CF6';

interface Props {
  visible: boolean;
  hangoutId?: string;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

function getNext14Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function fmtDayCell(dateStr: string): { weekday: string; month: string; day: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: d.getDate().toString(),
  };
}

const HOUR_OPTIONS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

function fmtHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function CreateSessionSheet({ visible, hangoutId, onClose, onCreated }: Props) {
  const theme = useTheme();
  const createSession = useCreateSession();
  const allDays = getNext14Days();

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(22);
  const [showHourPicker, setShowHourPicker] = useState<'start' | 'end' | null>(null);

  function toggleDate(d: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        next.delete(d);
      } else if (next.size < 7) {
        next.add(d);
      }
      return next;
    });
  }

  async function handleCreate() {
    const dates = [...selectedDates].sort();
    const input: CreateSessionInput = {
      hangoutId,
      dates,
      startHour,
      endHour,
    };
    try {
      const session = await createSession.mutateAsync(input);
      setSelectedDates(new Set());
      onCreated(session.id);
    } catch {
      // error handled by mutation
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.dismissBtn}>
            <X size={20} color={theme.colors.text.secondary} />
          </Pressable>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>When can we meet?</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Instruction */}
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginBottom: 16, lineHeight: 18 }]}>
            Pick up to 7 dates you want to check. Everyone fills in when they're free.
          </Text>

          {/* Date picker grid */}
          <Text style={[styles.sectionLabel, { color: theme.colors.text.tertiary }]}>DATES TO CHECK</Text>
          <View style={styles.dateGrid}>
            {allDays.map((day, i) => {
              const { weekday, month, day: dayNum } = fmtDayCell(day);
              const selected = selectedDates.has(day);
              return (
                <Animated.View key={day} entering={FadeInDown.delay(i * 20).springify().damping(20).stiffness(280)}>
                  <Pressable
                    onPress={() => toggleDate(day)}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: selected ? ACCENT : theme.colors.bg.surface,
                        borderColor: selected ? ACCENT : theme.colors.border.default,
                      },
                    ]}
                  >
                    <Text style={[styles.dayCellWeekday, { color: selected ? '#FFFFFF99' : theme.colors.text.tertiary }]}>
                      {weekday}
                    </Text>
                    <Text style={[styles.dayCellDay, { color: selected ? '#FFFFFF' : theme.colors.text.primary }]}>
                      {dayNum}
                    </Text>
                    <Text style={[styles.dayCellMonth, { color: selected ? '#FFFFFF99' : theme.colors.text.tertiary }]}>
                      {month}
                    </Text>
                    {selected && (
                      <View style={styles.dayCellCheck}>
                        <Check size={10} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {selectedDates.size > 0 && (
            <Text style={[theme.typography.caption, { color: ACCENT, marginTop: 4, textAlign: 'center', fontWeight: '600' }]}>
              {selectedDates.size} / 7 dates selected
            </Text>
          )}

          {/* Time range */}
          <Text style={[styles.sectionLabel, { color: theme.colors.text.tertiary, marginTop: 24 }]}>TIME RANGE</Text>
          <View style={styles.timeRow}>
            <Pressable
              onPress={() => setShowHourPicker(showHourPicker === 'start' ? null : 'start')}
              style={[styles.timeBtn, {
                backgroundColor: showHourPicker === 'start' ? ACCENT + '15' : theme.colors.bg.surface,
                borderColor: showHourPicker === 'start' ? ACCENT : theme.colors.border.default,
              }]}
            >
              <Text style={[styles.timeBtnLabel, { color: theme.colors.text.tertiary }]}>From</Text>
              <Text style={[styles.timeBtnValue, { color: showHourPicker === 'start' ? ACCENT : theme.colors.text.primary }]}>
                {fmtHour(startHour)}
              </Text>
            </Pressable>

            <Text style={[{ color: theme.colors.text.tertiary, fontSize: 16 }]}>—</Text>

            <Pressable
              onPress={() => setShowHourPicker(showHourPicker === 'end' ? null : 'end')}
              style={[styles.timeBtn, {
                backgroundColor: showHourPicker === 'end' ? ACCENT + '15' : theme.colors.bg.surface,
                borderColor: showHourPicker === 'end' ? ACCENT : theme.colors.border.default,
              }]}
            >
              <Text style={[styles.timeBtnLabel, { color: theme.colors.text.tertiary }]}>Until</Text>
              <Text style={[styles.timeBtnValue, { color: showHourPicker === 'end' ? ACCENT : theme.colors.text.primary }]}>
                {fmtHour(endHour)}
              </Text>
            </Pressable>
          </View>

          {showHourPicker && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hourStrip}
              style={{ marginTop: 10 }}
            >
              {HOUR_OPTIONS.filter(h => showHourPicker === 'start' ? h < endHour : h > startHour).map(h => {
                const active = showHourPicker === 'start' ? h === startHour : h === endHour;
                return (
                  <Pressable
                    key={h}
                    onPress={() => {
                      if (showHourPicker === 'start') setStartHour(h);
                      else setEndHour(h);
                      setShowHourPicker(null);
                    }}
                    style={[styles.hourChip, {
                      backgroundColor: active ? ACCENT : theme.colors.bg.surface,
                      borderColor: active ? ACCENT : theme.colors.border.default,
                    }]}
                  >
                    <Text style={[styles.hourChipText, { color: active ? '#FFFFFF' : theme.colors.text.primary }]}>
                      {fmtHour(h)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
          <Button
            label={selectedDates.size === 0 ? 'Pick dates to continue' : `Create — ${selectedDates.size} date${selectedDates.size === 1 ? '' : 's'}`}
            variant="primary"
            fullWidth
            size="lg"
            disabled={selectedDates.size === 0}
            loading={createSession.isPending}
            onPress={handleCreate}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  dismissBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 12 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayCell: {
    width: 56,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    position: 'relative',
  },
  dayCellWeekday: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  dayCellDay: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  dayCellMonth: { fontSize: 9, fontWeight: '600', letterSpacing: 0.3 },
  dayCellCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  timeBtnLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  timeBtnValue: { fontSize: 17, fontWeight: '700' },
  hourStrip: { gap: 8, paddingVertical: 4 },
  hourChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  hourChipText: { fontSize: 13, fontWeight: '600' },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
