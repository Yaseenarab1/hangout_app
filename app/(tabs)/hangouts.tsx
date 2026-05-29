import React, { useState } from 'react';
import { View, Text, RefreshControl, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, Skeleton, Button, SectionHeader } from '@/components/ui';
import { useMyHangouts, HangoutCard, NewHangoutSheet } from '@/features/hangouts';
import { useTheme } from '@/hooks/useTheme';
import type { Hangout } from '@/features/hangouts';

function groupHangouts(hangouts: Hangout[]): {
  thisWeek: Hangout[];
  upcoming: Hangout[];
  noDate: Hangout[];
  past: Hangout[];
} {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const thisWeek: Hangout[] = [];
  const upcoming: Hangout[] = [];
  const noDate: Hangout[] = [];
  const past: Hangout[] = [];

  for (const h of hangouts) {
    if (h.status === 'cancelled') {
      past.push(h);
      continue;
    }
    if (!h.start_time) {
      noDate.push(h);
      continue;
    }
    const d = new Date(h.start_time);
    if (d < now) {
      past.push(h);
    } else if (d <= weekEnd) {
      thisWeek.push(h);
    } else {
      upcoming.push(h);
    }
  }

  return { thisWeek, upcoming, noDate, past };
}

export default function HangoutsTab(): React.ReactElement {
  const theme = useTheme();
  const hangouts = useMyHangouts();
  const [showNewSheet, setShowNewSheet] = useState(false);

  const all = hangouts.data ?? [];
  const { thisWeek, upcoming, noDate, past } = groupHangouts(all);
  const hasAny = all.length > 0;

  return (
    <Screen
      header={{
        title: 'Hangouts',
        right: (
          <Button
            label="New"
            size="sm"
            leadingIcon={<Plus size={14} color="#FFFFFF" />}
            onPress={() => setShowNewSheet(true)}
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
      ) : !hasAny ? (
        <EmptyState
          icon={<Plus size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
          title="No hangouts yet"
          body="Start one with friends — pick a vibe and invite the crew."
          action={
            <Button
              label="New hangout"
              leadingIcon={<Plus size={16} color="#FFFFFF" />}
              onPress={() => setShowNewSheet(true)}
            />
          }
        />
      ) : (
        <View>
          {thisWeek.length > 0 && (
            <>
              <SectionHeader title="This week" />
              {thisWeek.map((h) => <HangoutCard key={h.id} hangout={h} />)}
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <SectionHeader title="Coming up" />
              {upcoming.map((h) => <HangoutCard key={h.id} hangout={h} />)}
            </>
          )}
          {noDate.length > 0 && (
            <>
              <SectionHeader title="No date yet" />
              {noDate.map((h) => <HangoutCard key={h.id} hangout={h} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <SectionHeader title="Past" />
              {past.map((h) => <HangoutCard key={h.id} hangout={h} />)}
            </>
          )}
        </View>
      )}
      <NewHangoutSheet visible={showNewSheet} onClose={() => setShowNewSheet(false)} />
    </Screen>
  );
}
