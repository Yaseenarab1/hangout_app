import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import {
  Sparkles,
  Vote,
  Trophy,
  Settings2,
  X,
  ListOrdered,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Card, Button, Badge } from '@/components/ui';
import {
  usePoll,
  useCastVote,
  useUnvote,
  useCastRankedVote,
  useClearRankedVote,
  useClosePoll,
  useAddOptionsBatch,
  useRemoveOption,
} from '../hooks/usePolls';
import { RankedVoteSheet } from './RankedVoteSheet';
import { ManagePollOptionsSheet } from './ManagePollOptionsSheet';
import type { PollWithOptions, PollOption } from '../types';

export type PollCardProps = {
  pollId: string;
  canManage: boolean;
};

export function PollCard({
  pollId,
  canManage,
}: PollCardProps): React.ReactElement | null {
  const theme = useTheme();
  const poll = usePoll(pollId);

  if (!poll.data) {
    return (
      <Card padding="md" style={{ marginTop: 12 }}>
        <Text
          style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary }]}
        >
          Loading poll…
        </Text>
      </Card>
    );
  }

  const p = poll.data;
  switch (p.phase) {
    case 'voting':
      return p.voting_method === 'ranked' ? (
        <RankedVotingCard poll={p} canManage={canManage} />
      ) : (
        <SimpleVotingCard poll={p} canManage={canManage} />
      );
    case 'suggesting':
      return <SuggestingCard poll={p} />;
    case 'closed':
      return <ClosedCard poll={p} />;
  }
}

// ============================================================================
// Per-user sort helpers
// ============================================================================

/**
 * For SIMPLE voting: float the user's voted option to the top.
 * Other options stay in their original creation order.
 */
function sortSimpleByMyVote<T extends PollOption & { isMyVote: boolean }>(
  options: T[],
): T[] {
  const myVote = options.filter((o) => o.isMyVote);
  const others = options.filter((o) => !o.isMyVote);
  return [...myVote, ...others];
}

/**
 * For RANKED voting: my ranked options first (in rank order: 1, 2, 3, ...),
 * unranked options after in creation order.
 */
function sortRankedByMyRanks<
  T extends PollOption & { myRank: number | null },
>(options: T[]): T[] {
  const ranked = options
    .filter((o) => o.myRank !== null)
    .sort((a, b) => (a.myRank as number) - (b.myRank as number));
  const unranked = options.filter((o) => o.myRank === null);
  return [...ranked, ...unranked];
}

// ============================================================================
// Simple voting card
// ============================================================================

