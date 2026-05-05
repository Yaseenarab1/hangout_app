import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui';
import type { Poll, PollOption } from '../types';

export type PollFollowUpCardProps = {
  poll: Poll & { options: PollOption[] };
  hangoutId: string;
  alreadyHasFollowUp: boolean;
};

/**
 * After an activity OR cuisine poll closes, show host a "Now pick a place" card.
 *
 * - Cuisine winner → routes to follow-up restaurant picker pre-filtered by cuisine
 * - Activity winner with catalog placesQuery → uses that query for Places search
 * - Activity winner WITHOUT catalog placesQuery (custom activity) → uses the
 *   winner's label as the search query directly. So "rooftop bar" → searches
 *   Places for "rooftop bar".
 *
 * This way, the follow-up flow ALWAYS works, regardless of whether the winner
 * came from the catalog or was a custom user-added activity.
 */
export function PollFollowUpCard({
  poll,
  hangoutId,
  alreadyHasFollowUp,
}: PollFollowUpCardProps): React.ReactElement | null {
  if (alreadyHasFollowUp) return null;
  if (poll.phase !== 'closed' || !poll.winning_option_id) return null;

  const winner = poll.options.find((o) => o.id === poll.winning_option_id);
  if (!winner) return null;

  if (poll.kind === 'cuisine') {
    const meta = (winner.metadata as { emoji?: string | null }) ?? {};
    return (
      <FollowUpCardLayout
        emoji={meta.emoji ?? '🍽️'}
        title="Now pick a restaurant!"
        body={`${winner.label} won. Want to vote on specific places?`}
        ctaLabel="Pick restaurants"
        onPress={() => {
          router.push({
            pathname: '/hangout/[id]/follow-up-restaurant',
            params: { id: hangoutId, cuisine: winner.label },
          });
        }}
      />
    );
  }

  if (poll.kind === 'activity') {
    const meta = (winner.metadata as {
      emoji?: string | null;
      catalogId?: string | null;
    }) ?? {};
    // Try catalog mapping first, then fall back to the winner label
    const placesQuery =
      lookupPlacesQuery(meta.catalogId) ?? winner.label;
    return (
      <FollowUpCardLayout
        emoji={meta.emoji ?? '📍'}
        title="Now pick where to go!"
        body={`${winner.label} won. Want to vote on specific places?`}
        ctaLabel="Pick venues"
        onPress={() => {
          router.push({
            pathname: '/hangout/[id]/follow-up-venue',
            params: {
              id: hangoutId,
              activity: winner.label,
              query: placesQuery,
            },
          });
        }}
      />
    );
  }

  return null;
}

function FollowUpCardLayout({
  emoji,
  title,
  body,
  ctaLabel,
  onPress,
}: {
  emoji: string;
  title: string;
  body: string;
  ctaLabel: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Card padding="md" style={{ marginTop: 12 }}>
      <View style={styles.row}>
        <View
          style={[styles.emojiBox, { backgroundColor: theme.colors.accent + '15' }]}
        >
          <Text style={{ fontSize: 28 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
          >
            {title}
          </Text>
          <Text
            style={[
              theme.typography.bodySmall,
              { color: theme.colors.text.secondary, marginTop: 2 },
            ]}
          >
            {body}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.colors.accent },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Sparkles size={16} color="#FFFFFF" />
        <Text
          style={[theme.typography.bodyMedium, { color: '#FFFFFF', marginLeft: 8 }]}
        >
          {ctaLabel}
        </Text>
        <ChevronRight size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
      </Pressable>
    </Card>
  );
}

function lookupPlacesQuery(catalogId: string | null | undefined): string | null {
  if (!catalogId) return null;
  // Lazy import to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ACTIVITY_CATALOG } = require('../catalog/activities');
  const item = ACTIVITY_CATALOG.find((c: { id: string }) => c.id === catalogId);
  return item?.placesQuery ?? null;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  emojiBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
});
