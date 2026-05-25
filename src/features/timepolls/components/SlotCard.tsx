import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Trophy, Check, Minus, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { TimePollSlot, SlotResponse } from '../types';

const GREEN  = '#22C55E';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';
const ACCENT = '#8B5CF6';

interface Props {
  slot: TimePollSlot;
  index: number;
  isReadOnly: boolean;
  isWinner: boolean;
  isTop: boolean; // slot with highest yes count (open poll)
  onVote: (r: SlotResponse) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day:   d.getDate().toString(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function AnimatedBar({ yes, total }: { yes: number; total: number }) {
  const pct = total > 0 ? yes / total : 0;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(pct, { damping: 18, stiffness: 80, mass: 0.8 });
  }, [pct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, fillStyle]} />
    </View>
  );
}

function VoteBtn({
  label,
  icon: Icon,
  response,
  count,
  isActive,
  activeColor,
  onPress,
  disabled,
}: {
  label: string;
  icon: typeof Check;
  response: SlotResponse;
  count: number;
  isActive: boolean;
  activeColor: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    if (disabled) return;
    scale.value = withSequence(
      withTiming(0.88, { duration: 80, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 10, stiffness: 380 }),
    );
    onPress();
  }

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={[
          styles.voteBtn,
          {
            backgroundColor: isActive ? activeColor : activeColor + '12',
            borderColor: isActive ? activeColor : activeColor + '40',
          },
        ]}
      >
        <Icon
          size={16}
          strokeWidth={2.5}
          color={isActive ? '#FFFFFF' : activeColor}
        />
        <Text style={[styles.voteBtnLabel, { color: isActive ? '#FFFFFF' : activeColor }]}>
          {label}
        </Text>
        <Text style={[styles.voteBtnCount, { color: isActive ? '#FFFFFF' + 'CC' : activeColor + '99' }]}>
          {count}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function SlotCard({ slot, index, isReadOnly, isWinner, isTop, onVote }: Props) {
  const theme = useTheme();
  const start = formatDate(slot.starts_at);
  const endTime = new Date(slot.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const total = slot.yesCount + slot.maybeCount + slot.noCount;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 90).springify().damping(18).stiffness(260)}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: isWinner
              ? GREEN + '0D'
              : theme.colors.bg.surface,
            borderColor: isWinner
              ? GREEN + '60'
              : isTop && !isReadOnly
              ? ACCENT + '50'
              : theme.colors.border.default,
            shadowColor: isWinner ? GREEN : ACCENT,
            shadowOffset: { width: 0, height: isWinner ? 6 : 3 },
            shadowOpacity: isWinner ? 0.18 : isTop ? 0.1 : 0.05,
            shadowRadius: isWinner ? 16 : 8,
            elevation: isWinner ? 5 : 2,
          },
        ]}
      >
        {/* Winner / top badge */}
        {(isWinner || (isTop && !isReadOnly)) && (
          <View style={[styles.topBadge, { backgroundColor: isWinner ? GREEN : ACCENT }]}>
            {isWinner ? (
              <>
                <Trophy size={11} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.topBadgeText}>Best time</Text>
              </>
            ) : (
              <>
                <Text style={styles.topBadgeText}>🔥 Most votes</Text>
              </>
            )}
          </View>
        )}

        {/* Date row */}
        <View style={styles.dateRow}>
          {/* Calendar chip */}
          <View style={[styles.calChip, { backgroundColor: isWinner ? GREEN + '18' : ACCENT + '12' }]}>
            <Text style={[styles.calMonth, { color: isWinner ? GREEN : ACCENT }]}>
              {start.month}
            </Text>
            <Text style={[styles.calDay, { color: isWinner ? GREEN : ACCENT }]}>
              {start.day}
            </Text>
          </View>

          {/* Day + time */}
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontWeight: '700', fontSize: 16 }]}>
              {start.weekday}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 2 }]}>
              {start.time} – {endTime}
            </Text>
          </View>

          {/* Vote count */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[{ fontSize: 22, fontWeight: '800', color: isWinner ? GREEN : theme.colors.text.primary }]}>
              {slot.yesCount}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
              going
            </Text>
          </View>
        </View>

        {/* Animated progress bar */}
        {total > 0 && (
          <View style={styles.barWrap}>
            <AnimatedBar yes={slot.yesCount} total={total} />
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginLeft: 8 }]}>
              {total} voted
            </Text>
          </View>
        )}

        {/* Vote buttons */}
        <View style={styles.voteBtns}>
          <VoteBtn
            label="Going"
            icon={Check}
            response="yes"
            count={slot.yesCount}
            isActive={slot.myResponse === 'yes'}
            activeColor={GREEN}
            onPress={() => onVote('yes')}
            disabled={isReadOnly}
          />
          <VoteBtn
            label="Maybe"
            icon={Minus}
            response="maybe"
            count={slot.maybeCount}
            isActive={slot.myResponse === 'maybe'}
            activeColor={AMBER}
            onPress={() => onVote('maybe')}
            disabled={isReadOnly}
          />
          <VoteBtn
            label="Can't"
            icon={X}
            response="no"
            count={slot.noCount}
            isActive={slot.myResponse === 'no'}
            activeColor={RED}
            onPress={() => onVote('no')}
            disabled={isReadOnly}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    overflow: 'hidden',
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 14,
  },
  topBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  calChip: {
    width: 52,
    height: 58,
    borderRadius: 14,
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
  barWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B5CF6' + '18',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  voteBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  voteBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  voteBtnCount: {
    fontSize: 11,
    fontWeight: '600',
  },
});
