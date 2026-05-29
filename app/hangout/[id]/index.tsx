import { usePollsByHangout } from '@/features/polls';
import React, { useMemo, useState } from 'react';
import { PollCard, PollFollowUpCard, AddPollSheet } from '@/features/polls';
import { usePoll} from '@/features/polls';
import { View, Text, StyleSheet, Alert, Pressable, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Settings as SettingsIcon,
  XCircle,
  CheckCircle,
  HelpCircle,
  MessageCircle,
  Images,
  Receipt,
  Route,
  UtensilsCrossed,
  Dices,
  Plus,
  ChevronRight,
} from 'lucide-react-native';
import { UnreadBadge } from '@/features/messaging';
import { usePhotosSummary } from '@/features/photos/hooks/usePhotosSummary';
import { useUserBalance } from '@/features/bills/hooks/useUserBalance';
import { formatCents } from '@/features/bills/utils/split';
import { autocompleteAddress, getPlaceDetails } from '@/features/places';
import { useSaveSearchLocation, useSearchLocation } from '@/features/places/hooks/useSearchLocation';
import { toast } from '@/stores/ui.store';
import { Image } from 'expo-image';
import { Screen } from '@/components/layout/Screen';
import {
  Button,
  Card,
  Badge,
  Skeleton,
  EmptyState,
  SectionHeader,
} from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase/client';
import {
  useHangout,
  useUpdateParticipant,
  useCancelHangout,
  ParticipantRow,
} from '@/features/hangouts';
import type { ParticipantStatus } from '@/features/hangouts';

type WebRsvp = { id: string; name: string; status: 'going' | 'maybe' | 'not_going' };