function SimpleVotingCard({
  poll,
  canManage,
}: {
  poll: PollWithOptions;
  canManage: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const castVote = useCastVote();
  const unvote = useUnvote();
  const closePoll = useClosePoll();
  const addBatch = useAddOptionsBatch();
  const removeOption = useRemoveOption();
  const [showManage, setShowManage] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);

  // Sort by user's vote — their pick floats to top
  const sortedOptions = useMemo(
    () => sortSimpleByMyVote(poll.options),
    [poll.options],
  );

  const handleVote = (optionId: string): void => {
    if (poll.myVote?.option_id === optionId) {
      unvote.mutate(poll.id);
    } else {
      castVote.mutate({ pollId: poll.id, optionId });
    }
  };

  const handleClose = (): void => {
    closePollWithConfirm(poll, () => closePoll.mutate({ pollId: poll.id }));
  };

  const handleApplyChanges = async (changes: {
    removeOptionIds: string[];
    addOptions: Array<{ label: string; metadata?: Record<string, unknown> }>;
  }): Promise<void> => {
    setIsApplyingChanges(true);
    try {
      const optionsWithVotes = changes.removeOptionIds.filter(
        (id) => (poll.options.find((o) => o.id === id)?.voteCount ?? 0) > 0,
      );
      if (optionsWithVotes.length > 0) {
        const lostVotes = optionsWithVotes.reduce(
          (sum, id) =>
            sum + (poll.options.find((o) => o.id === id)?.voteCount ?? 0),
          0,
        );
        const ok = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Remove voted options?',
            `${lostVotes} ${lostVotes === 1 ? 'vote' : 'votes'} will be lost.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ],
          );
        });
        if (!ok) {
          setIsApplyingChanges(false);
          return;
        }
      }
      for (const id of changes.removeOptionIds) {
        await new Promise<void>((resolve, reject) => {
          removeOption.mutate(
            { pollId: poll.id, optionId: id },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          );
        });
      }
      if (changes.addOptions.length > 0) {
        await new Promise<void>((resolve, reject) => {
          addBatch.mutate(
            { pollId: poll.id, options: changes.addOptions },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          );
        });
      }
      setShowManage(false);
    } catch (_e) {
      // toast handled by mutation
    } finally {
      setIsApplyingChanges(false);
    }
  };

  return (
    <>
      <Card padding="md" style={{ marginTop: 12 }}>
        <View style={styles.headerRow}>
          <Vote size={18} color={theme.colors.accent} />
          <Text
            style={[
              theme.typography.bodyMedium,
              { color: theme.colors.text.primary, marginLeft: 8, flex: 1 },
            ]}
          >
            {poll.title}
          </Text>
          <Badge
            label={`${poll.totalVotes} ${poll.totalVotes === 1 ? 'vote' : 'votes'}`}
            variant="default"
          />
        </View>

        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginTop: 4 },
          ]}
        >
          Tap to vote • Tap again to undo
        </Text>

        <View style={{ marginTop: 12, gap: 6 }}>
          {sortedOptions.map((opt) => {
            const isMyVote = opt.isMyVote;
            const pct =
              poll.totalVotes > 0
                ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                : 0;
            const meta = (opt.metadata as { emoji?: string | null }) ?? {};
            return (
              <Pressable
                key={opt.id}
                onPress={() => handleVote(opt.id)}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    backgroundColor: isMyVote
                      ? theme.colors.accent + '15'
                      : theme.colors.bg.subtle,
                    borderColor: isMyVote
                      ? theme.colors.accent
                      : theme.colors.border.default,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: isMyVote
                        ? theme.colors.accent + '25'
                        : theme.colors.border.default + '60',
                    },
                  ]}
                />
                <View style={styles.optionContent}>
                  {isMyVote ? (
                    <View
                      style={[
                        styles.myVoteBadge,
                        { backgroundColor: theme.colors.accent },
                      ]}
                    >
                      <Text
                        style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}
                      >
                        YOUR PICK
                      </Text>
                    </View>
                  ) : null}
                  {meta.emoji ? (
                    <Text style={{ fontSize: 18, marginRight: 8 }}>{meta.emoji}</Text>
                  ) : null}
                  <Text
                    style={[
                      theme.typography.body,
                      {
                        color: theme.colors.text.primary,
                        flex: 1,
                        fontWeight: isMyVote ? '600' : '400',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      {
                        color: theme.colors.text.secondary,
                        marginLeft: 8,
                        minWidth: 40,
                        textAlign: 'right',
                      },
                    ]}
                  >
                    {opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {canManage ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Button
              label="Manage options"
              variant="ghost"
              size="sm"
              leadingIcon={<Settings2 size={14} color={theme.colors.accent} />}
              onPress={() => setShowManage(true)}
              fullWidth
            />
            <Button
              label="Close poll"
              variant="ghost"
              size="sm"
              onPress={handleClose}
              loading={closePoll.isPending}
              fullWidth
            />
          </View>
        ) : null}
      </Card>

      <ManagePollOptionsSheet
        visible={showManage}
        onClose={() => setShowManage(false)}
        pollKind={poll.kind}
        existing={poll.options.map((o) => ({
          id: o.id,
          label: o.label,
          voteCount: o.voteCount,
          metadata: o.metadata,
        }))}
        onSave={handleApplyChanges}
        isSubmitting={isApplyingChanges}
      />
    </>
  );
}

// ============================================================================
// Ranked voting card
// ============================================================================

function RankedVotingCard({
  poll,
  canManage,
}: {
  poll: PollWithOptions;
  canManage: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const castRanked = useCastRankedVote();
  const clearRanked = useClearRankedVote();
  const closePoll = useClosePoll();
  const addBatch = useAddOptionsBatch();
  const removeOption = useRemoveOption();
  const [showVoteSheet, setShowVoteSheet] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);

  // Sort by user's ranks — ranked first (in rank order), unranked after
  const sortedOptions = useMemo(
    () => sortRankedByMyRanks(poll.options),
    [poll.options],
  );

  const myRankCount = poll.myRanks.length;

  const handleClose = (): void => {
    closePollWithConfirm(poll, () => closePoll.mutate({ pollId: poll.id }));
  };

  const handleApplyChanges = async (changes: {
    removeOptionIds: string[];
    addOptions: Array<{ label: string; metadata?: Record<string, unknown> }>;
  }): Promise<void> => {
    setIsApplyingChanges(true);
    try {
      const optionsWithVotes = changes.removeOptionIds.filter(
        (id) => (poll.options.find((o) => o.id === id)?.voteCount ?? 0) > 0,
      );
      if (optionsWithVotes.length > 0) {
        const ok = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Remove ranked options?',
            "Some of these options have rankings. Removing them will affect voters' ballots.",
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ],
          );
        });
        if (!ok) {
          setIsApplyingChanges(false);
          return;
        }
      }
      for (const id of changes.removeOptionIds) {
        await new Promise<void>((resolve, reject) => {
          removeOption.mutate(
            { pollId: poll.id, optionId: id },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          );
        });
      }
      if (changes.addOptions.length > 0) {
        await new Promise<void>((resolve, reject) => {
          addBatch.mutate(
            { pollId: poll.id, options: changes.addOptions },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          );
        });
      }
      setShowManage(false);
    } catch (_e) {
      // toast handled
    } finally {
      setIsApplyingChanges(false);
    }
  };

  return (
    <>
      <Card padding="md" style={{ marginTop: 12 }}>
        <View style={styles.headerRow}>
          <ListOrdered size={18} color={theme.colors.accent} />
          <Text
            style={[
              theme.typography.bodyMedium,
              { color: theme.colors.text.primary, marginLeft: 8, flex: 1 },
            ]}
          >
            {poll.title}
          </Text>
          <Badge label="Ranked" variant="default" />
        </View>

        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginTop: 4 },
          ]}
        >
          {myRankCount === 0
            ? 'Tap below to rank your top picks.'
            : `Your top ${myRankCount} ranked. Tap below to edit.`}
        </Text>

        <View style={{ marginTop: 12, gap: 4 }}>
          {sortedOptions.slice(0, 6).map((opt) => {
            const meta = (opt.metadata as { emoji?: string | null }) ?? {};
            const myRank = opt.myRank;
            return (
              <View
                key={opt.id}
                style={[
                  styles.previewRow,
                  {
                    backgroundColor:
                      myRank !== null
                        ? theme.colors.accent + '15'
                        : theme.colors.bg.subtle,
                    borderColor:
                      myRank !== null
                        ? theme.colors.accent
                        : theme.colors.border.default,
                  },
                ]}
              >
                {myRank !== null ? (
                  <View
                    style={[
                      styles.miniRankBadge,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  >
                    <Text
                      style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}
                    >
                      {myRank}
                    </Text>
                  </View>
                ) : null}
                {meta.emoji ? (
                  <Text style={{ fontSize: 14, marginRight: 6 }}>{meta.emoji}</Text>
                ) : null}
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {
                      color: theme.colors.text.primary,
                      flex: 1,
                      fontWeight: myRank !== null ? '600' : '400',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </View>
            );
          })}
          {sortedOptions.length > 6 ? (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.tertiary, paddingLeft: 8 },
              ]}
            >
              + {sortedOptions.length - 6} more
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: 12, gap: 8 }}>
          <Button
            label={
              myRankCount === 0
                ? 'Rank your picks'
                : `Edit your ranking (${myRankCount} ranked)`
            }
            onPress={() => setShowVoteSheet(true)}
            fullWidth
            size="md"
            trailingIcon={<ChevronRight size={16} color="#FFFFFF" />}
          />
          {canManage ? (
            <Button
              label="Manage options"
              variant="ghost"
              size="sm"
              leadingIcon={<Settings2 size={14} color={theme.colors.accent} />}
              onPress={() => setShowManage(true)}
              fullWidth
            />
          ) : null}
          {canManage ? (
            <Button
              label="Close poll"
              variant="ghost"
              size="sm"
              onPress={handleClose}
              loading={closePoll.isPending}
              fullWidth
            />
          ) : null}
        </View>
      </Card>

      <Modal
        visible={showVoteSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVoteSheet(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.bg.canvas,
            paddingHorizontal: 16,
            paddingTop: 12,
          }}
        >
          <View style={styles.sheetHeader}>
            <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
              {poll.title}
            </Text>
            <Pressable onPress={() => setShowVoteSheet(false)} hitSlop={8}>
              <X size={22} color={theme.colors.text.secondary} />
            </Pressable>
          </View>
          <RankedVoteSheet
            poll={poll}
            onSubmit={(rankedOptionIds) => {
              castRanked.mutate(
                { pollId: poll.id, rankedOptionIds },
                { onSuccess: () => setShowVoteSheet(false) },
              );
            }}
            onClear={() => {
              clearRanked.mutate(poll.id);
              setShowVoteSheet(false);
            }}
            isSubmitting={castRanked.isPending}
          />
        </View>
      </Modal>

      <ManagePollOptionsSheet
        visible={showManage}
        onClose={() => setShowManage(false)}
        pollKind={poll.kind}
        existing={poll.options.map((o) => ({
          id: o.id,
          label: o.label,
          voteCount: o.voteCount,
          metadata: o.metadata,
        }))}
        onSave={handleApplyChanges}
        isSubmitting={isApplyingChanges}
      />
    </>
  );
}

// ============================================================================
// Suggesting + Closed
// ============================================================================

function SuggestingCard({ poll }: { poll: PollWithOptions }): React.ReactElement {
  const theme = useTheme();
  return (
    <Card padding="md" style={{ marginTop: 12 }}>
      <View style={styles.headerRow}>
        <Sparkles size={18} color={theme.colors.warning} />
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.text.primary, marginLeft: 8, flex: 1 },
          ]}
        >
          {poll.title}
        </Text>
        <Badge label="Suggesting" variant="warning" />
      </View>
      <Text
        style={[
          theme.typography.bodySmall,
          { color: theme.colors.text.secondary, marginTop: 8 },
        ]}
      >
        {poll.options.length === 0
          ? 'Waiting for suggestions…'
          : `${poll.options.length} ${poll.options.length === 1 ? 'idea' : 'ideas'} so far`}
      </Text>
    </Card>
  );
}

function ClosedCard({ poll }: { poll: PollWithOptions }): React.ReactElement {
  const theme = useTheme();
  const winner = poll.options.find((o) => o.id === poll.winning_option_id);
  const winnerMeta = (winner?.metadata as { emoji?: string | null }) ?? {};

  return (
    <Card padding="md" style={{ marginTop: 12 }}>
      <View style={styles.headerRow}>
        <Trophy size={18} color={theme.colors.warning} />
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.text.primary, marginLeft: 8, flex: 1 },
          ]}
        >
          {poll.title}
        </Text>
        {poll.voting_method === 'ranked' ? (
          <Badge label="Ranked" variant="default" />
        ) : null}
      </View>

      {winner ? (
        <View
          style={[
            styles.winnerRow,
            {
              backgroundColor: theme.colors.accent + '15',
              borderColor: theme.colors.accent,
            },
          ]}
        >
          {winnerMeta.emoji ? (
            <Text style={{ fontSize: 28, marginRight: 12 }}>{winnerMeta.emoji}</Text>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.accent, fontWeight: '600' },
              ]}
            >
              WINNER
            </Text>
            <Text
              style={[
                theme.typography.h3,
                { color: theme.colors.text.primary, marginTop: 2 },
              ]}
            >
              {winner.label}
            </Text>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.tertiary, marginTop: 2 },
              ]}
            >
              {poll.totalVotes} {poll.totalVotes === 1 ? 'voter' : 'voters'}
            </Text>
          </View>
        </View>
      ) : (
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary, marginTop: 12 },
          ]}
        >
          Closed with no winner picked.
        </Text>
      )}
    </Card>
  );
}

function closePollWithConfirm(
  poll: PollWithOptions,
  onConfirm: () => void,
): void {
  if (poll.totalVotes === 0) {
    Alert.alert(
      'Close with no votes?',
      "No one's voted yet. You can pick a winner manually after closing.",
      [
        { text: 'Keep open', style: 'cancel' },
        { text: 'Close anyway', style: 'destructive', onPress: onConfirm },
      ],
    );
    return;
  }
  Alert.alert(
    'Close poll?',
    poll.voting_method === 'ranked'
      ? "Voting will end and we'll calculate the winner via instant runoff."
      : 'Voting will end and the highest-scoring option wins.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', onPress: onConfirm },
    ],
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  optionRow: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  myVoteBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniRankBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});
