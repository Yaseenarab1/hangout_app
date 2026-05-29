import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Share2, Users, CalendarDays } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import {
  useSession as useAvailabilitySession,
  useUpdateAvailability,
  AvailabilityGrid,
} from '@/features/availability';

const ACCENT = '#8B5CF6';
const SUPABASE_URL = 'https://cruosjnuhcuewjnzhlja.supabase.co';

export default function AvailabilitySessionScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  const session = useAvailabilitySession(sessionId);
  const s = session.data;

  const mySlots = useMemo<Set<string>>(() => {
    if (!s || !user) return new Set();
    const myResp = s.responses.find(r => r.user_id === user.id);
    return new Set(myResp?.available ?? []);
  }, [s, user]);

  const update = useUpdateAvailability(s?.id ?? '', user?.id ?? '');

  function handleToggle(slot: string) {
    if (!s) return;
    const next = new Set(mySlots);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    update.mutate([...next]);
  }

  function handleShare() {
    if (!sessionId) return;
    const url = `${SUPABASE_URL}/functions/v1/availability-page?id=${sessionId}`;
    Share.share({ message: `Fill in when you're free! ${url}`, url });
  }

  // ── Header ──────────────────────────────────────────────────────────────
  const Header = (
    <View
      style={[
        styles.headerBar,
        {
          paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 12),
          backgroundColor: theme.colors.bg.canvas,
          borderBottomColor: theme.colors.border.default,
        },
      ]}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[styles.iconBtn, { backgroundColor: theme.colors.bg.subtle }]}
      >
        <ArrowLeft size={18} color={theme.colors.text.primary} strokeWidth={2} />
      </Pressable>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[theme.typography.h3, { color: theme.colors.text.primary, fontWeight: '800' }]}>
          When to Meet
        </Text>
        {s && (
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 1 }]}>
            {s.dates.length} date{s.dates.length === 1 ? '' : 's'} · {s.responses.length} filled in
          </Text>
        )}
      </View>

      {s && (
        <Pressable
          onPress={handleShare}
          hitSlop={10}
          style={[styles.iconBtn, { backgroundColor: theme.colors.bg.subtle }]}
        >
          <Share2 size={16} color={ACCENT} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );

  if (session.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      </View>
    );
  }

  if (session.isError || !s) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
          <View style={[styles.emptyHero, { backgroundColor: ACCENT + '10' }]}>
            <CalendarDays size={42} color={ACCENT} strokeWidth={1.5} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            {session.isError ? 'Failed to load' : 'Session not found'}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center' }]}>
            {session.isError
              ? (session.error as Error)?.message ?? 'Unknown error'
              : 'This session may have been deleted.'}
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {Header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Who's responded */}
        {s.responses.length > 0 && (
          <View style={[styles.respondedRow, { backgroundColor: ACCENT + '0D', borderColor: ACCENT + '25' }]}>
            <Users size={13} color={ACCENT} strokeWidth={2} />
            <Text style={[styles.respondedText, { color: ACCENT }]}>
              {s.responses.length} {s.responses.length === 1 ? 'person has' : 'people have'} filled in
            </Text>
          </View>
        )}

        <View style={[styles.instruction, { backgroundColor: ACCENT + '0D', borderColor: ACCENT + '25' }]}>
          <Text style={[styles.instructionText, { color: ACCENT }]}>
            Tap cells to mark when you're free. Green = everyone available.
          </Text>
        </View>

        <AvailabilityGrid
          dates={s.dates}
          startHour={s.start_hour}
          endHour={s.end_hour}
          myUserId={user?.id ?? ''}
          mySlots={mySlots}
          responses={s.responses}
          onToggle={handleToggle}
        />

        {/* Share prompt */}
        <Pressable
          onPress={handleShare}
          style={[styles.shareRow, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}
        >
          <Share2 size={16} color={ACCENT} strokeWidth={2} />
          <Text style={[theme.typography.caption, { color: ACCENT, fontWeight: '700', flex: 1 }]}>
            Share link — others can fill in without the app
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyHero: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  scrollContent: { padding: 16 },
  respondedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  respondedText: { fontSize: 12, fontWeight: '600' },
  instruction: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  instructionText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
