import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronUp, ChevronDown, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { getPlacePhotoUrl } from '@/features/places';
import type { DayPlanItem, DayPlanItemType } from '../types';

interface Props {
  item: DayPlanItem;
  index: number;
  isEditing: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function typeEmoji(type: DayPlanItemType): string {
  switch (type) {
    case 'restaurant':
      return '🍽️';
    case 'activity':
      return '🎯';
    case 'custom':
      return '✏️';
  }
}

/**
 * Formats "HH:MM" 24h → "9:00 AM". Handles edge cases gracefully.
 */
function format24hTo12h(time: string): string {
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = m.toString().padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTimeLabel(startTime: string | null, durationMinutes: number | null): string | null {
  if (!startTime) return null;
  const timeStr = format24hTo12h(startTime);
  if (durationMinutes && durationMinutes > 0) {
    return `${timeStr} · ${formatDuration(durationMinutes)}`;
  }
  return timeStr;
}

export function DayPlanItemRow({
  item,
  index,
  isEditing,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Props): React.ReactElement {
  const theme = useTheme();
  const timeLabel = formatTimeLabel(item.start_time, item.duration_minutes);
  const photoRef = item.place_data?.photoReference ?? null;

  return (
    <View style={styles.container}>
      {/* Vertical dashed connector line — shown for all items except the last */}
      {!isLast && (
        <View
          style={[
            styles.connector,
            { borderColor: theme.colors.border.default },
          ]}
        />
      )}

      {/* Row content */}
      <View style={styles.row}>
        {/* Step circle */}
        <View style={[styles.stepCircle, { backgroundColor: '#8B5CF6' }]}>
          <Text style={styles.stepNumber}>{index + 1}</Text>
        </View>

        {/* Text content */}
        <View style={styles.content}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.subtitle ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.tertiary, marginTop: 2 },
              ]}
              numberOfLines={1}
            >
              {item.subtitle}
            </Text>
          ) : null}
          {timeLabel ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.accent, marginTop: 3 },
              ]}
            >
              {timeLabel}
            </Text>
          ) : null}
        </View>

        {/* Photo or emoji thumbnail */}
        {photoRef ? (
          <Image
            source={{ uri: getPlacePhotoUrl(photoRef, 200) }}
            style={styles.photo}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.emojiBox,
              { backgroundColor: theme.colors.bg.subtle },
            ]}
          >
            <Text style={styles.emojiText}>{typeEmoji(item.item_type)}</Text>
          </View>
        )}
      </View>

      {/* Edit controls */}
      {isEditing && (
        <View style={styles.editControls}>
          <Pressable
            onPress={onMoveUp}
            disabled={isFirst}
            style={({ pressed }) => [
              styles.editBtn,
              {
                borderColor: theme.colors.border.default,
                opacity: isFirst ? 0.35 : pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Move up"
          >
            <ChevronUp size={14} color={theme.colors.text.secondary} />
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.secondary, marginLeft: 3 },
              ]}
            >
              Up
            </Text>
          </Pressable>
          <Pressable
            onPress={onMoveDown}
            disabled={isLast}
            style={({ pressed }) => [
              styles.editBtn,
              {
                borderColor: theme.colors.border.default,
                opacity: isLast ? 0.35 : pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Move down"
          >
            <ChevronDown size={14} color={theme.colors.text.secondary} />
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.secondary, marginLeft: 3 },
              ]}
            >
              Down
            </Text>
          </Pressable>
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [
              styles.editBtn,
              {
                borderColor: theme.colors.danger + '60',
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Remove stop"
          >
            <X size={14} color={theme.colors.danger} />
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.danger, marginLeft: 3 },
              ]}
            >
              Remove
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const CIRCLE_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  connector: {
    position: 'absolute',
    left: 16 + CIRCLE_SIZE / 2 - 0.75, // center under the circle
    top: CIRCLE_SIZE + 12,             // starts below the circle
    bottom: 0,
    width: 0,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingTop: 4,
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 8,
    flexShrink: 0,
  },
  emojiBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emojiText: {
    fontSize: 24,
  },
  editControls: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginLeft: CIRCLE_SIZE + 12, // align with text column
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
});
