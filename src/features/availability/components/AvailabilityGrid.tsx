import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import type { AvailabilityResponse } from '../types';

const CELL_W = 52;
const CELL_H = 44;
const HOUR_COL_W = 46;
const ACCENT = '#8B5CF6';
const GREEN = '#22C55E';
const LIGHT_GREEN = '#86EFAC';

interface Props {
  dates: string[];             // YYYY-MM-DD
  startHour: number;
  endHour: number;
  myUserId: string;
  mySlots: Set<string>;        // "YYYY-MM-DD:HH"
  responses: AvailabilityResponse[];
  onToggle: (slot: string) => void;
}

function fmtDayHeader(dateStr: string): { weekday: string; day: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    day: d.getDate().toString(),
  };
}

function fmtHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function getCellStyle(
  slot: string,
  mySlots: Set<string>,
  counts: Record<string, number>,
  total: number,
): { bg: string; border: string; label?: string } {
  const isMe = mySlots.has(slot);
  const count = counts[slot] ?? 0;
  const others = isMe ? count - 1 : count;

  if (isMe && total > 1 && count === total) {
    return { bg: GREEN, border: '#16A34A', label: '✓' };          // everyone free — bright green
  }
  if (isMe && others > 0) {
    return { bg: LIGHT_GREEN, border: '#4ADE80' };                  // me + some others — light green
  }
  if (isMe) {
    return { bg: ACCENT, border: '#7C3AED' };                       // only me — violet
  }
  if (count > 0) {
    const opacity = Math.round((count / Math.max(total, 1)) * 0.35 * 255).toString(16).padStart(2, '0');
    return { bg: ACCENT + opacity, border: 'transparent' };         // others only — faint violet
  }
  return { bg: 'transparent', border: 'transparent' };              // nobody
}

export function AvailabilityGrid({
  dates,
  startHour,
  endHour,
  myUserId,
  mySlots,
  responses,
  onToggle,
}: Props) {
  const theme = useTheme();

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = startHour; h <= endHour; h++) arr.push(h);
    return arr;
  }, [startHour, endHour]);

  // Count how many people are available per slot (including me)
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const resp of responses) {
      for (const slot of resp.available) {
        map[slot] = (map[slot] ?? 0) + 1;
      }
    }
    return map;
  }, [responses]);

  const totalRespondents = responses.length;

  // Best times: slots where count === totalRespondents (and > 1)
  const bestSlots = useMemo(() => {
    if (totalRespondents < 2) return new Set<string>();
    return new Set(Object.entries(counts).filter(([, c]) => c === totalRespondents).map(([k]) => k));
  }, [counts, totalRespondents]);

  const borderColor = theme.colors.border.default;
  const bgSurface = theme.colors.bg.surface;
  const bgSubtle = theme.colors.bg.subtle;
  const textTertiary = theme.colors.text.tertiary;
  const textPrimary = theme.colors.text.primary;

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      {/* Legend */}
      <View style={styles.legend}>
        <LegendDot color={ACCENT} label="Me" />
        {totalRespondents > 1 && <LegendDot color={LIGHT_GREEN} label="Me + some" />}
        {totalRespondents > 1 && <LegendDot color={GREEN} label="Everyone free" />}
      </View>

      {/* Grid */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
        {/* Date headers row */}
        <View style={[styles.headerRow, { backgroundColor: bgSurface, borderBottomColor: borderColor }]}>
          <View style={{ width: HOUR_COL_W }} />
          {dates.map((date) => {
            const { weekday, day } = fmtDayHeader(date);
            return (
              <View key={date} style={[styles.dateHeader, { width: CELL_W }]}>
                <Text style={[styles.dateWeekday, { color: textTertiary }]}>{weekday}</Text>
                <View style={[styles.dateDayCircle, { backgroundColor: bgSubtle }]}>
                  <Text style={[styles.dateDay, { color: textPrimary }]}>{day}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Hour rows */}
        {hours.map((hour, hIdx) => (
          <View
            key={hour}
            style={[
              styles.hourRow,
              {
                borderBottomColor: borderColor,
                borderBottomWidth: hIdx < hours.length - 1 ? StyleSheet.hairlineWidth : 0,
              },
            ]}
          >
            {/* Hour label */}
            <View style={[styles.hourLabel, { width: HOUR_COL_W }]}>
              <Text style={[styles.hourText, { color: textTertiary }]}>{fmtHour(hour)}</Text>
            </View>

            {/* Cells for each date */}
            {dates.map((date, dIdx) => {
              const slot = `${date}:${hour.toString().padStart(2, '0')}`;
              const cell = getCellStyle(slot, mySlots, counts, totalRespondents);
              const isBest = bestSlots.has(slot);

              return (
                <Pressable
                  key={slot}
                  onPress={() => onToggle(slot)}
                  style={[
                    styles.cell,
                    {
                      width: CELL_W,
                      height: CELL_H,
                      borderLeftWidth: dIdx > 0 ? StyleSheet.hairlineWidth : 0,
                      borderLeftColor: borderColor,
                      backgroundColor: cell.bg === 'transparent' ? 'transparent' : cell.bg,
                    },
                  ]}
                >
                  {isBest && (
                    <View style={styles.bestGlow} />
                  )}
                  {cell.label && (
                    <Text style={styles.cellCheck}>{cell.label}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Respondents summary */}
      {responses.length > 0 && (
        <View style={[styles.respondents, { borderTopColor: borderColor }]}>
          <Text style={[styles.respondentsLabel, { color: textTertiary }]}>
            {responses.length} {responses.length === 1 ? 'person' : 'people'} filled in
          </Text>
          <View style={styles.respondentAvatars}>
            {responses.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.respondentDot,
                  {
                    backgroundColor: r.user_id === myUserId ? ACCENT : theme.colors.bg.subtle,
                    borderColor: theme.colors.border.default,
                  },
                ]}
              >
                <Text style={styles.respondentInitial}>
                  {(r.profile?.display_name ?? r.guest_name ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: theme.colors.text.tertiary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  dateHeader: {
    alignItems: 'center',
    gap: 4,
  },
  dateWeekday: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  dateDayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 14,
    fontWeight: '700',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  hourText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  cell: {
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bestGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  cellCheck: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  respondents: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  respondentsLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  respondentAvatars: {
    flexDirection: 'row',
    gap: -4,
  },
  respondentDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  respondentInitial: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
