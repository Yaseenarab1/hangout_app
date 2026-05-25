import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { ChevronUp, ChevronDown, Trash2, Star, Clock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { getPlacePhotoUrl } from '@/features/places';
import type { DayPlanItem, DayPlanItemType } from '../types';

const ACCENT = '#8B5CF6';

// Type accent colors
const TYPE_COLOR: Record<DayPlanItemType, string> = {
  restaurant: '#F97316', // warm orange
  activity: '#06B6D4',   // cyan
  custom: ACCENT,         // violet
};

const TYPE_EMOJI: Record<DayPlanItemType, string> = {
  restaurant: '🍽️',
  activity: '🎯',
  custom: '📍',
};

interface Props {
  item: DayPlanItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function format24hTo12h(time: string): string {
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function DayPlanItemRow({
  item,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Props): React.ReactElement {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const photoRef = item.place_data?.photoReference ?? null;
  const rating = item.place_data?.rating ?? null;
  const timeLabel = item.start_time ? format24hTo12h(item.start_time) : null;
  const durationLabel = item.duration_minutes ? formatDuration(item.duration_minutes) : null;
  const accent = TYPE_COLOR[item.item_type];

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 60).springify().damping(18).stiffness(260)}
      style={styles.wrapper}
    >
      {/* ── Left timeline track ───────────────────────────────────── */}
      <View style={styles.track}>
        {!isFirst && <View style={[styles.lineTop, { backgroundColor: accent + '50' }]} />}

        {/* Step bubble */}
        <View style={[styles.stepBubble, { backgroundColor: accent, shadowColor: accent }]}>
          <Text style={styles.stepNum}>{index + 1}</Text>
        </View>

        {!isLast && <View style={[styles.lineBottom, { backgroundColor: accent + '50' }]} />}
      </View>

      {/* ── Card ─────────────────────────────────────────────────── */}
      <Animated.View style={[{ flex: 1 }, animStyle]}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
              shadowColor: accent,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: theme.mode === 'light' ? 0.08 : 0,
              shadowRadius: 10,
              elevation: 2,
            },
          ]}
        >
          {/* Left accent bar */}
          <View style={[styles.accentBar, { backgroundColor: accent }]} />

          {/* Thumbnail */}
          <View style={[styles.thumb, { backgroundColor: accent + '12' }]}>
            {photoRef ? (
              <Image
                source={{ uri: getPlacePhotoUrl(photoRef, 160) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <Text style={styles.thumbEmoji}>{TYPE_EMOJI[item.item_type]}</Text>
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text
              style={[styles.title, { color: theme.colors.text.primary }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            {item.subtitle ? (
              <Text
                style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 2 }]}
                numberOfLines={1}
              >
                {item.subtitle}
              </Text>
            ) : null}

            {/* Meta pills */}
            <View style={styles.metaRow}>
              {rating ? (
                <View style={styles.ratingRow}>
                  <Star size={10} color="#F59E0B" fill="#F59E0B" />
                  <Text style={[styles.metaText, { color: theme.colors.text.secondary }]}>
                    {rating.toFixed(1)}
                  </Text>
                </View>
              ) : null}

              {timeLabel ? (
                <View style={[styles.timePill, { backgroundColor: accent + '15' }]}>
                  <Clock size={10} color={accent} />
                  <Text style={[styles.metaText, { color: accent, fontWeight: '600' }]}>
                    {timeLabel}{durationLabel ? ` · ${durationLabel}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <Pressable
              onPress={onMoveUp}
              disabled={isFirst}
              hitSlop={6}
              style={({ pressed }) => [
                styles.controlBtn,
                { borderColor: theme.colors.border.default, opacity: isFirst ? 0.18 : pressed ? 0.5 : 1 },
              ]}
              accessibilityLabel="Move up"
            >
              <ChevronUp size={13} color={theme.colors.text.tertiary} />
            </Pressable>
            <Pressable
              onPress={onMoveDown}
              disabled={isLast}
              hitSlop={6}
              style={({ pressed }) => [
                styles.controlBtn,
                { borderColor: theme.colors.border.default, opacity: isLast ? 0.18 : pressed ? 0.5 : 1 },
              ]}
              accessibilityLabel="Move down"
            >
              <ChevronDown size={13} color={theme.colors.text.tertiary} />
            </Pressable>
            <Pressable
              onPress={onRemove}
              hitSlop={6}
              style={({ pressed }) => [
                styles.controlBtn,
                { borderColor: '#EF444430', backgroundColor: '#EF444408', opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityLabel="Remove stop"
            >
              <Trash2 size={12} color="#EF4444" />
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const NODE_SIZE = 28;
const TRACK_W = 38;

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    paddingRight: 16,
    marginBottom: 0,
  },
  track: {
    width: TRACK_W,
    alignItems: 'center',
    flexShrink: 0,
  },
  lineTop: {
    width: 2,
    flex: 1,
    minHeight: 16,
    borderRadius: 1,
  },
  lineBottom: {
    width: 2,
    flex: 1,
    minHeight: 20,
    borderRadius: 1,
  },
  stepBubble: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    minHeight: 80,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  thumb: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  thumbEmoji: {
    fontSize: 30,
  },
  info: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  controls: {
    gap: 5,
    paddingRight: 10,
    paddingVertical: 10,
    flexShrink: 0,
  },
  controlBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
