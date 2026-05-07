import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { Card, ListItem, SectionHeader, Switch, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore, type ThemePreference } from '@/stores/theme.store';
import { useSignOut } from '@/features/auth';

export default function SettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const themePref = useThemeStore((s) => s.preference);
  const setThemePref = useThemeStore((s) => s.setPreference);
  const signOut = useSignOut();

  const cycleTheme = (): void => {
    const next: Record<ThemePreference, ThemePreference> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    setThemePref(next[themePref]);
  };

  const handleSignOut = (): void => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut.mutate() },
    ]);
  };

  return (
    <Screen header={{ title: 'Settings', showBack: true }} scroll>
      <SectionHeader title="Preferences" />
      <Card padding="none">
        <ListItem
          title="Search location"
          subtitle="Center point for restaurant and venue searches"
          onPress={() => router.push('/profile/settings/search-location')}
        />
        <Divider />
        <ListItem
          title="Notifications"
          subtitle="Choose what you want to be notified about"
          onPress={() => router.push('/profile/settings/notifications')}
        />
        <Divider />
        <ListItem
          title="Privacy"
          subtitle="Default visibility for posts and calendar"
          onPress={() => router.push('/profile/settings/privacy')}
        />
        <Divider />
        <ListItem
          title="Appearance"
          subtitle={
            themePref === 'system'
              ? 'Match system'
              : themePref === 'light'
              ? 'Light mode'
              : 'Dark mode'
          }
          onPress={cycleTheme}
        />
        <Divider />
        <ListItem
          title="Blocked users"
          onPress={() => router.push('/profile/settings/blocked')}
        />
      </Card>

      <SectionHeader title="Account" />
      <Card padding="none">
        <ListItem
          title="Account"
          subtitle="Email, password, delete account"
          onPress={() => router.push('/profile/settings/account')}
        />
        <Divider />
        <ListItem title="About" onPress={() => router.push('/profile/settings/about')} />
      </Card>

      <View style={{ marginTop: 32 }}>
        <Button
          label="Sign out"
          variant="ghost"
          onPress={handleSignOut}
          loading={signOut.isPending}
          fullWidth
        />
      </View>
    </Screen>
  );
}

function Divider(): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border.default,
        marginLeft: 16,
      }}
    />
  );
}
