import React from 'react';
import { Calendar } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';

export default function FindTimeScreen(): React.ReactElement {
  const theme = useTheme();

  return (
    <Screen header={{ title: 'Find Time' }}>
      <EmptyState
        icon={<Calendar size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
        title="Find Time"
        body="Mark when you're free, and find overlap with friends. Unlocks in Phase 4."
      />
    </Screen>
  );
}
