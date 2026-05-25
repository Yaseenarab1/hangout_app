import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { ChevronUp, ChevronDown, X, Star, Clock } from 'lucide-react-native';
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
    case 'custom':     return '📍';
  }
}

function typeLabel(type: DayPlanItemType): string {
  switch (type) {
    case 'restaurant': return 'Restaurant';
    case 'activity':   return 'Activity';
    case 'custom':     return 'Custom';
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

const ACCENT = '#8B5CF6';

function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).springify().damping(18).stiffness(280)}
      style={animStyle}
    >
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
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
  const rating = item.place_data?.rating ?? null;
  const timeLabel = item.start_time ? format24hTo12h(item.start_time) : null;
  const durationLabel = item.duration_minutes ? formatDuration(item.duration_minutes) : null;

  return (
    <View style={styles.wrapper}>
      {/* Timeline track */}
      <View style={styles.track}>
        {/* Connector line above the node (skip for first) */}
        {!isFirst ? (
          <View style={[styles.lineSegment, { backgroundColor: ACCENT + '40' }]} />
        ) : (
          <View style={styles.lineSegment} />
        )}

        {/* Step node */}
        <View style={[styles.stepNode, { backgroundColor: ACCENT, shadowColor: ACCENT }]}>
          <Text style={styles.stepNum}>{index + 1}</Text>
        </View>

        {/* Connector line below the node (skip for last) */}
        {!isLast ? (
          <View style={[styles.lineSegmentBottom, { backgroundColor: ACCENT + '40' }]} />
        ) : (
          <View style={styles.lineSegmentBottom} />
        )}
      </View>

      {/* Card */}
      <View style={styles.cardWrap}>
        <AnimatedCard index={index}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: theme.mode === 'light' ? 0.08 : 0,
                shadowRadius: 12,
                elevation: 3,
              },
            ]}
          >
            {/* Photo section */}
            <View style={styles.photoWrap}>
              {photoRef ? (
                <Image
                  source={{ uri: getPlacePhotoUrl(photoRef, 400) }}
                  style={styles.photo}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.photo, styles.photoFallback, { backgroundColor: ACCENT + '12' }]}>
                  <Text style={styles.fallbackEmoji}>{typeEmoji(item.item_type)}</Text>
                </View>
              )}

              {/* Gradient overlay at bottom of photo for text contrast */}
              {photoRef ? (
                <View style={styles.photoOverlay} />
              ) : null}

              {/* Type chip over photo */}
              <View style={[styles.typeChip, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                <Text style={styles.typeChipText}>{typeLabel(item.item_type)}</Text>
              </View>

              {/* Delete button */}
              <Pressable
                onPress={onRemove}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { backgroundColor: 'rgba(0,0,0,0.55)', opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityLabel="Remove stop"
              >
                <X size={14} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Info section */}
            <View style={styles.info}>
              <Text
                style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontSize: 16, fontWeight: '700' }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>

              {item.subtitle ? (
                <Text
                  style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 4 }]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              ) : null}

              {/* Meta row */}
              <View style={styles.metaRow}>
                {rating ? (
                  <View style={styles.metaChip}>
                    <Star size={11} color="#F59E0B" fill="#F59E0B" />
                    <Text style={[styles.metaText, { color: theme.colors.text.secondary }]}>
                      {rating.toFixed(1)}
                    </Text>
                  </View>
                ) : null}

                {timeLabel ? (
                  <View style={[styles.metaChip, { backgroundColor: ACCENT + '14' }]}>
                    <Clock size={11} color={ACCENT} />
                    <Text style={[styles.metaText, { color: ACCENT, fontWeight: '600' }]}>
                      {timeLabel}{durationLabel ? ` · ${durationLabel}` : ''}
                    </Text>
                  </View>
                ) : null}

                <View style={{ flex: 1 }} />

                {/* Reorder controls */}
                <View style={styles.reorderRow}>
                  <Pressable
                    onPress={onMoveUp}
                    disabled={isFirst}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.reorderBtn,
                      { borderColor: theme.colors.border.default, opacity: isFirst ? 0.2 : pressed ? 0.5 : 1 },
                    ]}
                    accessibilityLabel="Move up"
                  >
                    <ChevronUp size={13} color={theme.colors.text.tertiary} />
                  </Pressable>
                  <Pressable
                    onPress={onMoveDown}
                    disabled={isLast}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.reorderBtn,
                      { borderColor: theme.colors.border.default, opacity: isLast ? 0.2 : pressed ? 0.5 : 1 },
                    ]}
                    accessibilityLabel="Move down"
                  >
                    <ChevronDown size={13} color={theme.colors.text.tertiary} />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </AnimatedCard>
      </View>
    </View>
  );
}

const NODE_SIZE = 28;
const TRACK_W = 40;

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
  lineSegment: {
    width: 2,
    flex: 1,
    minHeight: 16,
  },
  lineSegmentBottom: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  stepNode: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 6,
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cardWrap: {
    flex: 1,
    paddingBottom: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photoWrap: {
    position: 'relative',
    height: 148,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackEmoji: {
    fontSize: 44,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  typeChip: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 14,
    paddingBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
