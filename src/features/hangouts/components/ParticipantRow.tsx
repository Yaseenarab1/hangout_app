import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Crown, Star } from 'lucide-react-native';
import { Avatar, Badge } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import type { ParticipantStatus, ParticipantRole, HangoutParticipant } from '../types';

export type ParticipantRowProps = {
  participant: HangoutParticipant & {
    profile: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
    };
  };
  /** Render extra controls on the right (host actions, RSVP buttons). */
  trailing?: React.ReactNode;
  /** Tapping the row navigates to that user's profile. Set false to disable. */
  navigateOnTap?: boolean;
};

const STATUS_VARIANT: Record<
  ParticipantStatus,
  'default' | 'success' | 'warning' | 'danger'
> = {
  invited: 'warning',
  accepted: 'success',
  declined: 'danger',
  maybe: 'default',
  removed: 'default',
};

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  invited: 'Invited',
  accepted: 'Going',
  declined: 'Not going',
  maybe: 'Maybe',
  removed: 'Removed',
};

export function ParticipantRow({
  participant,
  trailing,
  navigateOnTap = true,
}: ParticipantRowProps): React.ReactElement {
  const theme = useTheme();
  const { profile } = participant;

  const content = (
    <View style={styles.row}>
      <Avatar
        id={profile.id}
        displayName={profile.display_name}
        uri={profile.avatar_url}
        size="md"
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[theme.typography.body, { color: theme.colors.text.primary }]}
            numberOfLines={1}
          >
            {profile.display_name}
          </Text>
          {participant.role === 'host' ? (
            <Crown size={14} color={theme.colors.warning} style={{ marginLeft: 6 }} />
          ) : participant.role === 'co_host' ? (
            <Star size={14} color={theme.colors.accent} style={{ marginLeft: 6 }} />
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary },
            ]}
            numberOfLines={1}
          >
            @{profile.username}
          </Text>
          {participant.role !== 'host' ? (
            <Badge
              label={STATUS_LABEL[participant.status]}
              variant={STATUS_VARIANT[participant.status]}
            />
          ) : null}
        </View>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (!navigateOnTap) return content;

  return (
    <Pressable
      onPress={() => router.push(`/users/${profile.id}`)}
      style={({ pressed }) => [
        pressed && { backgroundColor: theme.colors.bg.subtle },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  body: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  trailing: {
    marginLeft: 12,
  },
});
