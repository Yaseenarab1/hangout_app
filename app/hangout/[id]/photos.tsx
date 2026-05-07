import React from 'react';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { Images } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function PhotosScreen(): React.ReactElement {
  const theme = useTheme();
  return (
    <Screen header={{ title: 'Photos', showBack: true }}>
      <EmptyState
        icon={<Images size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
        title="Photos coming soon"
        body="Shared photo albums are on the way in Phase 3B."
      />
    </Screen>
  );
}
