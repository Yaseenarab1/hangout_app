import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Clock } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui';
import { SummaryRow } from '@/components/ui/SummaryRow';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityVenuePicker,
  type ActivityVenueOption,
  pollKeys,
  VoteDeadlineSheet,
} from '@/features/polls';
import { hangoutKeys } from '@/features/hangouts';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';

export default function FollowUpVenueScreen(): React.ReactElement {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    id: string;
    activity: string;
    query: string;
  }>();
  const hangoutId = params.id ?? '';
  const activityLabel = params.activity ?? '';
  const placesQuery = params.query ?? '';

  const [venues, setVenues] = useState<ActivityVenueOption[]>([]);
  const [voteDeadline, setVoteDeadline] = useState<Date | null>(null);
  const [showDeadlineSheet, setShowDeadlineSheet] = useState(false);

  const qc = useQueryClient();
  const createPoll = useMutation({
    mutationFn: async (input: {
      hangoutId: string;
      voteDeadline: string;
      options: ActivityVenueOption[];
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Not authenticated');

      const { data: poll, error } = await supabase
        .from(TABLES.polls)
        .insert({
          hangout_id: input.hangoutId,
          created_by: auth.user.id,
          kind: 'restaurant',
          mode: 'simple_vote',
          voting_method: 'simple',
          phase: 'voting',
          title: `Where to ${activityLabel.toLowerCase()}?`,
          vote_deadline: input.voteDeadline,
        })
        .select()
        .single();

      if (error) throw error;

      const optionRows = input.options.map((v) => ({
        poll_id: poll.id,
        added_by: auth.user!.id,
        label: v.name,
        metadata: {
          placeId: v.placeId ?? null,
          address: v.address ?? null,
          rating: v.rating ?? null,
          primaryType: v.primaryType ?? null,
          mapsUrl: v.mapsUrl ?? null,
          isCustom: v.isCustom ?? false,
        },
      }));

      const { error: optErr } = await supabase
        .from(TABLES.poll_options)
        .insert(optionRows);
      if (optErr) throw optErr;

      return poll;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pollKeys.byHangout(hangoutId) });
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      toast.success('Venue poll started.');
      router.replace(`/hangout/${hangoutId}`);
    },
    onError: (error) => {
      logError(error, { where: 'createVenuePoll' });
      toast.error(friendlyErrorMessage(error));
    },
  });

  const handleSubmit = (): void => {
    const finalDeadline = voteDeadline ?? new Date(Date.now() + 60 * 60 * 1000);
    createPoll.mutate({
      hangoutId,
      voteDeadline: finalDeadline.toISOString(),
      options: venues,
    });
  };

  return (
    <Screen
      header={{
        title: `Where to ${activityLabel.toLowerCase()}?`,
        showBack: true,
      }}
      contentPadding={0}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          <ActivityVenuePicker
            value={venues}
            onChange={setVenues}
            activityQuery={placesQuery}
            activityLabel={activityLabel}
            min={2}
            max={10}
          />
        </View>

        <View
          style={[
            styles.summarySection,
            { borderTopColor: theme.colors.border.default },
          ]}
        >
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
          />
        </View>

        <View
          style={[
            styles.bottomBar,
            { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas },
          ]}
        >
          <Button
            label={
              venues.length < 2
                ? `Pick ${2 - venues.length} more to continue`
                : 'Create venue poll'
            }
            trailingIcon={
              venues.length >= 2 ? <ChevronRight size={16} color="#FFFFFF" /> : undefined
            }
            onPress={handleSubmit}
            disabled={venues.length < 2 || createPoll.isPending}
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
