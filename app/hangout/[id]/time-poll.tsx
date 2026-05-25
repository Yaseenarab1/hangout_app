import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, EmptyState, SectionHeader } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useHangout } from '@/features/hangouts';
import {
  useTimePoll,
  useVoteOnSlot,
  useCloseTimePoll,
  TimePollSlotRow,
  CreateTimePollSheet,
} from '@/features/timepolls';
import type { SlotResponse } from '@/features/timepolls';

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TimePollScreen(): React.ReactElement {
  const theme = useTheme();
  const { id: hangoutId } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [showCreate, setShowCreate] = useState(false);

  const hangout = useHangout(hangoutId ?? '');
  const poll = useTimePoll(hangoutId);
  const vote = useVoteOnSlot(hangoutId ?? '');
  const closePoll = useCloseTimePoll(hangoutId ?? '');

  const myParticipation = useMemo(() => {
    if (!hangout.data || !user) return null;
    return hangout.data.participants.find((p) => p.user_id === user.id) ?? null;
  }, [hangout.data, user]);

  const isHost =
    myParticipation?.role === 'host' || myParticipation?.role === 'co_host';

  if (poll.isLoading) {
    return (
      <Screen header={{ title: 'Find a time', showBack: true }}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!poll.data) {
    return (
      <Screen header={{ title: 'Find a time', showBack: true }}>
        <EmptyState
          icon={<Clock size={42} color={theme.colors.text.tertiary} strokeWidth={1} />}
          title="No poll yet"
          body={
            isHost
              ? 'Propose a few times and let your group vote on what works.'
              : 'The host will create a time poll soon.'
          }
          action={
            isHost ? (
              <Button
                label="Create poll"
                variant="primary"
                onPress={() => setShowCreate(true)}
              />
            ) : undefined
          }
        />
        {isHost && (
          <CreateTimePollSheet
            hangoutId={hangoutId ?? ''}
            visible={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => setShowCreate(false)}
          />
        )}
      </Screen>
    );
  }

  const p = poll.data;
  const isClosed = p.closed_at !== null;

  const totalVoters = useMemo(() => {
    const ids = new Set<string>();
    p.slots.forEach((s) => s.responses.forEach((r) => ids.add(r.user_id)));
    return ids.size;
  }, [p.slots]);

  function handleVote(slotId: string, response: SlotResponse) {
    if (!user) return;
    vote.mutate({ slotId, response, userId: user.id });
  }

  function handleClosePoll() {
    const best = [...p.slots].sort((a, b) => b.yesCount - a.yesCount)[0];
    closePoll.mutate({ pollId: p.id, winningSlotId: best?.id });
  }

  function handlePickWinner(slotId: string) {
    closePoll.mutate({ pollId: p.id, winningSlotId: slotId });
  }

  return (
    <Screen
      header={{
        title: 'Find a time',
        showBack: true,
        right:
          isHost && !isClosed ? (
            <Button
              label="Close"
              variant="ghost"
              size="sm"
              loading={closePoll.isPending}
              onPress={handleClosePoll}
            />
          ) : undefined,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Status banner */}
        <View
          style={[
            styles.banner,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
            {isClosed
              ? `Poll closed · ${totalVoters} ${totalVoters === 1 ? 'person' : 'people'} voted`
              : `Voting open · deadline ${formatDeadline(p.vote_deadline)}`}
          </Text>
        </View>

        <SectionHeader
          title={`${p.slots.length} option${p.slots.length === 1 ? '' : 's'}`}
        />

        {p.slots.map((slot) => (
          <View key={slot.id}>
            <TimePollSlotRow
              slot={slot}
              isReadOnly={isClosed}
              isWinner={isClosed && slot.id === p.winning_slot_id}
              onVote={(r) => handleVote(slot.id, r)}
            />
            {isHost && !isClosed && (
              <Pressable
                onPress={() => handlePickWinner(slot.id)}
                style={styles.pickWinner}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
                  Pick as winner →
                </Text>
              </Pressable>
            )}
          </View>
        ))}

        {/* Winner panel */}
        {isClosed && p.winning_slot_id && (
          <View style={{ marginTop: 8 }}>
            <SectionHeader title="Best time" />
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
              {p.slots.find((s) => s.id === p.winning_slot_id)
                ? `${new Date(p.slots.find((s) => s.id === p.winning_slot_id)!.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} wins with ${p.slots.find((s) => s.id === p.winning_slot_id)!.yesCount} yes vote${p.slots.find((s) => s.id === p.winning_slot_id)!.yesCount === 1 ? '' : 's'}.`
                : ''}
            </Text>
          </View>
        )}

        {isClosed && !p.winning_slot_id && (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
              No winner selected.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  banner: {
    marginHorizontal: 0,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pickWinner: {
    alignSelf: 'flex-end',
    paddingRight: 4,
    marginTop: -4,
    marginBottom: 8,
  },
});
