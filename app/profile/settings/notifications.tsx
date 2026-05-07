import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { Card, SectionHeader, Switch, Spinner } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/services/supabase/client';
import { TABLES, QUERY_KEYS } from '@/services/supabase/tables';
import { logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import type { NotificationPreferences } from '@/services/supabase/types.gen';

type PrefKey = keyof Omit<NotificationPreferences, 'user_id' | 'updated_at'>;

const SECTIONS: { title: string; items: { key: PrefKey; label: string; hint?: string }[] }[] = [
  {
    title: 'Friends',
    items: [
      { key: 'friend_request_received', label: 'Friend requests' },
      { key: 'friend_request_accepted', label: 'Request accepted' },
    ],
  },
  {
    title: 'Hangouts',
    items: [
      { key: 'hangout_invited', label: 'Hangout invites' },
      { key: 'hangout_reminder', label: 'Hangout reminders' },
      { key: 'itinerary_published', label: 'Plan published' },
    ],
  },
  {
    title: 'Polls',
    items: [
      { key: 'poll_created', label: 'New poll' },
      { key: 'poll_voting_opened', label: 'Voting opened' },
      { key: 'poll_deadline_soon', label: 'Voting closing soon' },
      { key: 'poll_closed', label: 'Winner announced' },
    ],
  },
  {
    title: 'Messaging & Social',
    items: [
      { key: 'message_received', label: 'New messages' },
      { key: 'post_created_by_friend', label: 'Friends posts' },
      { key: 'post_comment', label: 'Comments on your posts' },
    ],
  },
  {
    title: 'Bills & Location',
    items: [
      { key: 'bill_added', label: 'New bills' },
      { key: 'bill_marked_paid', label: 'Marked as paid' },
      { key: 'location_shared_with_you', label: 'Location shared with you' },
    ],
  },
];

async function fetchPreferences(): Promise<NotificationPreferences | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from(TABLES.notification_preferences)
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updatePreference(key: PrefKey, value: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from(TABLES.notification_preferences)
    .update({ [key]: value } as any)
    .eq('user_id', auth.user.id);
  if (error) throw error;
}

export default function NotificationSettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const qc = useQueryClient();

  const prefs = useQuery({
    queryKey: QUERY_KEYS.notificationPreferences,
    queryFn: fetchPreferences,
  });

  const update = useMutation({
    mutationFn: ({ key, value }: { key: PrefKey; value: boolean }) =>
      updatePreference(key, value),
    onMutate: async ({ key, value }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: QUERY_KEYS.notificationPreferences });
      const previous = qc.getQueryData<NotificationPreferences>(
        QUERY_KEYS.notificationPreferences,
      );
      if (previous) {
        qc.setQueryData<NotificationPreferences>(QUERY_KEYS.notificationPreferences, {
          ...previous,
          [key]: value,
        });
      }
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      // Roll back
      if (ctx?.previous) {
        qc.setQueryData(QUERY_KEYS.notificationPreferences, ctx.previous);
      }
      logError(error, { where: 'updateNotificationPref' });
      toast.error("Couldn't save that. Try again?");
    },
  });

  if (prefs.isLoading) {
    return (
      <Screen header={{ title: 'Notifications', showBack: true }}>
        <Spinner fullScreen />
      </Screen>
    );
  }

  return (
    <Screen header={{ title: 'Notifications', showBack: true }} scroll>
      {SECTIONS.map((section) => (
        <View key={section.title}>
          <SectionHeader title={section.title} />
          <Card padding="none">
            {section.items.map((item, idx) => (
              <View key={item.key}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Switch
                    label={item.label}
                    hint={item.hint}
                    value={Boolean(prefs.data?.[item.key])}
                    onValueChange={(value) => update.mutate({ key: item.key, value })}
                  />
                </View>
                {idx < section.items.length - 1 ? (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: theme.colors.border.default,
                      marginLeft: 16,
                    }}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
