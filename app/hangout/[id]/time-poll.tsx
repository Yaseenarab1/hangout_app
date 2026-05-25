import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Clock, Users, Trophy, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useHangout } from '@/features/hangouts';
import {
  useTimePoll,
  useVoteOnSlot,
  useCloseTimePoll,
  SlotCard,
  CreateTimePollSheet,
} from '@/features/timepolls';
import type { SlotResponse } from '@/features/timepolls';

const ACCENT = '#8B5CF6';
const GREEN  = '#22C55E';

function FabCreate({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animStyle, styles.fabWrap]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.9, { damping: 12, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 300 }); }}
        style={styles.fab}
        accessibilityLabel="Create poll"
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}

export default function TimePollScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id: hangoutId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [showCreate, setShowCreate] = useState(false);
  const [closing, setClosing] = useState(false);

  const hangout = useHangout(hangoutId ?? '');
  const poll = useTimePoll(hangoutId);
  const vote = useVoteOnSlot(hangoutId ?? '');
  const closePoll = useCloseTimePoll(hangoutId ?? '');

  const myParticipation = useMemo(() => {
    if (!hangout.data || !user) return null;
    return hangout.data.participants.find((p) => p.user_id === user.id) ?? null;
  }, [hangout.data, user]);

  const isHost = myParticipation?.role === 'host' || myParticipation?.role === 'co_host';

  const p = poll.data;
  const isClosed = p ? p.closed_at !== null : false;

  const totalVoters = useMemo(() => {
    if (!p) return 0;
    const ids = new Set<string>();
    p.slots.forEach((s) => s.responses.forEach((r) => ids.add(r.user_id)));
    return ids.size;
  }, [p]);

  const topSlotId = useMemo(() => {
    if (!p || isClosed) return null;
    if (p.slots.length === 0) return null;
    return [...p.slots].sort((a, b) => b.yesCount - a.yesCount)[0]?.id ?? null;
  }, [p, isClosed]);

  function handleVote(slotId: string, response: SlotResponse) {
    if (!user) return;
    vote.mutate({ slotId, response, userId: user.id });
  }

  function handleClosePoll() {
    if (!p) return;
    const best = [...p.slots].sort((a, b) => b.yesCount - a.yesCount)[0];
    setClosing(true);
    closePoll.mutate(
      { pollId: p.id, winningSlotId: best?.id },
      { onSettled: () => setClosing(false) },
    );
  }

  function handlePickWinner(slotId: string) {
    if (!p) return;
    closePoll.mutate({ pollId: p.id, winningSlotId: slotId });
  }

  // ── Header ──────────────────────────────────────────────────────────────────
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
          Find a time
        </Text>
        {p && (
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 1 }]}>
            {isClosed
              ? `Decided · ${totalVoters} voted`
              : `${totalVoters} ${totalVoters === 1 ? 'person' : 'people'} voted`}
          </Text>
        )}
      </View>

      {isHost && p && !isClosed && (
        <Pressable
          onPress={handleClosePoll}
          disabled={closing}
          style={({ pressed }) => [
            styles.closeBtn,
            { backgroundColor: ACCENT + '15', opacity: pressed || closing ? 0.6 : 1 },
          ]}
        >
          <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700' }}>
            {closing ? 'Closing…' : 'Close poll'}
          </Text>
        </Pressable>
      )}
    </View>
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (poll.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      </View>
    );
  }

  // ── Empty state (no poll yet) ─────────────────────────────────────────────
  if (!p) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
          <View style={[styles.emptyHero, { backgroundColor: ACCENT + '10' }]}>
            <Clock size={40} color={ACCENT} strokeWidth={1.5} />
            <View style={[styles.heroDot, { top: 16, right: 22, width: 8, height: 8, backgroundColor: ACCENT + '40' }]} />
            <View style={[styles.heroDot, { bottom: 18, left: 26, width: 5, height: 5, backgroundColor: ACCENT + '30' }]} />
            <View style={[styles.heroDot, { top: 30, left: 18, width: 6, height: 6, backgroundColor: ACCENT + '25' }]} />
          </View>

          <Text style={[theme.typography.h2, { color: theme.colors.text.primary, marginTop: 24, fontWeight: '800', letterSpacing: -0.5 }]}>
            Find the best time
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 8, textAlign: 'center', lineHeight: 22 }]}>
            {isHost
              ? 'Propose a few options and let your group vote on what works for everyone.'
              : 'The host will set up a time poll soon.'}
          </Text>

          {isHost && (
            <Pressable
              onPress={() => setShowCreate(true)}
              style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Clock size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.emptyBtnText}>Create poll</Text>
            </Pressable>
          )}
        </Animated.View>

        {isHost && (
          <CreateTimePollSheet
            hangoutId={hangoutId ?? ''}
            visible={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => setShowCreate(false)}
          />
        )}
      </View>
    );
  }

  // ── Closed banner ────────────────────────────────────────────────────────────
  const winnerSlot = p.slots.find((s) => s.id === p.winning_slot_id);

  // ── Main poll view ───────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {Header}

      {/* Status banner */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[
          styles.statusBanner,
          {
            backgroundColor: isClosed ? GREEN + '10' : ACCENT + '0D',
            borderColor: isClosed ? GREEN + '40' : ACCENT + '30',
          },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: isClosed ? GREEN : ACCENT }]} />
        <Users size={13} color={isClosed ? GREEN : ACCENT} strokeWidth={2.5} />
        <Text style={[styles.statusText, { color: isClosed ? GREEN : ACCENT }]}>
          {isClosed
            ? `Poll closed · winner decided`
            : `Voting open · ${p.slots.length} option${p.slots.length === 1 ? '' : 's'}`}
        </Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + (isHost && isClosed && winnerSlot ? 120 : 40),
        }}
      >
        {p.slots.map((slot, index) => (
          <View key={slot.id}>
            <SlotCard
              slot={slot}
              index={index}
              isReadOnly={isClosed}
              isWinner={isClosed && slot.id === p.winning_slot_id}
              isTop={!isClosed && slot.id === topSlotId && totalVoters > 0}
              onVote={(r) => handleVote(slot.id, r)}
            />
            {isHost && !isClosed && (
              <Pressable
                onPress={() => handlePickWinner(slot.id)}
                style={({ pressed }) => [styles.pickWinner, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Trophy size={11} color={ACCENT} strokeWidth={2.5} />
                <Text style={[styles.pickWinnerText, { color: ACCENT }]}>
                  Pick as winner
                </Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      {/* "Set as hangout time" sticky footer — host, closed, winner exists */}
      {isHost && isClosed && winnerSlot && (
        <View
          style={[
            styles.stickyFooter,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: theme.colors.bg.canvas,
              borderTopColor: theme.colors.border.default,
            },
          ]}
        >
          <View style={styles.footerInner}>
            <View>
              <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                Winner
              </Text>
              <Text style={[theme.typography.bodyMedium, { color: GREEN, fontWeight: '700' }]}>
                {new Date(winnerSlot.starts_at).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <Button
              label="Set as hangout time"
              variant="primary"
              size="sm"
              onPress={() => {
                // navigate to hangout settings to update start_time
                router.push(`/hangout/${hangoutId}/settings`);
              }}
            />
          </View>
        </View>
      )}

      {/* FAB for host with no poll — shouldn't reach here but safety */}
      {isHost && (
        <CreateTimePollSheet
          hangoutId={hangoutId ?? ''}
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickWinner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginRight: 20,
    marginTop: -6,
    marginBottom: 10,
  },
  pickWinnerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
    bottom: 40,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
});
