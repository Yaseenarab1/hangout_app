import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { useCreateTimePoll } from '../hooks/useCreateTimePoll';
import type { CreateTimePollInput } from '../types';

type SlotDraft = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

type Props = {
  hangoutId: string;
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
};

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000);
}

function nextRoundHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  return d;
}

function fmt(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function makeDefaultSlots(): SlotDraft[] {
  const base = nextRoundHour();
  const d2 = new Date(base);
  d2.setDate(d2.getDate() + 1);
  return [
    { id: uid(), startsAt: base, endsAt: addHours(base, 2) },
    { id: uid(), startsAt: d2, endsAt: addHours(d2, 2) },
  ];
}

function defaultDeadline(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(23, 59, 0, 0);
  return d;
}

type Picking = { slotId: string; field: 'start' | 'end' };

export function CreateTimePollSheet({ hangoutId, visible, onClose, onCreated }: Props) {
  const theme = useTheme();
  const createPoll = useCreateTimePoll();

  const [slots, setSlots] = useState<SlotDraft[]>(makeDefaultSlots);
  const [deadline] = useState<Date>(defaultDeadline);
  const [picking, setPicking] = useState<Picking | null>(null);

  function handleSlotChange(_event: DateTimePickerEvent, date?: Date) {
    if (!date || !picking) {
      if (Platform.OS === 'android') setPicking(null);
      return;
    }
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== picking.slotId) return s;
        if (picking.field === 'start') {
          return { ...s, startsAt: date, endsAt: addHours(date, 2) };
        }
        return { ...s, endsAt: date };
      }),
    );
    if (Platform.OS === 'android') setPicking(null);
  }

  function addSlot() {
    if (slots.length >= 5) return;
    const last = slots[slots.length - 1]!;
    const next = new Date(last.startsAt);
    next.setDate(next.getDate() + 1);
    setSlots((prev) => [...prev, { id: uid(), startsAt: next, endsAt: addHours(next, 2) }]);
  }

  function removeSlot(id: string) {
    if (slots.length <= 2) return;
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleCreate() {
    const input: CreateTimePollInput = {
      hangoutId,
      title: 'When works?',
      voteDeadline: deadline.toISOString(),
      slots: slots.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      })),
    };
    try {
      await createPoll.mutateAsync(input);
      setSlots(makeDefaultSlots());
      onCreated();
    } catch {
      // error handled by hook
    }
  }

  const activePicking = picking
    ? slots.find((s) => s.id === picking.slotId)
    : null;
  const pickerValue = activePicking
    ? picking!.field === 'start'
      ? activePicking.startsAt
      : activePicking.endsAt
    : new Date();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
            Find a time
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginBottom: 16 }]}>
            Add 2–5 time options. Your group votes on what works.
          </Text>

          {slots.map((slot, index) => (
            <View
              key={slot.id}
              style={[
                styles.slotCard,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <View style={styles.slotHeader}>
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                  Option {index + 1}
                </Text>
                {slots.length > 2 && (
                  <Pressable onPress={() => removeSlot(slot.id)} hitSlop={8}>
                    <Trash2 size={16} color={theme.colors.text.tertiary} />
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={() =>
                  setPicking(
                    picking?.slotId === slot.id && picking.field === 'start'
                      ? null
                      : { slotId: slot.id, field: 'start' },
                  )
                }
                style={[
                  styles.timeBtn,
                  {
                    borderColor:
                      picking?.slotId === slot.id && picking.field === 'start'
                        ? theme.colors.accent
                        : theme.colors.border.default,
                  },
                ]}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                  Start
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
                  {fmt(slot.startsAt)}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setPicking(
                    picking?.slotId === slot.id && picking.field === 'end'
                      ? null
                      : { slotId: slot.id, field: 'end' },
                  )
                }
                style={[
                  styles.timeBtn,
                  {
                    borderColor:
                      picking?.slotId === slot.id && picking.field === 'end'
                        ? theme.colors.accent
                        : theme.colors.border.default,
                  },
                ]}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                  End
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
                  {fmt(slot.endsAt)}
                </Text>
              </Pressable>
            </View>
          ))}

          {/* Inline picker rendered once, below active slot */}
          {picking !== null && (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={pickerValue}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={handleSlotChange}
                textColor={theme.colors.text.primary}
                accentColor={theme.colors.accent}
              />
              {Platform.OS === 'ios' && (
                <Pressable
                  onPress={() => setPicking(null)}
                  style={[styles.doneBtn, { backgroundColor: theme.colors.accent }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Done</Text>
                </Pressable>
              )}
            </View>
          )}

          {slots.length < 5 && (
            <Pressable
              onPress={addSlot}
              style={[styles.addSlotBtn, { borderColor: theme.colors.accent }]}
            >
              <Plus size={16} color={theme.colors.accent} />
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>
                Add another time
              </Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
          <Button
            label="Create poll"
            variant="primary"
            fullWidth
            loading={createPoll.isPending}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    padding: 20,
    paddingBottom: 12,
  },
  slotCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeBtn: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  pickerWrap: {
    marginBottom: 12,
  },
  doneBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    marginRight: 4,
  },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
