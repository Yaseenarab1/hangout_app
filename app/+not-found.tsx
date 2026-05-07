import React from 'react';
import { router } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';

export default function NotFoundScreen(): React.ReactElement {
  const theme = useTheme();
  return (
    <Screen header={{ title: '', showBack: true }}>
      <EmptyState
        icon={<Compass size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
        title="That screen doesn't exist"
        body="The link you followed is broken, or this screen has moved."
        actionLabel="Go home"
        onAction={() => router.replace('/(tabs)/' as any)}
      />
    </Screen>
  );
}
