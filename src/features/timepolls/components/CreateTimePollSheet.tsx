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
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { X, Plus, Trash2, Calendar, Clock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { useCreateTimePoll } from '../hooks/useCreateTimePoll';
import type { CreateTimePollInput } from '../types';

const ACCENT = '#8B5CF6';

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

type Picking = { slotId: string; field: 'start' | 'end' };

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

function fmtMonthShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function fmtDay(d: Date): string {
  return d.getDate().toString();
}

function fmtWeekday(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function AddBtn({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 12, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 300 }); }}
        style={styles.addSlotBtn}
        accessibilityLabel="Add time option"
      >
        <Plus size={16} color={ACCENT} strokeWidth={2.5} />
        <Text style={styles.addSlotText}>Add another time</Text>
      </Pressable>
    </Animated.View>
  );
}

function SlotDraftCard({
  slot,
  index,
  isOnly,
  picking,
  onPressStart,
  onPressEnd,
  onRemove,
}: {
  slot: SlotDraft;
  index: number;
  isOnly: boolean;
  picking: Picking | null;
  onPressStart: () => void;
  onPressEnd: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const isPickingStart = picking?.slotId === slot.id && picking.field === 'start';
  const isPickingEnd   = picking?.slotId === slot.id && picking.field === 'end';
  const isActive = isPickingStart || isPickingEnd;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(18).stiffness(280)}
    >
      <View
        style={[
          styles.slotCard,
          {
            backgroundColor: theme.colors.bg.surface,
            borderColor: isActive ? ACCENT : theme.colors.border.default,
            shadowColor: isActive ? ACCENT : '#000',
            shadowOffset: { width: 0, height: isActive ? 4 : 2 },
            shadowOpacity: isActive ? 0.18 : 0.05,
            shadowRadius: isActive ? 12 : 4,
            elevation: isActive ? 4 : 1,
          },
        ]}
      >
        {/* Card top: calendar chip + info */}
        <View style={styles.slotTop}>
          {/* Calendar chip */}
          <View style={[styles.calChip, { backgroundColor: isActive ? ACCENT + '18' : ACCENT + '0D' }]}>
            <Text style={[styles.calMonth, { color: isActive ? ACCENT : ACCENT + 'CC' }]}>
              {fmtMonthShort(slot.startsAt)}
            </Text>
            <Text style={[styles.calDay, { color: isActive ? ACCENT : ACCENT + 'CC' }]}>
              {fmtDay(slot.startsAt)}
            </Text>
          </View>

          {/* Slot info */}
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionLabel, { color: theme.colors.text.tertiary }]}>
              Option {index + 1}
            </Text>
            <Text style={[styles.weekdayText, { color: theme.colors.text.primary }]}>
              {fmtWeekday(slot.startsAt)}
            </Text>
            <Text style={[styles.timeRangeText, { color: theme.colors.text.secondary }]}>
              {fmtTime(slot.startsAt)} – {fmtTime(slot.endsAt)}
            </Text>
          </View>

          {/* Delete */}
          {!isOnly && (
            <Pressable
              onPress={onRemove}
              hitSlop={10}
              style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.5 : 1 }]}
              accessibilityLabel="Remove option"
            >
              <Trash2 size={15} color={theme.colors.text.tertiary} />
            </Pressable>
          )}
        </View>

        {/* Time pickers row */}
        <View style={styles.timeRow}>
          <Pressable
            onPress={onPressStart}
            style={[
              styles.timeBtn,
              {
                backgroundColor: isPickingStart ? ACCENT + '15' : theme.colors.bg.subtle,
                borderColor: isPickingStart ? ACCENT : 'transparent',
              },
            ]}
          >
            <Calendar size={12} color={isPickingStart ? ACCENT : theme.colors.text.tertiary} strokeWidth={2} />
            <Text style={[styles.timeBtnLabel, { color: theme.colors.text.tertiary }]}>Start</Text>
            <Text style={[styles.timeBtnValue, { color: isPickingStart ? ACCENT : theme.colors.text.primary }]}>
              {fmtTime(slot.startsAt)}
            </Text>
          </Pressable>

          <View style={[styles.timeDivider, { backgroundColor: theme.colors.border.default }]} />

          <Pressable
            onPress={onPressEnd}
            style={[
              styles.timeBtn,
              {
                backgroundColor: isPickingEnd ? ACCENT + '15' : theme.colors.bg.subtle,
                borderColor: isPickingEnd ? ACCENT : 'transparent',
              },
            ]}
          >
            <Clock size={12} color={isPickingEnd ? ACCENT : theme.colors.text.tertiary} strokeWidth={2} />
            <Text style={[styles.timeBtnLabel, { color: theme.colors.text.tertiary }]}>End</Text>
            <Text style={[styles.timeBtnValue, { color: isPickingEnd ? ACCENT : theme.colors.text.primary }]}>
              {fmtTime(slot.endsAt)}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export function CreateTimePollSheet({ hangoutId, visible, onClose, onCreated }: Props) {
  const theme = useTheme();
  const createPoll = useCreateTimePoll();

  const [slots, setSlots] = useState<SlotDraft[]>(makeDefaultSlots);
  const [deadline] = useState<Date>(defaultDeadline);
  const [picking, setPicking] = useState<Picking | null>(null);

  function togglePicking(slotId: string, field: 'start' | 'end') {
    setPicking((prev) =>
      prev?.slotId === slotId && prev.field === field ? null : { slotId, field },
    );
  }

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
    if (picking?.slotId === id) setPicking(null);
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
      setPicking(null);
      onCreated();
    } catch {
      // error handled by hook
    }
  }

  const activePicking = picking ? slots.find((s) => s.id === picking.slotId) : null;
  const pickerValue = activePicking
    ? picking!.field === 'start' ? activePicking.startsAt : activePicking.endsAt
    : new Date();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        {/* Header */}
        <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border.default }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.dismissBtn}>
            <X size={20} color={theme.colors.text.secondary} />
          </Pressable>
          <Text style={[styles.sheetTitle, { color: theme.colors.text.primary }]}>
            Find a time
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginBottom: 20, lineHeight: 18 }]}>
            Add 2–5 options. Your group votes on what works best.
          </Text>

          {slots.map((slot, index) => (
            <View key={slot.id} style={{ marginBottom: 12 }}>
              <SlotDraftCard
                slot={slot}
                index={index}
                isOnly={slots.length <= 2}
                picking={picking}
                onPressStart={() => togglePicking(slot.id, 'start')}
                onPressEnd={() => togglePicking(slot.id, 'end')}
                onRemove={() => removeSlot(slot.id)}
              />

              {/* Inline picker */}
              {picking?.slotId === slot.id && (
                <View style={[styles.pickerWrap, { backgroundColor: theme.colors.bg.surface, borderColor: ACCENT + '30' }]}>
                  <DateTimePicker
                    value={pickerValue}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={handleSlotChange}
                    textColor={theme.colors.text.primary}
                    accentColor={ACCENT}
                  />
                  {Platform.OS === 'ios' && (
                    <Pressable
                      onPress={() => setPicking(null)}
                      style={styles.doneBtn}
                    >
                      <Text style={styles.doneBtnText}>Done</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))}

          {slots.length < 5 && (
            <AddBtn onPress={addSlot} />
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
          <Button
            label="Create poll"
            variant="primary"
            fullWidth
            size="lg"
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dismissBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 12,
  },
  slotCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  slotTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    paddingBottom: 10,
  },
  calChip: {
    width: 52,
    height: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  calMonth: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  calDay: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
  },
  optionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  weekdayText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timeRangeText: {
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  timeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
    borderWidth: 0,
    borderRadius: 0,
  },
  timeBtnLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  timeBtnValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  pickerWrap: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  doneBtn: {
    alignSelf: 'flex-end',
    marginRight: 12,
    marginBottom: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: ACCENT + '50',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
    backgroundColor: ACCENT + '06',
  },
  addSlotText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
  },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
