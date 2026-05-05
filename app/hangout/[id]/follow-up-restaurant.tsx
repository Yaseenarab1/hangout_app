import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Clock, Vote as VoteIcon, ListOrdered } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui';
import { SummaryRow } from '@/components/ui/SummaryRow';
import { useTheme } from '@/hooks/useTheme';
import {
  RestaurantSearchPicker,
  useCreateRestaurantPoll,
  type RestaurantOption,
} from '@/features/food';
import {
  VoteDeadlineSheet,
  VotingStyleSheet,
  type VotingMethod,
} from '@/features/polls';

export default function FollowUpRestaurantScreen(): React.ReactElement {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string; cuisine: string }>();
  const hangoutId = params.id ?? '';
  const cuisine = params.cuisine ?? '';

  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [voteDeadline, setVoteDeadline] = useState<Date | null>(null);
  const [showDeadlineSheet, setShowDeadlineSheet] = useState(false);
  const [votingMethod, setVotingMethod] = useState<VotingMethod>('simple');
  const [showStyleSheet, setShowStyleSheet] = useState(false);

  const createPoll = useCreateRestaurantPoll();

  const handleSubmit = (): void => {
    const finalDeadline = voteDeadline ?? new Date(Date.now() + 60 * 60 * 1000);
    createPoll.mutate(
      {
        hangoutId,
        votingMethod,
        voteDeadline: finalDeadline.toISOString(),
        options: restaurants.map((r) => ({
          name: r.name,
          address: r.address,
          placeId: r.placeId,
          rating: r.rating,
          priceLevel: r.priceLevel,
          primaryType: r.primaryType,
          mapsUrl: r.mapsUrl,
          isCustom: r.isCustom,
        })),
      },
      {
        onSuccess: () => {
          router.replace(`/hangout/${hangoutId}`);
        },
      },
    );
  };

  return (
    <Screen
      header={{
        title: cuisine ? `Pick ${cuisine} restaurants` : 'Pick restaurants',
        showBack: true,
      }}
      contentPadding={0}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          <RestaurantSearchPicker
            value={restaurants}
            onChange={setRestaurants}
            presetCuisine={cuisine}
            min={2}
            max={10}
          />
        </View>

        <View
          style={[styles.summarySection, { borderTopColor: theme.colors.border.default }]}
        >
          <SummaryRow
            label="Voting style"
            icon={
              votingMethod === 'ranked' ? (
                <ListOrdered size={18} color={theme.colors.text.tertiary} />
              ) : (
                <VoteIcon size={18} color={theme.colors.text.tertiary} />
              )
            }
            value={votingMethod === 'ranked' ? 'Ranked vote' : 'Simple vote'}
            onPress={() => setShowStyleSheet(true)}
          />
          <SummaryRow
            label="Voting closes"
            icon={<Clock size={18} color={theme.colors.text.tertiary} />}
            value={
              voteDeadline
                ? voteDeadline.toLocaleString(undefined, {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'In 1 hour'
            }
            onPress={() => setShowDeadlineSheet(true)}
            showTopSeparator
          />
        </View>

        <View
          style={[
            styles.bottomBar,
            {
              borderTopColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.canvas,
            },
          ]}
        >
          <Button
            label={
              restaurants.length < 2
                ? `Pick ${2 - restaurants.length} more to continue`
                : 'Create restaurant poll'
            }
            trailingIcon={
              restaurants.length >= 2 ? <ChevronRight size={16} color="#FFFFFF" /> : undefined
            }
            onPress={handleSubmit}
            disabled={restaurants.length < 2 || createPoll.isPending}
            loading={createPoll.isPending}
            fullWidth
            size="lg"
          />
        </View>
      </View>

      <VoteDeadlineSheet
        visible={showDeadlineSheet}
        onClose={() => setShowDeadlineSheet(false)}
        value={voteDeadline}
        onChange={setVoteDeadline}
      />
      <VotingStyleSheet
        visible={showStyleSheet}
        onClose={() => setShowStyleSheet(false)}
        value={votingMethod}
        onChange={setVotingMethod}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summarySection: { borderTopWidth: StyleSheet.hairlineWidth },
  bottomBar: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
