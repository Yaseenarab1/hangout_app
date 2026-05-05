import React from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Compass, UtensilsCrossed, MapPinned, Plus } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useMyProfile } from '@/features/profile';
import {
  useMyHangouts,
  HangoutCard,
} from '@/features/hangouts';
import { EmptyState, SectionHeader, Skeleton, Button } from '@/components/ui';

export default function HomeTab(): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const profile = useMyProfile();
  const hangouts = useMyHangouts();

  const greetingName = profile.data?.display_name?.split(' ')[0] ?? 'there';

  return (
    <Screen
      header={{ title: 'Home' }}
      scroll
      refreshControl={
        <RefreshControl
          refreshing={hangouts.isRefetching}
          onRefresh={() => hangouts.refetch()}
          tintColor={theme.colors.text.tertiary}
        />
      }
    >
      {/* Greeting */}
      <Text
        style={[theme.typography.h2, { color: theme.colors.text.primary }]}
      >
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

      {/* Tiles */}
      <View style={styles.tilesRow}>
        <Tile
          icon={<Compass size={28} color={theme.colors.accent} strokeWidth={1.5} />}
          title="Find what to do"
          subtitle="Vote on activities"
          onPress={() => router.push('/hangout/new-activity')}
        />

        <Tile
          icon={
            <UtensilsCrossed size={28} color={theme.colors.accent} strokeWidth={1.5} />
          }
          title="Plan food"
          subtitle="Pick a place"
          onPress={() => router.push('/hangout/new-food')}
        />

        <Tile
          icon={
            <MapPinned size={28} color={theme.colors.accent} strokeWidth={1.5} />
          }
          title="Plan a day"
          subtitle="Build an itinerary"
          onPress={() => router.push('/hangout/new')}
        />
      </View>

      {/* Hangouts */}
      <SectionHeader
        title="Your hangouts"
        actionLabel="New"
        onAction={() => router.push('/hangout/new')}
      />

      {hangouts.isLoading ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={120} radius={14} />
          <Skeleton height={120} radius={14} />
        </View>
      ) : hangouts.data && hangouts.data.length > 0 ? (
        <View>
          {hangouts.data.map((h) => (
            <HangoutCard key={h.id} hangout={h} />
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<Plus size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
          title="No hangouts yet"
          body="Start one with friends — pick a vibe and invite the crew."
          action={
            <Button
              label="New hangout"
              leadingIcon={<Plus size={16} color="#FFFFFF" />}
              onPress={() => router.push('/hangout/new')}
            />
          }
        />
      )}
    </Screen>
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
});
