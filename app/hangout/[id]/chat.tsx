import React from 'react';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function ChatScreen(): React.ReactElement {
  const theme = useTheme();
  return (
    <Screen header={{ title: 'Chat', showBack: true }}>
      <EmptyState
        icon={<MessageCircle size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
        title="Chat coming soon"
        body="Group messaging is on the way in Phase 3A."
      />
    </Screen>
  );
}
