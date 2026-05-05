import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Calendar, MapPin, Users } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Card, Badge } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import type { Hangout, HangoutStatus } from '../types';

export type HangoutCardProps = {
  hangout: Hangout;
  /** Optional override for the participant count display. */
  participantCount?: number;
};

const STATUS_LABEL: Record<HangoutStatus, string> = {
  planning: 'Planning',
  scheduled: 'Scheduled',
  in_progress: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<HangoutStatus, 'default' | 'success' | 'warning' | 'brand'> = {
  planning: 'brand',
  scheduled: 'success',
  in_progress: 'warning',
  completed: 'default',
  cancelled: 'default',
};

export function HangoutCard({
  hangout,
  participantCount,
}: HangoutCardProps): React.ReactElement {
  const theme = useTheme();

  const startLabel = hangout.start_time
    ? formatStartTime(hangout.start_time)
    : 'No date set';

  return (
    <Card
      onPress={() => router.push(`/hangout/${hangout.id}`)}
      padding="md"
      style={{ marginBottom: 12 }}
    >
      <View style={styles.headerRow}>
        <Text
          style={[
            theme.typography.h3,
            { color: theme.colors.text.primary, flex: 1 },
          ]}
          numberOfLines={1}
        >
          {hangout.title}
        </Text>
        <Badge
          label={STATUS_LABEL[hangout.status]}
          variant={STATUS_VARIANT[hangout.status]}
        />
      </View>

      {hangout.description ? (
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary, marginTop: 6 },
          ]}
          numberOfLines={2}
        >
          {hangout.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <Meta icon={<Calendar size={14} color={theme.colors.text.tertiary} />} label={startLabel} />
        {hangout.primary_location_name ? (
          <Meta
            icon={<MapPin size={14} color={theme.colors.text.tertiary} />}
            label={hangout.primary_location_name}
          />
        ) : null}
        {participantCount !== undefined ? (
          <Meta
            icon={<Users size={14} color={theme.colors.text.tertiary} />}
            label={`${participantCount}`}
          />
        ) : null}
      </View>
    </Card>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.metaItem}>
      {icon}
      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.text.tertiary, marginLeft: 4 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Format the start time of a hangout. For times >24h in the past, fall back to date.
 */
function formatStartTime(iso: string): string {
  const start = new Date(iso);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const isFuture = diffMs > 0;

  // Future times within 7 days: "in 3h" / "tomorrow at 7pm"
  // Past times within 7 days: relative
  if (Math.abs(diffMs) < 7 * 24 * 60 * 60 * 1000) {
    return isFuture
      ? formatFutureRelative(start, now)
      : `started ${formatRelativeTime(iso, now)}`;
  }

  // Otherwise: short date
  return start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: start.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function formatFutureRelative(start: Date, now: Date): string {
  const diffMs = start.getTime() - now.getTime();
  const hr = diffMs / (60 * 60 * 1000);
  if (hr < 1) {
    const min = Math.round(diffMs / (60 * 1000));
    return `in ${min}m`;
  }
  if (hr < 24) {
    return `in ${Math.round(hr)}h`;
  }
  // Tomorrow / day-of-week
  const time = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const today = now.toDateString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
  if (start.toDateString() === tomorrow) return `tomorrow at ${time}`;
  if (start.toDateString() === today) return `today at ${time}`;
  return `${start.toLocaleDateString(undefined, { weekday: 'short' })} at ${time}`;
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
