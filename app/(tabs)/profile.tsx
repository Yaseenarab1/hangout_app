import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '@/features/auth';
import { useTheme } from '@/hooks/useTheme';

export default function ProfileTab(): React.ReactElement {
  const { user, isLoading } = useSession();
  const theme = useTheme();

  if (isLoading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return <Redirect href={`/profile/${user.id}`} />;
}
