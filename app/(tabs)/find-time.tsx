import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, ChevronRight, Calendar } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useOpenTimePolls } from '@/features/timepolls';
import type { OpenTimePollSummary } from '@/features/timepolls';

const ACCENT = '#8B5CF6';

function deadlineInfo(iso: string): { label: string; color: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.round((d.getTime() - now.getTime()) / 3_600_000);
  if (diffH < 0)  return { label: 'Deadline passed', color: '#EF4444' };
  if (diffH < 24) return { label: `${diffH}h left`, color: '#F59E0B' };
  return { label: `${Math.floor(diffH / 24)}d left`, color: '#22C55E' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function PollCard({ item, index }: { item: OpenTimePollSummary; index: number }) {
  const theme = useTheme();
  const router = useRouter();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dl = deadlineInfo(item.vote_deadline);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(18).stiffness(260)}
      style={animStyle}
    >
      <Pressable
        onPress={() => router.push(`/hangout/${item.hangout_id}/time-poll` as any)}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.cubic) }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: theme.mode === 'light' ? 0.06 : 0,
            shadowRadius: 8,
            elevation: 2,
          },
        ]}
      >
        {/* Left icon */}
        <View style={[styles.cardIcon, { backgroundColor: ACCENT + '15' }]}>
          <Clock size={22} color={ACCENT} strokeWidth={1.5} />
        </View>

        {/* Info */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontWeight: '700' }]}
            numberOfLines={1}
          >
            {item.hangout?.title ?? 'Hangout'}
          </Text>

          {/* Poll pill */}
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: ACCENT + '12' }]}>
              <Calendar size={10} color={ACCENT} strokeWidth={2.5} />
              <Text style={[styles.pillText, { color: ACCENT }]}>Time poll open</Text>
            </View>
          </View>

          {/* Deadline */}
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
            Ends {formatDate(item.vote_deadline)}
          </Text>
        </View>

        {/* Deadline badge */}
        <View style={[styles.deadlineBadge, { backgroundColor: dl.color + '18' }]}>
          <Text style={[styles.deadlineText, { color: dl.color }]}>{dl.label}</Text>
        </View>

        <ChevronRight size={16} color={theme.colors.text.tertiary} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

export default function FindTimeScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const polls = useOpenTimePolls();

  const pollCount = polls.data?.length ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 16),
            backgroundColor: theme.colors.bg.canvas,
            borderBottomColor: theme.colors.border.default,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Find Time</Text>
        {pollCount > 0 && (
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
            {pollCount} open {pollCount === 1 ? 'poll' : 'polls'}
          </Text>
        )}
      </View>

      {/* Loading */}
      {polls.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      )}

      {/* Empty state */}
      {!polls.isLoading && pollCount === 0 && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
          {/* Hero */}
          <View style={[styles.emptyHero, { backgroundColor: ACCENT + '10' }]}>
            <Clock size={42} color={ACCENT} strokeWidth={1.5} />
            <View style={[styles.heroDot, { top: 18, right: 22, width: 8, height: 8, backgroundColor: ACCENT + '40' }]} />
            <View style={[styles.heroDot, { bottom: 20, left: 26, width: 5, height: 5, backgroundColor: ACCENT + '30' }]} />
            <View style={[styles.heroDot, { top: 32, left: 18, width: 6, height: 6, backgroundColor: ACCENT + '25' }]} />
          </View>

          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            No open polls
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center', lineHeight: 22 }]}>
            Start a time poll inside any hangout to help your group agree on when to meet.
          </Text>

          <Pressable
            onPress={() => router.push('/(tabs)/hangouts')}
            style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Calendar size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.emptyBtnText}>Go to hangouts</Text>
          </Pressable>

          {/* How it works */}
          <View style={[styles.howItWorks, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontWeight: '700', marginBottom: 10 }]}>
              How it works
            </Text>
            {[
              { emoji: '1️⃣', text: 'Open a hangout and tap "Find a time"' },
              { emoji: '2️⃣', text: 'Propose 2–5 date/time options' },
              { emoji: '3️⃣', text: 'Everyone votes · best time wins' },
            ].map((step) => (
              <View key={step.emoji} style={styles.stepRow}>
                <Text style={styles.stepEmoji}>{step.emoji}</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, flex: 1, lineHeight: 18 }]}>
                  {step.text}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Poll list */}
      {!polls.isLoading && pollCount > 0 && (
        <FlatList
          data={polls.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <PollCard item={item} index={index} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, paddingBottom: 8, fontWeight: '600', letterSpacing: 0.3 }]}>
              OPEN POLLS
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 48,
  },
  emptyHero: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDot: {
    position: 'absolute',
    borderRadius: 99,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  howItWorks: {
    marginTop: 32,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  stepEmoji: { fontSize: 14, lineHeight: 20 },
  list: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deadlineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexShrink: 0,
  },
  deadlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
