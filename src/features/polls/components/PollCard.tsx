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
  Check,
  Users,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Card, Button, Badge } from '@/components/ui';
import { PlaceDetailSheet } from '@/features/places';
import {
  usePoll,
  useCastVote,
  useUnvote,
  useCastRankedVote,
  useClearRankedVote,
  useClosePoll,
  useReopenPoll,
  useDeletePoll,
  useAddOptionsBatch,
  useRemoveOption,
} from '../hooks/usePolls';
import { RankedVoteSheet } from './RankedVoteSheet';
import { ManagePollOptionsSheet } from './ManagePollOptionsSheet';
import { SuggestOptionSheet } from './SuggestOptionSheet';
import type { PollWithOptions, PollOption } from '../types';

export type PollCardProps = {
  pollId: string;
  canManage: boolean;
  hangoutId?: string;
};

export function PollCard({
  pollId,
  canManage,
  hangoutId,
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
        <RankedVotingCard poll={p} canManage={canManage} hangoutId={hangoutId} />
      ) : (
        <SimpleVotingCard poll={p} canManage={canManage} hangoutId={hangoutId} />
      );
    case 'suggesting':
      return <SuggestingCard poll={p} />;
    case 'closed':
      return <ClosedCard poll={p} canManage={canManage} hangoutId={hangoutId} />;
  }
}

// Strips venue poll title boilerplate to get the activity term for seeding search
function venueQueryFromTitle(title: string): string {
  const prefixes = [
    'Where should we go for ',
    'Where should we play ',
    'Where should we watch ',
  ];
  for (const p of prefixes) {
    if (title.startsWith(p)) return title.slice(p.length).replace(/\?$/, '').trim();
  }
  return '';
}

// ============================================================================
// Voter count component — clearer than just a badge
// ============================================================================

