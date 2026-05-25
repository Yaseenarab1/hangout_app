import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronUp, ChevronDown, X, Star } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { getPlacePhotoUrl } from '@/features/places';
import type { DayPlanItem, DayPlanItemType } from '../types';

interface Props {
  item: DayPlanItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function typeEmoji(type: DayPlanItemType): string {
  switch (type) {
    case 'restaurant': return '🍽️';
    case 'activity':   return '🎯';
    case 'custom':     return '✏️';
  }
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
  const photoRef = item.place_data?.photoReference ?? null;
  const rating   = item.place_data?.rating ?? null;
  const timeLabel = item.start_time ? format24hTo12h(item.start_time) : null;
  const durationLabel = item.duration_minutes ? formatDuration(item.duration_minutes) : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
          ...(theme.mode === 'light'
            ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }
            : {}),
        },
      ]}
    >
      {/* Header row: stop label + optional time + delete */}
      <View style={styles.cardHeader}>
        <View style={[styles.stopBadge, { backgroundColor: '#8B5CF6' + '18' }]}>
          <Text style={[styles.stopBadgeText, { color: '#8B5CF6' }]}>Stop {index + 1}</Text>
        </View>

        {timeLabel ? (
          <View style={[styles.timeBadge, { backgroundColor: theme.colors.bg.subtle }]}>
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, fontWeight: '600' }]}>
              {timeLabel}{durationLabel ? ` · ${durationLabel}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={onRemove}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1 })}
          accessibilityLabel="Remove stop"
        >
          <X size={18} color={theme.colors.text.tertiary} />
        </Pressable>
      </View>

      {/* Body: photo + text */}
      <View style={styles.cardBody}>
        {photoRef ? (
          <Image
            source={{ uri: getPlacePhotoUrl(photoRef, 160) }}
            style={styles.photo}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.photo, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 30 }}>{typeEmoji(item.item_type)}</Text>
          </View>
        )}

        <View style={styles.bodyText}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text
              style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 3 }]}
              numberOfLines={2}
            >
              {item.subtitle}
            </Text>
          ) : null}
          {rating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                {rating.toFixed(1)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Footer: reorder controls */}
      <View style={styles.cardFooter}>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onMoveUp}
          disabled={isFirst}
          hitSlop={10}
          style={({ pressed }) => [
            styles.reorderBtn,
            { borderColor: theme.colors.border.default, opacity: isFirst ? 0.25 : pressed ? 0.5 : 1 },
          ]}
          accessibilityLabel="Move up"
        >
          <ChevronUp size={14} color={theme.colors.text.tertiary} />
        </Pressable>
        <Pressable
          onPress={onMoveDown}
          disabled={isLast}
          hitSlop={10}
          style={({ pressed }) => [
            styles.reorderBtn,
            { borderColor: theme.colors.border.default, opacity: isLast ? 0.25 : pressed ? 0.5 : 1 },
          ]}
          accessibilityLabel="Move down"
        >
          <ChevronDown size={14} color={theme.colors.text.tertiary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  stopBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  stopBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    flexShrink: 0,
  },
  bodyText: {
    flex: 1,
    paddingTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