function useWebRsvps(hangoutId: string) {
  return useQuery({
    queryKey: ['hangout_web_rsvps', hangoutId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('hangout_web_rsvps')
        .select('id, name, status')
        .eq('hangout_id', hangoutId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as WebRsvp[];
    },
    staleTime: 30 * 1000,
  });
}



function PollFollowUpCardWrapper({
  pollId,
  hangoutId,
  alreadyHasFollowUp,
}: {
  pollId: string;
  hangoutId: string;
  alreadyHasFollowUp: boolean;
}): React.ReactElement | null {
  const poll = usePoll(pollId);
  if (!poll.data) return null;
  return (
    <PollFollowUpCard
      poll={poll.data}
      hangoutId={hangoutId}
      alreadyHasFollowUp={alreadyHasFollowUp}
    />
  );
}

export default function HangoutDetailScreen(): React.ReactElement {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const hangoutId = id ?? '';
  const polls = usePollsByHangout(hangoutId);
  const hangout = useHangout(hangoutId);
  const updateParticipant = useUpdateParticipant();
  const cancelHangout = useCancelHangout(hangoutId);

  const myParticipation = useMemo(() => {
    if (!hangout.data || !user) return null;
    return hangout.data.participants.find((p) => p.user_id === user.id) ?? null;
  }, [hangout.data, user]);

  const photosSummary = usePhotosSummary(hangoutId);
  const previewPhotos = photosSummary.photos;
  const myBalance = useUserBalance(hangoutId);
  const webRsvps = useWebRsvps(hangoutId);
  const searchLocation = useSearchLocation();
  const saveSearchLocation = useSaveSearchLocation();
  const [showAddPoll, setShowAddPoll] = useState(false);

  async function handleUseHangoutLocation(): Promise<void> {
    const addr = hangout.data?.primary_location_address ?? hangout.data?.primary_location_name;
    if (!addr) return;
    try {
      const predictions = await autocompleteAddress(addr);
      if (!predictions.length) {
        toast.error('Could not find this location');
        return;
      }
      const place = await getPlaceDetails(predictions[0]!.placeId);
      if (!place?.location) {
        toast.error('Could not get coordinates for this location');
        return;
      }
      const name = hangout.data?.primary_location_name ?? place.name;
      saveSearchLocation.mutate({ name, lat: place.location.lat, lng: place.location.lng });
      toast.success(`Search set to ${name}`);
    } catch {
      toast.error('Could not set location');
    }
  }

  const isHost = hangout.data?.host_id === user?.id;
  const myParticipationRole = hangout.data?.participants.find(
     (p) => p.user_id === user?.id,
  )?.role;
  const canManage = isHost || myParticipationRole === 'co_host';

  const isCancelled = hangout.data?.status === 'cancelled';

  const handleRSVP = (status: ParticipantStatus): void => {
    if (!user) return;
    updateParticipant.mutate({
      hangoutId,
      userId: user.id,
      status,
    });
  };

  const handleCancel = (): void => {
    Alert.alert(
      'Cancel hangout?',
      'Everyone invited will be notified.',
      [
        { text: 'Keep planning', style: 'cancel' },
        {
          text: 'Cancel hangout',
          style: 'destructive',
          onPress: () =>
            cancelHangout.mutate(undefined, {
              onSuccess: () => router.back(),
            }),
        },
      ],
    );
  };

  // Loading state
  if (hangout.isLoading) {
    return (
      <Screen header={{ title: '', showBack: true }} scroll>
        <View style={{ gap: 12 }}>
          <Skeleton height={32} width="80%" radius={6} />
          <Skeleton height={20} width="60%" radius={6} />
          <Skeleton height={120} radius={14} style={{ marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  if (!hangout.data) {
    return (
      <Screen header={{ title: 'Hangout', showBack: true }}>
        <EmptyState
          title="Hangout not found"
          body="This hangout may have been deleted or you may no longer be invited."
        />
      </Screen>
    );
  }

  const h = hangout.data;
  const myStatus = myParticipation?.status;
  const canUseWhenToMeet = isHost || myStatus === 'accepted' || myStatus === 'maybe';

  // "Going" list = host + explicitly accepted participants only
  const goingParticipants = [...h.participants]
    .filter(p => p.role === 'host' || p.status === 'accepted')
    .sort((a, b) => {
      if (a.role === 'host' && b.role !== 'host') return -1;
      if (b.role === 'host' && a.role !== 'host') return 1;
      return 0;
    });
  const pendingCount = h.participants.filter(
    p => p.role !== 'host' && (p.status === 'invited' || p.status === 'maybe'),
  ).length;

  // Keep for legacy uses (acceptedCount used in other places)
  const acceptedCount = h.participants.filter((p) => p.status === 'accepted').length;

  return (
    <Screen
      header={{
        title: '',
        showBack: true,
        right: canManage ? (
          <Pressable
            onPress={() => router.push(`/hangout/${hangoutId}/settings`)}
            hitSlop={12}
            accessibilityLabel="Settings"
            style={{ padding: 8 }}
          >
            <SettingsIcon size={22} color={theme.colors.text.primary} />
          </Pressable>
        ) : null,
      }}
      scroll
    >
      {/* Title + status */}
      <View style={styles.header}>
        <Text
          style={[theme.typography.h1, { color: theme.colors.text.primary }]}
        >
          {h.title}
        </Text>
        {isCancelled ? (
          <Badge label="Cancelled" variant="danger" style={{ marginTop: 8 }} />
        ) : null}
      </View>

      {/* Description */}
      {h.description ? (
        <Card padding="md" variant="subtle" style={{ marginTop: 16 }}>
          <Text
            style={[theme.typography.body, { color: theme.colors.text.primary }]}
          >
            {h.description}
          </Text>
        </Card>
      ) : null}

      {/* Quick facts */}
      <View style={styles.factsRow}>
        <Fact
          icon={<Calendar size={20} color={theme.colors.accent} />}
          label="When"
          value={h.start_time ? formatDateTime(h.start_time) : 'Not set'}
        />
        <Fact
          icon={<MapPin size={20} color={theme.colors.accent} />}
          label="Where"
          value={h.primary_location_name ?? 'Not set'}
          onPress={h.primary_location_name ? handleUseHangoutLocation : undefined}
          actionLabel={
            h.primary_location_name
              ? searchLocation.data?.name === h.primary_location_name
                ? '📍 Set'
                : 'Use for search'
              : undefined
          }
        />
        <Fact
          icon={<Users size={20} color={theme.colors.accent} />}
          label="Going"
          value={`${acceptedCount} going`}
          onPress={() => router.push(`/hangout/${hangoutId}/participants` as any)}
          actionLabel="See who →"
        />
      </View>

      {/* RSVP — for non-hosts */}
        {!isHost && myParticipation && !isCancelled ? (
        <View style={styles.rsvpSection}>
          <Text
            style={[
              theme.typography.bodyMedium,
              { color: theme.colors.text.primary, marginBottom: 8 },
            ]}
          >
            Your RSVP
          </Text>
          <View style={styles.rsvpButtons}>
            <RSVPButton
              label="Going"
              icon={<CheckCircle size={15} color={myParticipation.status === 'accepted' ? '#FFFFFF' : '#22C55E'} />}
              active={myParticipation.status === 'accepted'}
              activeColor="#22C55E"
              onPress={() => handleRSVP('accepted')}
            />
            <RSVPButton
              label="Maybe"
              icon={<HelpCircle size={15} color={myParticipation.status === 'maybe' ? '#FFFFFF' : '#F59E0B'} />}
              active={myParticipation.status === 'maybe'}
              activeColor="#F59E0B"
              onPress={() => handleRSVP('maybe')}
            />
            <RSVPButton
              label="Can't"
              icon={<XCircle size={15} color={myParticipation.status === 'declined' ? '#FFFFFF' : '#EF4444'} />}
              active={myParticipation.status === 'declined'}
              activeColor="#EF4444"
              onPress={() => handleRSVP('declined')}
            />
          </View>
        </View>
      ) : null}

      {/* ── Decisions ── */}
      {(isHost || !!myParticipation) && (
        <>
          <SectionHeader title="Decisions" />
          <Card padding="none" style={{ overflow: 'hidden' }}>
            {/* When to meet */}
            <DecisionRow
              icon={<Clock size={18} color="#22C55E" strokeWidth={1.8} />}
              iconBg="#22C55E18"
              title="When to meet"
              subtitle={canUseWhenToMeet ? 'Find a time for everyone' : 'Update RSVP to join'}
              onPress={canUseWhenToMeet && !isCancelled ? () => router.push(`/hangout/${hangoutId}/when-to-meet` as any) : undefined}
              theme={theme}
            />
            <RowDivider theme={theme} />

            {/* Restaurant / activity polls */}
            {(polls.data ?? []).map((poll, idx) => {
              const icon = poll.kind === 'activity'
                ? <Dices size={18} color="#3B82F6" strokeWidth={1.8} />
                : <UtensilsCrossed size={18} color="#F59E0B" strokeWidth={1.8} />;
              const iconBg = poll.kind === 'activity' ? '#3B82F618' : '#F59E0B18';
              const title = poll.kind === 'activity' ? 'What to do' : poll.kind === 'cuisine' ? 'Cuisine vote' : 'Where to eat';
              const subtitle = poll.phase === 'closed' ? 'Decided ✓' : poll.phase === 'voting' ? 'Voting now' : 'Suggesting options';
              return (
                <React.Fragment key={poll.id}>
                  <DecisionRow
                    icon={icon}
                    iconBg={iconBg}
                    title={title}
                    subtitle={subtitle}
                    onPress={() => {/* PollCard is on this screen below */}}
                    theme={theme}
                  />
                  {(idx < (polls.data ?? []).length - 1 || canManage) && <RowDivider theme={theme} />}
                </React.Fragment>
              );
            })}

            {/* Itinerary — host/co-host only */}
            {canManage && (
              <>
                <DecisionRow
                  icon={<Route size={18} color="#8B5CF6" strokeWidth={1.8} />}
                  iconBg="#8B5CF618"
                  title="Itinerary"
                  subtitle="Map out your day"
                  onPress={!isCancelled ? () => router.push(`/hangout/${hangoutId}/dayplan` as any) : undefined}
                  theme={theme}
                />
                <RowDivider theme={theme} />
                {/* Add a decision */}
                {!isCancelled && (
                  <Pressable
                    onPress={() => setShowAddPoll(true)}
                    style={({ pressed }) => [
                      styles.decisionAdd,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Plus size={15} color={theme.colors.accent} strokeWidth={2.5} />
                    <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>
                      Add a decision
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </Card>

          {/* Inline poll cards for voting */}
          {(polls.data ?? []).map((poll) => {
            const hasFollowUp = polls.data?.some(
              (p) =>
                p.created_at > poll.created_at &&
                ((poll.kind === 'cuisine' && p.kind === 'restaurant') ||
                  (poll.kind === 'activity' && p.kind === 'restaurant')),
            );
            return (
              <View key={poll.id} style={{ marginTop: 8 }}>
                <PollCard pollId={poll.id} canManage={canManage} />
                {poll.phase === 'closed' && canManage ? (
                  <PollFollowUpCardWrapper
                    pollId={poll.id}
                    hangoutId={hangoutId}
                    alreadyHasFollowUp={Boolean(hasFollowUp)}
                  />
                ) : null}
              </View>
            );
          })}

          <AddPollSheet
            visible={showAddPoll}
            onClose={() => setShowAddPoll(false)}
            hangoutId={hangoutId}
          />
        </>
      )}

      {/* Web RSVPs */}
      {(webRsvps.data ?? []).length > 0 && (
        <Card padding="none" style={{ overflow: 'hidden', marginTop: 16 }}>
          {(webRsvps.data ?? []).map((r, idx) => (
            <View key={r.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>🌐</Text>
                </View>
                <Text style={[theme.typography.bodyMedium, { flex: 1, color: theme.colors.text.primary }]}>
                  {r.name}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
                  {r.status === 'going' ? 'Going' : r.status === 'maybe' ? 'Maybe' : "Can't"}
                </Text>
              </View>
              {idx < (webRsvps.data ?? []).length - 1 && (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default, marginLeft: 62 }} />
              )}
            </View>
          ))}
        </Card>
      )}

      {/* ── Together pills ── */}
      <View style={{ marginTop: 12 }} />
      <SectionHeader title="Together" />
      <View style={styles.togetherRow}>
        <TogetherPill
          onPress={() => router.push(`/hangout/${hangoutId}/chat` as any)}
          theme={theme}
        >
          <MessageCircle size={17} color={theme.colors.accent} strokeWidth={1.5} />
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Chat</Text>
          <UnreadBadge hangoutId={hangoutId} />
        </TogetherPill>
        <TogetherPill
          onPress={() => router.push(`/hangout/${hangoutId}/photos` as any)}
          theme={theme}
        >
          <Images size={17} color={theme.colors.accent} strokeWidth={1.5} />
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
            {photosSummary.count > 0 ? `${photosSummary.count} Photos` : 'Photos'}
          </Text>
        </TogetherPill>
        <TogetherPill
          onPress={() => router.push(`/hangout/${hangoutId}/bills` as any)}
          theme={theme}
        >
          <Receipt size={17} color={theme.colors.accent} strokeWidth={1.5} />
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>Bills</Text>
          {myBalance.data && myBalance.data.net_cents !== 0 && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: myBalance.data.net_cents > 0 ? '#22C55E' : theme.colors.danger }}>
              {myBalance.data.net_cents > 0 ? `+${formatCents(myBalance.data.net_cents)}` : formatCents(myBalance.data.net_cents)}
            </Text>
          )}
        </TogetherPill>
      </View>

      {/* Host: cancel hangout */}
      {isHost && !isCancelled ? (
        <View style={{ marginTop: 24 }}>
          <Button
            label="Cancel hangout"
            variant="ghost"
            onPress={handleCancel}
            loading={cancelHangout.isPending}
            fullWidth
          />
        </View>
      ) : null}
    </Screen>
  );
}

function DecisionRow({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  theme,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.decisionRow,
        pressed && onPress ? { opacity: 0.7 } : undefined,
      ]}
    >
      <View style={[styles.decisionIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 1 }]}>
          {subtitle}
        </Text>
      </View>
      {onPress && <ChevronRight size={15} color={theme.colors.text.tertiary} strokeWidth={2} />}
    </Pressable>
  );
}

function RowDivider({ theme }: { theme: ReturnType<typeof useTheme> }): React.ReactElement {
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.default, marginLeft: 56 }} />
  );
}

function TogetherPill({
  children,
  onPress,
  theme,
}: {
  children: React.ReactNode;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.togetherPill,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

function Fact({
  icon,
  label,
  value,
  onPress,
  actionLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress?: () => void;
  actionLabel?: string;
}): React.ReactElement {
  const theme = useTheme();
  const inner = (
    <>
      <View style={{ marginBottom: 8 }}>{icon}</View>
      <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
        {label}
      </Text>
      <Text
        style={[
          theme.typography.bodySmallMedium,
          { color: theme.colors.text.primary, marginTop: 2 },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
      {actionLabel && (
        <Text style={[theme.typography.caption, { color: theme.colors.accent, fontWeight: '600', marginTop: 6 }]}>
          {actionLabel}
        </Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.fact,
          { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
          pressed && { opacity: 0.7 },
        ]}
      >
        {inner}
      </Pressable>
    );
  }
  return (
    <View style={[styles.fact, { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default }]}>
      {inner}
    </View>
  );
}

function RSVPButton({
  label,
  icon,
  active,
  activeColor,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rsvpStyles.btn,
        {
          backgroundColor: active ? activeColor : activeColor + '14',
          borderColor: active ? activeColor : activeColor + '45',
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon}
      <Text style={[rsvpStyles.label, { color: active ? '#FFFFFF' : activeColor }]}>
        {label}
      </Text>
      {active && <View style={rsvpStyles.dot} />}
    </Pressable>
  );
}

const rsvpStyles = StyleSheet.create({
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} • ${time}`;
}

const styles = StyleSheet.create({
  decisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  decisionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  togetherRow: {
    flexDirection: 'row',
    gap: 8,
  },
  togetherPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    paddingTop: 8,
  },
  factsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  fact: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
  },
  rsvpSection: {
    marginTop: 24,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 8,
  },
});