function VoterCount({
  totalVotes,
  hasVoted,
}: {
  totalVotes: number;
  hasVoted: boolean;
}): React.ReactElement {
  const theme = useTheme();
  if (totalVotes === 0) {
    return (
      <View style={styles.countRow}>
        <Users size={12} color={theme.colors.text.tertiary} />
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginLeft: 4 },
          ]}
        >
          No votes yet
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.countRow}>
      <Users size={12} color={theme.colors.text.secondary} />
      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.text.secondary, marginLeft: 4 },
        ]}
      >
        {totalVotes} {totalVotes === 1 ? 'person' : 'people'} voted
      </Text>
      {hasVoted ? (
        <View
          style={[
            styles.youVotedBadge,
            { backgroundColor: theme.colors.success + '20' },
          ]}
        >
          <Check size={10} color={theme.colors.success} />
          <Text
            style={[
              theme.typography.caption,
              {
                color: theme.colors.success,
                marginLeft: 3,
                fontSize: 10,
                fontWeight: '600',
              },
            ]}
          >
            you voted
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================================
// Per-user sort helpers
// ============================================================================

function sortSimpleByMyVote<T extends PollOption & { isMyVote: boolean }>(
  options: T[],
): T[] {
  const myVote = options.filter((o) => o.isMyVote);
  const others = options.filter((o) => !o.isMyVote);
  return [...myVote, ...others];
}

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
  hangoutId,
}: {
  poll: PollWithOptions;
  canManage: boolean;
  hangoutId?: string;
}): React.ReactElement {
  const theme = useTheme();
  const castVote = useCastVote();
  const unvote = useUnvote();
  const closePoll = useClosePoll(hangoutId);
  const addBatch = useAddOptionsBatch();
  const removeOption = useRemoveOption();
  const [showManage, setShowManage] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [sheetOption, setSheetOption] = useState<{
    placeId: string;
    placeName: string;
    optionId: string;
    isMyVote: boolean;
  } | null>(null);

  const sortedOptions = useMemo(
    () => sortSimpleByMyVote(poll.options),
    [poll.options],
  );

  const hasVoted = !!poll.myVote;

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
      // toast handled
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
        </View>

        <View style={{ marginTop: 6 }}>
          <VoterCount totalVotes={poll.totalVotes} hasVoted={hasVoted} />
        </View>

        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginTop: 6 },
          ]}
        >
          Tap to vote • Tap again to undo
          {poll.options.some((o) => (o.metadata as { placeId?: string }).placeId)
            ? ' • Long-press for details'
            : ''}
        </Text>

        {poll.options.length === 0 ? (
          <View style={[styles.emptyOptions, { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.subtle }]}>
            {canManage ? (
              <>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 12 }]}>
                  No options yet — add some so everyone can vote.
                </Text>
                <Button
                  label="Add options"
                  size="md"
                  leadingIcon={<Settings2 size={14} color="#FFFFFF" />}
                  onPress={() => setShowManage(true)}
                  fullWidth
                />
              </>
            ) : (
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
                No options yet — the host is still setting this up.
              </Text>
            )}
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 6 }}>
            {sortedOptions.map((opt) => {
              const isMyVote = opt.isMyVote;
              const pct =
                poll.totalVotes > 0
                  ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                  : 0;
              const meta = (opt.metadata as { emoji?: string | null; placeId?: string | null }) ?? {};
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => handleVote(opt.id)}
                  onLongPress={
                    meta.placeId
                      ? () =>
                          setSheetOption({
                            placeId: meta.placeId!,
                            placeName: opt.label,
                            optionId: opt.id,
                            isMyVote: opt.isMyVote,
                          })
                      : undefined
                  }
                  delayLongPress={350}
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
                      {opt.voteCount}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ marginTop: 12, gap: 8 }}>
          <Button
            label="+ Add a choice"
            variant="ghost"
            size="sm"
            onPress={() => setShowSuggest(true)}
            fullWidth
          />
          {canManage && poll.options.length > 0 ? (
            <>
              <Button
                label="Manage options"
                variant="ghost"
                size="sm"
                leadingIcon={<Settings2 size={14} color={theme.colors.accent} />}
                onPress={() => setShowManage(true)}
                fullWidth
              />
              <Button
                label={poll.totalVotes === 0 ? 'Close poll (no votes yet)' : 'Close poll'}
                variant="ghost"
                size="sm"
                onPress={poll.totalVotes === 0 ? undefined : handleClose}
                loading={closePoll.isPending}
                disabled={poll.totalVotes === 0}
                fullWidth
              />
            </>
          ) : null}
        </View>
      </Card>

      <ManagePollOptionsSheet
        visible={showManage}
        onClose={() => setShowManage(false)}
        hangoutId={hangoutId}
        pollKind={poll.kind}
        existing={poll.options.map((o) => ({
          id: o.id,
          label: o.label,
          voteCount: o.voteCount,
          metadata: o.metadata,
        }))}
        onSave={handleApplyChanges}
        isSubmitting={isApplyingChanges}
        venueQuery={poll.kind === 'venue' ? venueQueryFromTitle(poll.title) : undefined}
      />

      <SuggestOptionSheet
        visible={showSuggest}
        onClose={() => setShowSuggest(false)}
        hangoutId={hangoutId}
        pollId={poll.id}
        pollKind={poll.kind}
        existing={poll.options.map((o) => ({
          id: o.id,
          label: o.label,
          voteCount: o.voteCount,
          metadata: o.metadata,
        }))}
        venueQuery={poll.kind === 'venue' ? venueQueryFromTitle(poll.title) : undefined}
      />

      <PlaceDetailSheet
        visible={sheetOption !== null}
        onClose={() => setSheetOption(null)}
        placeId={sheetOption?.placeId ?? null}
        placeName={sheetOption?.placeName}
        pollPhase="voting"
        isMyVote={sheetOption?.isMyVote}
        onVote={() => {
          if (sheetOption) {
            castVote.mutate({ pollId: poll.id, optionId: sheetOption.optionId });
          }
        }}
        onUnvote={() => unvote.mutate(poll.id)}
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
  hangoutId,
}: {
  poll: PollWithOptions;
  canManage: boolean;
  hangoutId?: string;
}): React.ReactElement {
  const theme = useTheme();
  const castRanked = useCastRankedVote();
  const clearRanked = useClearRankedVote();
  const closePoll = useClosePoll(hangoutId);
  const addBatch = useAddOptionsBatch();
  const removeOption = useRemoveOption();
  const [showVoteSheet, setShowVoteSheet] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [sheetOption, setSheetOption] = useState<{
    placeId: string;
    placeName: string;
  } | null>(null);

  const sortedOptions = useMemo(
    () => sortRankedByMyRanks(poll.options),
    [poll.options],
  );

  const myRankCount = poll.myRanks.length;
  const hasVoted = myRankCount > 0;

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

        <View style={{ marginTop: 6 }}>
          <VoterCount totalVotes={poll.totalVotes} hasVoted={hasVoted} />
        </View>

        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginTop: 6 },
          ]}
        >
          {hasVoted
            ? `Your top ${myRankCount} ranked. Tap below to edit.`
            : 'Tap below to rank your top picks.'}
        </Text>

        {poll.options.length === 0 ? (
          <View style={[styles.emptyOptions, { borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.subtle }]}>
            {canManage ? (
              <>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 12 }]}>
                  No options yet — add some so everyone can rank.
                </Text>
                <Button
                  label="Add options"
                  size="md"
                  leadingIcon={<Settings2 size={14} color="#FFFFFF" />}
                  onPress={() => setShowManage(true)}
                  fullWidth
                />
              </>
            ) : (
              <Text style={[theme.typography.bodySmall, { color: theme.colors.text.tertiary, textAlign: 'center' }]}>
                No options yet — the host is still setting this up.
              </Text>
            )}
          </View>
        ) : (
          <>
            <View style={{ marginTop: 12, gap: 4 }}>
              {sortedOptions.slice(0, 6).map((opt) => {
                const meta = (opt.metadata as { emoji?: string | null; placeId?: string | null }) ?? {};
                const myRank = opt.myRank;
                return (
                  <Pressable
                    key={opt.id}
                    onLongPress={
                      meta.placeId
                        ? () =>
                            setSheetOption({
                              placeId: meta.placeId!,
                              placeName: opt.label,
                            })
                        : undefined
                    }
                    delayLongPress={350}
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
                  </Pressable>
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
              <Button
                label="+ Add a choice"
                variant="ghost"
                size="sm"
                onPress={() => setShowSuggest(true)}
                fullWidth
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
                  label={poll.totalVotes === 0 ? 'Close poll (no votes yet)' : 'Close poll'}
                  variant="ghost"
                  size="sm"
                  onPress={poll.totalVotes === 0 ? undefined : handleClose}
                  loading={closePoll.isPending}
                  disabled={poll.totalVotes === 0}
                  fullWidth
                />
              ) : null}
            </View>
          </>
        )}
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
        hangoutId={hangoutId}
        pollKind={poll.kind}
        existing={poll.options.map((o) => ({
          id: o.id,
          label: o.label,
          voteCount: o.voteCount,
          metadata: o.metadata,
        }))}
        onSave={handleApplyChanges}
        isSubmitting={isApplyingChanges}
        venueQuery={poll.kind === 'venue' ? venueQueryFromTitle(poll.title) : undefined}
      />

      <SuggestOptionSheet
        visible={showSuggest}
        onClose={() => setShowSuggest(false)}
        hangoutId={hangoutId}
        pollId={poll.id}
        pollKind={poll.kind}
        existing={poll.options.map((o) => ({
          id: o.id,
          label: o.label,
          voteCount: o.voteCount,
          metadata: o.metadata,
        }))}
        venueQuery={poll.kind === 'venue' ? venueQueryFromTitle(poll.title) : undefined}
      />

      <PlaceDetailSheet
        visible={sheetOption !== null}
        onClose={() => setSheetOption(null)}
        placeId={sheetOption?.placeId ?? null}
        placeName={sheetOption?.placeName}
      />
    </>
  );
}

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

