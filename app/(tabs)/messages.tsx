import React from 'react';
import { MessageCircle } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';

export default function MessagesScreen(): React.ReactElement {
  const theme = useTheme();

  return (
    <Screen header={{ title: 'Messages' }}>
      <EmptyState
        icon={<MessageCircle size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
        title="No messages yet"
        body="Group chat unlocks once you're in a hangout. Coming in the next phase."
      />
    </Screen>
  );
}
