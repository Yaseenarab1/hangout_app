import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Settings as SettingsIcon, Pencil, Camera } from 'lucide-react-native';
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
import { useSession } from '@/features/auth';
import { useMyHangouts } from '@/features/hangouts';
import { useFriends } from '@/features/friends';
import { useAuthorPosts } from '@/features/feed/hooks/useFeedPosts';
import { StoryViewer } from '@/features/feed/components/StoryViewer';
import type { FeedPostWithUrl } from '@/features/feed';

const GALLERY_COLS = 3;
const GALLERY_ITEM_SIZE = Dimensions.get('window').width / GALLERY_COLS;

export default function ProfileTab(): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const profile = useMyProfile();
  const friends = useFriends();
  const hangouts = useMyHangouts();
  const authorPosts = useAuthorPosts(user?.id);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const headerRight = (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      <Pressable
        onPress={() => router.push('/post/new')}
        hitSlop={12}
        style={{ padding: 8 }}
        accessibilityLabel="New post"
      >
        <Camera size={22} color={theme.colors.text.primary} strokeWidth={1.5} />
      </Pressable>
      <Pressable
        onPress={() => router.push('/profile/settings')}
        hitSlop={12}
        style={{ padding: 8 }}
        accessibilityLabel="Settings"
      >
        <SettingsIcon size={22} color={theme.colors.text.primary} />
      </Pressable>
    </View>
  );

  if (profile.isLoading) {
    return (
      <Screen header={{ title: '', showBack: false, right: headerRight }}>
        <View style={styles.hero}>
          <Skeleton width={80} height={80} radius={40} />
          <Skeleton width={160} height={24} style={{ marginTop: 16 }} />
          <Skeleton width={120} height={16} style={{ marginTop: 8 }} />
        </View>
      </Screen>
    );
  }

  const p = profile.data;
  if (!p) return <Screen header={{ title: '', showBack: false }}><View /></Screen>;

  return (
    <Screen
      scroll
      header={{ title: '', showBack: false, right: headerRight }}
    >
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <Avatar id={p.id} displayName={p.display_name} uri={p.avatar_url} size="xl" />
        <Text
          style={[
            theme.typography.h1,
            { color: theme.colors.text.primary, marginTop: 16, textAlign: 'center' },
          ]}
        >
          {p.display_name}
        </Text>
        <Text
          style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}
        >
          @{p.username}
        </Text>
        {p.bio ? (
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
            {p.bio}
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

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <StatBox
          label="Friends"
          value={String(friends.data?.length ?? 0)}
          onPress={() => router.push('/(tabs)/friends')}
        />
        <StatBox label="Hangouts" value={String(hangouts.data?.length ?? 0)} />
        <StatBox label="Posts" value={String(authorPosts.data?.length ?? 0)} />
      </View>

      {/* ── Social ── */}
      <SectionHeader title="Social" />
      <Card padding="none">
        <ListItem
          title="Friends"
          subtitle="Manage your friends list"
          onPress={() => router.push('/(tabs)/friends')}
        />
      </Card>

      {/* ── Bills ── */}
      <SectionHeader title="Bills" />
      <Card padding="none">
        <ListItem
          title="My bills"
          subtitle="Bills you created outside hangouts"
          onPress={() => router.push('/profile/bills')}
        />
      </Card>

      {/* ── Account ── */}
      <SectionHeader title="Account" />
      <Card padding="none">
        <ListItem title="Settings" onPress={() => router.push('/profile/settings')} />
        <Divider />
        <ListItem
          title="Notifications"
          onPress={() => router.push('/profile/settings/notifications')}
        />
        <Divider />
        <ListItem title="Privacy" onPress={() => router.push('/profile/settings/privacy')} />
        <Divider />
        <ListItem title="About" onPress={() => router.push('/profile/settings/about')} />
      </Card>

      {/* ── Post gallery ── */}
      {authorPosts.data && authorPosts.data.length > 0 && (
        <>
          <SectionHeader title="Posts" />
          <View style={styles.gallery}>
            {authorPosts.data.map((post, i) => (
              <Pressable
                key={post.id}
                onPress={() => setViewerIndex(i)}
                style={styles.galleryItem}
              >
                <Image
                  source={{ uri: post.image_url }}
                  style={styles.galleryImage}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Story-style viewer for gallery taps */}
      {viewerIndex !== null && authorPosts.data && authorPosts.data.length > 0 && (
        <StoryViewer
          groups={[{
            author: {
              id: p.id,
              display_name: p.display_name,
              username: p.username,
              avatar_url: p.avatar_url,
            },
            posts: authorPosts.data,
            hasUnviewed: false,
          }]}
          initialGroupIndex={0}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </Screen>
  );
}

function StatBox({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.stat,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && onPress ? { opacity: 0.7 } : undefined,
      ]}
    >
      <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>{value}</Text>
      <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
        {label}
      </Text>
    </Pressable>
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
    paddingTop: 16,
    paddingBottom: 8,
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
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -16,
  },
  galleryItem: {
    width: GALLERY_ITEM_SIZE,
    height: GALLERY_ITEM_SIZE,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
});