function ClosedCard({
  poll,
  canManage = false,
  hangoutId,
}: {
  poll: PollWithOptions;
  canManage?: boolean;
  hangoutId?: string;
}): React.ReactElement {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const reopenPollMut = useReopenPoll(hangoutId);
  const deletePollMut = useDeletePoll(hangoutId ?? '');

  const winner = poll.options.find((o) => o.id === poll.winning_option_id);
  const winnerMeta = (winner?.metadata as { emoji?: string | null; placeId?: string | null }) ?? {};

  const sortedOptions = useMemo(
    () => [...poll.options].sort((a, b) => b.voteCount - a.voteCount),
    [poll.options],
  );

  function handleDelete() {
    Alert.alert(
      'Delete poll?',
      'This will permanently remove the poll and all votes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePollMut.mutate(poll.id),
        },
      ],
    );
  }

  return (
    <>
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
        <Pressable
          onLongPress={winnerMeta.placeId ? () => setSheetOpen(true) : undefined}
          delayLongPress={350}
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
              {winner.voteCount} of {poll.totalVotes} {poll.totalVotes === 1 ? 'voter' : 'voters'}
            </Text>
          </View>
        </Pressable>
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

      {/* All results toggle */}
      {sortedOptions.length > 1 && (
        <>
          <Pressable
            onPress={() => setShowAllResults((v) => !v)}
            style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.accent, fontWeight: '600' }]}>
              {showAllResults ? 'Hide results' : `See all ${sortedOptions.length} results`}
            </Text>
          </Pressable>
          {showAllResults && (
            <View style={{ marginTop: 8, gap: 4 }}>
              {sortedOptions.map((opt, idx) => {
                const isWinner = opt.id === poll.winning_option_id;
                const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                const meta = (opt.metadata as { emoji?: string | null }) ?? {};
                return (
                  <View
                    key={opt.id}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: isWinner
                          ? theme.colors.accent + '15'
                          : theme.colors.bg.subtle,
                        borderColor: isWinner
                          ? theme.colors.accent
                          : theme.colors.border.default,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: isWinner
                            ? theme.colors.accent + '30'
                            : theme.colors.border.default + '60',
                        },
                      ]}
                    />
                    <View style={styles.optionContent}>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, width: 18 }]}>
                        {idx + 1}
                      </Text>
                      {meta.emoji ? (
                        <Text style={{ fontSize: 14, marginRight: 6 }}>{meta.emoji}</Text>
                      ) : null}
                      <Text
                        style={[
                          theme.typography.bodySmall,
                          {
                            color: theme.colors.text.primary,
                            flex: 1,
                            fontWeight: isWinner ? '600' : '400',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, minWidth: 50, textAlign: 'right' }]}>
                        {opt.voteCount} vote{opt.voteCount !== 1 ? 's' : ''} · {pct}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* Host management buttons */}
      {canManage && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Button
            label="Reopen for voting"
            variant="ghost"
            size="sm"
            onPress={() => reopenPollMut.mutate(poll.id)}
            loading={reopenPollMut.isPending}
            fullWidth
          />
          <Button
            label="Delete poll"
            variant="ghost"
            size="sm"
            onPress={handleDelete}
            loading={deletePollMut.isPending}
            fullWidth
          />
        </View>
      )}
    </Card>

    {winnerMeta.placeId ? (
      <PlaceDetailSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        placeId={winnerMeta.placeId}
        placeName={winner!.label}
        pollPhase="closed"
      />
    ) : null}
    </>
  );
}

function closePollWithConfirm(
  poll: PollWithOptions,
  onConfirm: () => void,
): void {
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
  countRow: { flexDirection: 'row', alignItems: 'center' },
  youVotedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
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
  emptyOptions: {
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
});
