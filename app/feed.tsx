import React from 'react';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { Newspaper } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function FeedScreen(): React.ReactElement {
  const theme = useTheme();
  return (
    <Screen header={{ title: 'Feed', showBack: true }}>
      <EmptyState
        icon={<Newspaper size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
        title="Feed coming soon"
        body="The social feed is on the way in Phase 3C."
      />
    </Screen>
  );
}
