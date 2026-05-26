import React, { useState } from 'react';
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
import { CalendarDays, ChevronRight, Plus, Users } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { CreateSessionSheet } from '@/features/availability';
import { getUserSessions } from '@/features/availability/services/availability.service';
import type { AvailabilitySession } from '@/features/availability';

const ACCENT = '#8B5CF6';

function fmtDates(dates: string[]): string {
  if (dates.length === 0) return 'No dates';
  const first = new Date(dates[0]! + 'T12:00:00');
  const last = new Date(dates[dates.length - 1]! + 'T12:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (dates.length === 1) return first.toLocaleDateString('en-US', opts);
  return `${first.toLocaleDateString('en-US', opts)} – ${last.toLocaleDateString('en-US', opts)}`;
}

function SessionCard({ item, index }: { item: AvailabilitySession; index: number }) {
  const theme = useTheme();
  const router = useRouter();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    if (item.hangout_id) {
      router.push(`/hangout/${item.hangout_id}/when-to-meet` as any);
    }
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(18).stiffness(260)}
      style={animStyle}
    >
      <Pressable
        onPress={handlePress}
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
        <View style={[styles.cardIcon, { backgroundColor: ACCENT + '15' }]}>
          <CalendarDays size={22} color={ACCENT} strokeWidth={1.5} />
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, fontWeight: '700' }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
            {fmtDates(item.dates)} · {item.dates.length} date{item.dates.length === 1 ? '' : 's'}
          </Text>
        </View>

        <ChevronRight size={16} color={theme.colors.text.tertiary} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

export default function FindTimeScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [showCreate, setShowCreate] = useState(false);

  const sessions = useQuery({
    queryKey: ['availability_sessions', 'mine', user?.id],
    queryFn: () => getUserSessions(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const data = sessions.data ?? [];

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
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Find Time</Text>
          {data.length > 0 && (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
              {data.length} session{data.length === 1 ? '' : 's'}
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => setShowCreate(true)}
          style={[styles.newBtn, { backgroundColor: ACCENT }]}
          accessibilityLabel="Create new session"
        >
          <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.newBtnText}>New</Text>
        </Pressable>
      </View>

      {/* Loading */}
      {sessions.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      )}

      {/* Empty state */}
      {!sessions.isLoading && data.length === 0 && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
          <View style={[styles.emptyHero, { backgroundColor: ACCENT + '10' }]}>
            <CalendarDays size={42} color={ACCENT} strokeWidth={1.5} />
            <View style={[styles.heroDot, { top: 18, right: 22, width: 8, height: 8, backgroundColor: ACCENT + '40' }]} />
            <View style={[styles.heroDot, { bottom: 20, left: 26, width: 5, height: 5, backgroundColor: ACCENT + '30' }]} />
          </View>

          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            When to Meet
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center', lineHeight: 22 }]}>
            Everyone marks their free times on a grid. Best overlapping times light up green — no voting needed.
          </Text>

          <Pressable
            onPress={() => setShowCreate(true)}
            style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.emptyBtnText}>Create session</Text>
          </Pressable>

          {/* How it works */}
          <View style={[styles.howItWorks, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
            {[
              { emoji: '1️⃣', text: 'Pick dates you want to check (up to 7)' },
              { emoji: '2️⃣', text: "Share with friends — everyone taps when they're free" },
              { emoji: '3️⃣', text: 'Green slots = times that work for everyone' },
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

      {/* Session list */}
      {!sessions.isLoading && data.length > 0 && (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <SessionCard item={item} index={index} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: theme.colors.text.tertiary }]}>
              YOUR SESSIONS
            </Text>
          }
        />
      )}

      {/* Create standalone session sheet */}
      <CreateSessionSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => setShowCreate(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  listHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
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
});
