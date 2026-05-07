import React from 'react';
import { View, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, Skeleton, Button } from '@/components/ui';
import { useMyHangouts, HangoutCard } from '@/features/hangouts';
import { useTheme } from '@/hooks/useTheme';

export default function HangoutsTab(): React.ReactElement {
  const theme = useTheme();
  const hangouts = useMyHangouts();

  return (
    <Screen
      header={{
        title: 'Hangouts',
        right: (
          <Button
            label="New"
            size="sm"
            leadingIcon={<Plus size={14} color="#FFFFFF" />}
            onPress={() => router.push('/hangout/new')}
          />
        ),
      }}
      scroll
      refreshControl={
        <RefreshControl
          refreshing={hangouts.isRefetching}
          onRefresh={() => hangouts.refetch()}
          tintColor={theme.colors.text.tertiary}
        />
      }
    >
      {hangouts.isLoading ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={120} radius={14} />
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
