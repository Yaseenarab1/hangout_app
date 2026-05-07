import React from 'react';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { Receipt } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function BillsScreen(): React.ReactElement {
  const theme = useTheme();
  return (
    <Screen header={{ title: 'Bills', showBack: true }}>
      <EmptyState
        icon={<Receipt size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
        title="Bills coming soon"
        body="Expense splitting is on the way in Phase 3D."
      />
    </Screen>
  );
}
