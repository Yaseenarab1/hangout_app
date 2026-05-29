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
import { ArrowLeft, Users, CalendarDays, Share2 } from 'lucide-react-native';

const SUPABASE_URL = 'https://cruosjnuhcuewjnzhlja.supabase.co';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useHangout } from '@/features/hangouts';
import {
  useHangoutSession,
  useUpdateAvailability,
  AvailabilityGrid,
  CreateSessionSheet,
} from '@/features/availability';

const ACCENT = '#8B5CF6';

export default function WhenToMeetScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id: hangoutId, create } = useLocalSearchParams<{ id: string; create?: string }>();
  const { user } = useSession();
  const [showCreate, setShowCreate] = useState(create === '1');

  const hangout = useHangout(hangoutId ?? '');
  const session = useHangoutSession(hangoutId);

  const isHost = hangout.data?.host_id === user?.id;
  const myRole = hangout.data?.participants.find(p => p.user_id === user?.id)?.role;
  const canCreate = isHost || myRole === 'co_host';

  const s = session.data;

  // My current availability as a Set
  const mySlots = useMemo<Set<string>>(() => {
    if (!s || !user) return new Set();
    const myResp = s.responses.find(r => r.user_id === user.id);
    return new Set(myResp?.available ?? []);
  }, [s, user]);

  const update = useUpdateAvailability(s?.id ?? '', user?.id ?? '', hangoutId);

  // Debounced save — save immediately on toggle (optimistic)
  function handleToggle(slot: string) {
    if (!s) return;
    const next = new Set(mySlots);
    if (next.has(slot)) {
      next.delete(slot);
    } else {
      next.add(slot);
    }
    update.mutate([...next]);
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
        style={({ pressed }) => [
          styles.backBtn,
          { backgroundColor: theme.colors.bg.subtle, opacity: pressed ? 0.6 : 1 },
        ]}
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

      {canCreate && !s && (
        <Pressable
          onPress={() => setShowCreate(true)}
          style={[styles.createBtn, { backgroundColor: ACCENT }]}
        >
          <Text style={styles.createBtnText}>Set up</Text>
        </Pressable>
      )}
      {s && (
        <Pressable
          onPress={() => {
            const url = `${SUPABASE_URL}/functions/v1/availability-page?id=${s.id}`;
            Share.share({ message: `Fill in when you're free! ${url}`, url });
          }}
          hitSlop={10}
          style={[styles.shareBtn, { backgroundColor: theme.colors.bg.subtle }]}
        >
          <Share2 size={16} color={ACCENT} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (session.isLoading || hangout.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      </View>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!s) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
          <View style={[styles.emptyHero, { backgroundColor: ACCENT + '10' }]}>
            <CalendarDays size={42} color={ACCENT} strokeWidth={1.5} />
            <View style={[styles.heroDot, { top: 18, right: 22, width: 8, height: 8, backgroundColor: ACCENT + '40' }]} />
            <View style={[styles.heroDot, { bottom: 20, left: 26, width: 5, height: 5, backgroundColor: ACCENT + '30' }]} />
          </View>

          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            Find a time that works
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center', lineHeight: 22 }]}>
            Everyone marks when they're free on a grid. The best overlapping times light up green.
          </Text>

          {canCreate ? (
            <Pressable
              onPress={() => setShowCreate(true)}
              style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <CalendarDays size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.emptyBtnText}>Choose dates to check</Text>
            </Pressable>
          ) : (
            <View style={[styles.waitingChip, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
              <Users size={14} color={theme.colors.text.tertiary} />
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                Waiting for the host to set up dates
              </Text>
            </View>
          )}
        </Animated.View>

        <CreateSessionSheet
          visible={showCreate}
          hangoutId={hangoutId ?? ''}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      </View>
    );
  }

  // ── Grid view ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {Header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Instruction banner */}
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
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
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  waitingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  scrollContent: {
    padding: 16,
  },
  instruction: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
