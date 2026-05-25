import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  ZoomIn,
  Easing,
} from 'react-native-reanimated';
import { REACTIONS, type ReactionType } from '../types';

interface Props {
  onSelect: (type: ReactionType) => void;
  currentReaction: ReactionType | null;
}

export function ReactionPicker({ onSelect, currentReaction }: Props): React.ReactElement {
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(18).stiffness(300)}
      style={styles.container}
    >
      {REACTIONS.map((r) => (
        <ReactionPill
          key={r.type}
          emoji={r.emoji}
          isActive={currentReaction === r.type}
          onPress={() => onSelect(r.type)}
        />
      ))}
    </Animated.View>
  );
}

function ReactionPill({
  emoji,
  isActive,
  onPress,
}: {
  emoji: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.82, { duration: 80, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 350 });
      }}
      style={[styles.pill, isActive && styles.pillActive]}
      hitSlop={6}
    >
      <Animated.View style={animStyle}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 30,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
  },
  pill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  emoji: {
    fontSize: 24,
  },
});
