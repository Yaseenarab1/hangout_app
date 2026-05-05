import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Settings as SettingsIcon, Pencil } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import {
  Avatar,
  Button,
  Card,
  Skeleton,
  ListItem,
  SectionHeader,
} from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useMyProfile } from '@/features/profile';
import { useFriends } from '@/features/friends';
import { useMyHangouts } from '@/features/hangouts';


export default function ProfileTab(): React.ReactElement {
  const theme = useTheme();
  const profile = useMyProfile();
  const friends = useFriends();
  const hangouts = useMyHangouts();
  console.log('[ProfileTab render] avatar_url:', profile.data?.avatar_url);

  return (
    <Screen
      scroll
      header={{
        title: 'Profile',
        right: (
          <Pressable
            onPress={() => router.push('/profile/settings')}
            hitSlop={12}
            accessibilityLabel="Settings"
            style={{ padding: 8 }}
          >
            <SettingsIcon size={22} color={theme.colors.text.primary} />
          </Pressable>
        ),
      }}
    >
      {profile.isLoading || !profile.data ? (
        <View style={styles.heroLoading}>
          <Skeleton width={80} height={80} radius={40} />
          <Skeleton width={160} height={24} style={{ marginTop: 16 }} />
          <Skeleton width={120} height={16} style={{ marginTop: 8 }} />
        </View>
      ) : (
          
          <View style={styles.hero}>
          <Avatar
            id={profile.data.id}
            displayName={profile.data.display_name}
            uri={profile.data.avatar_url}
            size="xl"
          />
          <Text
            style={[
              theme.typography.h1,
              { color: theme.colors.text.primary, marginTop: 16, textAlign: 'center' },
            ]}
          >
            {profile.data.display_name}
          </Text>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.text.secondary, marginTop: 4 },
            ]}
          >
            @{profile.data.username}
          </Text>
          {profile.data.bio ? (
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.text.primary,
                  textAlign: 'center',
                  marginTop: 16,
                  paddingHorizontal: 16,
                },
              ]}
            >
              {profile.data.bio}
            </Text>
          ) : null}
          <Button
            label="Edit profile"
            variant="secondary"
            size="sm"
            leadingIcon={<Pencil size={14} color={theme.colors.text.primary} />}
            onPress={() => router.push('/profile/edit')}
            style={{ marginTop: 20 }}
          />
        </View>
      )}

      <View style={styles.statsRow}>
        <StatBox label="Friends" value={String(friends.data?.length ?? 0)} />
        <StatBox label="Hangouts" value={hangouts.data?.length ?? 0} />
        <StatBox label="Posts" value="0" />
      </View>

      <SectionHeader title="Account" />
      <Card padding="none">
        <ListItem
          title="Settings"
          onPress={() => router.push('/profile/settings')}
        />
        <Divider />
        <ListItem
          title="Notifications"
          onPress={() => router.push('/profile/settings/notifications')}
        />
        <Divider />
        <ListItem
          title="Privacy"
          onPress={() => router.push('/profile/settings/privacy')}
        />
        <Divider />
        <ListItem
          title="About"
          onPress={() => router.push('/profile/settings/about')}
        />
      </Card>
    </Screen>
  );
}

function StatBox({ label, value }: { label: string; value: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
      ]}
    >
      <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>{value}</Text>
      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
        {label}
      </Text>
    </View>
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

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  heroLoading: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
});
