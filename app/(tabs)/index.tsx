import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Compass, UtensilsCrossed, MapPinned, ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useMyProfile } from '@/features/profile';
import { useMyHangouts } from '@/features/hangouts';
import { SectionHeader } from '@/components/ui';
import type { Hangout } from '@/features/hangouts';

export default function HomeTab(): React.ReactElement {
  const theme = useTheme();
  const profile = useMyProfile();
  const hangouts = useMyHangouts();

  const greetingName = profile.data?.display_name?.split(' ')[0] ?? 'there';

  // Up to 3 upcoming hangouts (non-cancelled, soonest first)
  const upcoming = (hangouts.data ?? [])
    .filter((h) => h.status !== 'cancelled')
    .slice(0, 3);

  return (
    <Screen header={{ title: 'Home' }} scroll>
      {/* Greeting */}
      <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>
        Hi {greetingName} 👋
      </Text>
      <Text
        style={[
          theme.typography.body,
          { color: theme.colors.text.secondary, marginTop: 4 },
        ]}
      >
        What are you doing today?
      </Text>

      {/* Quick-action tiles */}
      <View style={styles.tilesRow}>
        <Tile
          icon={<Compass size={28} color={theme.colors.accent} strokeWidth={1.5} />}
          title="Find what to do"
          subtitle="Vote on activities"
          onPress={() => router.push('/hangout/new-activity')}
        />
        <Tile
          icon={<UtensilsCrossed size={28} color={theme.colors.accent} strokeWidth={1.5} />}
          title="Plan food"
          subtitle="Pick a place"
          onPress={() => router.push('/hangout/new-food')}
        />
        <Tile
          icon={<MapPinned size={28} color={theme.colors.accent} strokeWidth={1.5} />}
          title="Plan a day"
          subtitle="Build an itinerary"
          onPress={() => router.push('/hangout/new')}
        />
      </View>

      {/* Upcoming compact strip */}
      {upcoming.length > 0 ? (
        <>
          <SectionHeader
            title="Upcoming"
            actionLabel="See all"
            onAction={() => router.push('/(tabs)/hangouts')}
          />
          <View style={{ gap: 8 }}>
            {upcoming.map((h) => (
              <UpcomingRow key={h.id} hangout={h} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function UpcomingRow({ hangout }: { hangout: Hangout }): React.ReactElement {
  const theme = useTheme();
  const dateStr = hangout.start_time
    ? new Date(hangout.start_time).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Date TBD';

  return (
    <Pressable
      onPress={() => router.push(`/hangout/${hangout.id}`)}
      style={({ pressed }) => [
        styles.upcomingRow,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
          numberOfLines={1}
        >
          {hangout.title}
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginTop: 2 },
          ]}
        >
          {dateStr}
        </Text>
      </View>
      <ChevronRight size={16} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

function Tile({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon}

      <Text
        style={[
          theme.typography.bodyMedium,
          { color: theme.colors.text.primary, marginTop: 8 },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.text.tertiary, marginTop: 2 },
        ]}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tilesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
