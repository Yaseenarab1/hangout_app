import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useMyProfile } from '@/features/profile';
import { useStoryPosts } from '../hooks/useFeedPosts';
import { StoryViewer } from './StoryViewer';
import type { FeedPostWithUrl, StoryGroup } from '../types';

/** Groups posts by author; own stories always first. */
function groupByAuthor(
  posts: FeedPostWithUrl[],
  myId: string,
): StoryGroup[] {
  const map = new Map<string, StoryGroup>();

  for (const post of posts) {
    const authorId = post.author_id;
    const author = post.author ?? {
      id: authorId,
      display_name: 'Unknown',
      username: 'unknown',
      avatar_url: null,
    };

    if (!map.has(authorId)) {
      map.set(authorId, { author, posts: [], hasUnviewed: true });
    }
    map.get(authorId)!.posts.push(post);
  }

  const groups = Array.from(map.values());
  // Own group first, then sort rest by most recent post
  groups.sort((a, b) => {
    if (a.author.id === myId) return -1;
    if (b.author.id === myId) return 1;
    const aTime = a.posts[0]?.created_at ?? '';
    const bTime = b.posts[0]?.created_at ?? '';
    return bTime.localeCompare(aTime);
  });

  return groups;
}

export function StoryRail(): React.ReactElement | null {
  const theme = useTheme();
  const { user } = useSession();
  const myProfile = useMyProfile();
  const { data: posts = [] } = useStoryPosts();

  const [viewerVisible, setViewerVisible] = useState(false);
  const [initialGroupIndex, setInitialGroupIndex] = useState(0);

  const myId = user?.id ?? '';

  const groups = useMemo(() => groupByAuthor(posts, myId), [posts, myId]);

  // Ensure "Your story" placeholder always appears
  const hasMyStory = groups.some((g) => g.author.id === myId);

  function openViewer(groupIndex: number) {
    setInitialGroupIndex(groupIndex);
    setViewerVisible(true);
  }

  function openMyStory() {
    if (hasMyStory) {
      const idx = groups.findIndex((g) => g.author.id === myId);
      openViewer(idx >= 0 ? idx : 0);
    } else {
      router.push('/post/new');
    }
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        style={styles.railScroll}
      >
        {/* Your story — always first */}
        <Pressable onPress={openMyStory} style={styles.storyItem}>
          <View style={styles.avatarWrap}>
            {hasMyStory ? (
              <View style={[styles.ring, { borderColor: theme.colors.accent }]}>
                <Avatar
                  id={myId}
                  displayName={myProfile.data?.display_name}
                  uri={myProfile.data?.avatar_url}
                  size="lg"
                />
              </View>
            ) : (
              <View
                style={[
                  styles.ring,
                  styles.addRing,
                  {
                    borderColor: theme.colors.border.default,
                    backgroundColor: theme.colors.bg.surface,
                  },
                ]}
              >
                <Avatar
                  id={myId}
                  displayName={myProfile.data?.display_name}
                  uri={myProfile.data?.avatar_url}
                  size="lg"
                />
                <View
                  style={[
                    styles.plusBadge,
                    { backgroundColor: theme.colors.accent },
                  ]}
                >
                  <Plus size={10} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
            )}
          </View>
          <Text
            style={[theme.typography.tiny, { color: theme.colors.text.secondary }]}
            numberOfLines={1}
          >
            Your story
          </Text>
        </Pressable>

        {/* Friends' stories */}
        {groups
          .filter((g) => g.author.id !== myId)
          .map((group, i) => {
            // Original index in groups array (accounting for own story)
            const groupIndex = groups.indexOf(group);
            return (
              <Pressable
                key={group.author.id}
                onPress={() => openViewer(groupIndex)}
                style={styles.storyItem}
              >
                <View style={[styles.ring, { borderColor: theme.colors.accent }]}>
                  <Avatar
                    id={group.author.id}
                    displayName={group.author.display_name}
                    uri={group.author.avatar_url}
                    size="lg"
                  />
                </View>
                <Text
                  style={[theme.typography.tiny, { color: theme.colors.text.secondary }]}
                  numberOfLines={1}
                >
                  {group.author.display_name.split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
      </ScrollView>

      {/* Horizontal divider */}
      <View
        style={[
          styles.divider,
          { backgroundColor: theme.colors.border.default },
        ]}
      />

      {viewerVisible && groups.length > 0 && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={initialGroupIndex}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  railScroll: {
    marginHorizontal: -16, // bleed past Screen padding
  },
  rail: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  storyItem: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  avatarWrap: {
    position: 'relative',
  },
  ring: {
    borderWidth: 2.5,
    borderRadius: 36,
    padding: 2,
  },
  addRing: {
    position: 'relative',
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
    marginBottom: 16,
  },
});
