import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ChevronUp, ChevronDown, X, RotateCcw } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import type { PollWithOptions } from '../types';

export type RankedVoteSheetProps = {
  poll: PollWithOptions;
  onSubmit: (rankedOptionIds: string[]) => void;
  onClear: () => void;
  isSubmitting?: boolean;
};

/**
 * UI for ranked-choice voting.
 *
 * UX: Two lists.
 *   - "Your ranking" (top): options the voter has ranked, with up/down arrows
 *     to reorder, and an X to remove from the ranking.
 *   - "Tap to rank" (bottom): unranked options. Tap to add to bottom of ranking.
 *
 * The voter doesn't have to rank everything — partial ballots are OK.
 *
 * Why this UX (no drag-and-drop)?
 *   Drag-and-drop on RN is finicky and requires extra deps. Tap-to-add with
 *   up/down arrows is simpler, more accessible, and works on every device.
 */
export function RankedVoteSheet({
  poll,
  onSubmit,
  onClear,
  isSubmitting,
}: RankedVoteSheetProps): React.ReactElement {
  const theme = useTheme();

  // Local state — initialized from poll.myRanks
  const [ranked, setRanked] = useState<string[]>(() =>
    [...poll.myRanks]
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.optionId),
  );

  // Re-sync when poll data updates externally (e.g. someone added an option)
  useEffect(() => {
    setRanked(
      [...poll.myRanks]
        .sort((a, b) => a.rank - b.rank)
        .map((r) => r.optionId),
    );
  }, [poll.myRanks.length]);

  const optionMap = new Map(poll.options.map((o) => [o.id, o]));
  const unrankedOptions = poll.options.filter((o) => !ranked.includes(o.id));

  const addToRanking = (optionId: string): void => {
    setRanked([...ranked, optionId]);
  };

  const removeFromRanking = (optionId: string): void => {
    setRanked(ranked.filter((id) => id !== optionId));
  };

  const moveUp = (idx: number): void => {
    if (idx <= 0) return;
    const next = [...ranked];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setRanked(next);
  };

  const moveDown = (idx: number): void => {
    if (idx >= ranked.length - 1) return;
    const next = [...ranked];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setRanked(next);
  };

  const hasChanges = !arraysEqual(
    ranked,
    [...poll.myRanks].sort((a, b) => a.rank - b.rank).map((r) => r.optionId),
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Your ranking */}
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.text.primary, marginBottom: 8 },
          ]}
        >
          Your ranking
        </Text>
        {ranked.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              {
                backgroundColor: theme.colors.bg.subtle,
                borderColor: theme.colors.border.default,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.bodySmall,
                { color: theme.colors.text.tertiary, textAlign: 'center' },
              ]}
            >
              Tap options below to rank them in order
            </Text>
          </View>
        ) : (
          <View style={{ gap: 6, marginBottom: 16 }}>
            {ranked.map((optId, idx) => {
              const opt = optionMap.get(optId);
              if (!opt) return null;
              const meta = (opt.metadata as { emoji?: string | null }) ?? {};
              return (
                <View
                  key={optId}
                  style={[
                    styles.rankedRow,
                    {
                      backgroundColor: theme.colors.accent + '15',
                      borderColor: theme.colors.accent,
                    },
                  ]}
                >
                  {/* Rank number */}
                  <View
                    style={[
                      styles.rankBadge,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.bodySmallMedium,
                        { color: '#FFFFFF' },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  </View>

                  {meta.emoji ? (
                    <Text style={{ fontSize: 18, marginRight: 6 }}>
                      {meta.emoji}
                    </Text>
                  ) : null}

                  <Text
                    style={[
                      theme.typography.body,
                      { color: theme.colors.text.primary, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>

                  {/* Up arrow */}
                  <Pressable
                    onPress={() => moveUp(idx)}
                    disabled={idx === 0}
                    style={({ pressed }) => [
                      styles.arrowButton,
                      { opacity: idx === 0 ? 0.3 : 1 },
                      pressed && { opacity: 0.5 },
                    ]}
                    hitSlop={6}
                  >
                    <ChevronUp size={18} color={theme.colors.text.secondary} />
                  </Pressable>

                  {/* Down arrow */}
                  <Pressable
                    onPress={() => moveDown(idx)}
                    disabled={idx === ranked.length - 1}
                    style={({ pressed }) => [
                      styles.arrowButton,
                      { opacity: idx === ranked.length - 1 ? 0.3 : 1 },
                      pressed && { opacity: 0.5 },
                    ]}
                    hitSlop={6}
                  >
                    <ChevronDown size={18} color={theme.colors.text.secondary} />
                  </Pressable>

                  {/* Remove */}
                  <Pressable
                    onPress={() => removeFromRanking(optId)}
                    style={({ pressed }) => [
                      styles.arrowButton,
                      pressed && { opacity: 0.5 },
                    ]}
                    hitSlop={6}
                  >
                    <X size={16} color={theme.colors.text.tertiary} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Unranked */}
        {unrankedOptions.length > 0 ? (
          <>
            <Text
              style={[
                theme.typography.bodyMedium,
                {
                  color: theme.colors.text.primary,
                  marginBottom: 8,
                  marginTop: 8,
                },
              ]}
            >
              Tap to rank
            </Text>
            <View style={{ gap: 6 }}>
              {unrankedOptions.map((opt) => {
                const meta = (opt.metadata as { emoji?: string | null }) ?? {};
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => addToRanking(opt.id)}
                    style={({ pressed }) => [
                      styles.unrankedRow,
                      {
                        backgroundColor: theme.colors.bg.surface,
                        borderColor: theme.colors.border.default,
                      },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {meta.emoji ? (
                      <Text style={{ fontSize: 18, marginRight: 8 }}>
                        {meta.emoji}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        theme.typography.body,
                        { color: theme.colors.text.primary, flex: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: theme.colors.text.tertiary },
                      ]}
                    >
                      Tap to add
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Submit / clear */}
      <View style={{ gap: 8, paddingTop: 12 }}>
        <Button
          label={
            poll.myRanks.length > 0 && !hasChanges
              ? 'Vote saved ✓'
              : ranked.length === 0
                ? 'Add at least one to rank'
                : `Save ranking (${ranked.length} ranked)`
          }
          onPress={() => onSubmit(ranked)}
          disabled={ranked.length === 0 || !hasChanges || isSubmitting}
          loading={isSubmitting}
          fullWidth
          size="lg"
        />
        {poll.myRanks.length > 0 ? (
          <Button
            label="Clear my ranking"
            variant="ghost"
            size="sm"
            leadingIcon={<RotateCcw size={14} color={theme.colors.text.secondary} />}
            onPress={onClear}
            fullWidth
          />
        ) : null}
      </View>
    </View>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, idx) => id === b[idx]);
}

const styles = StyleSheet.create({
  emptyBox: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  arrowButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  unrankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
