import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  PanResponder,
  AppState,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { X, MessageCircle, Heart, MoreHorizontal, Share2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { toast } from '@/stores/ui.store';
import { useLikePost } from '../hooks/useLikePost';
import { useDeletePost } from '../hooks/useDeletePost';
import { CommentsSheet } from './CommentsSheet';
import type { StoryGroup } from '../types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const AUTO_ADVANCE_MS = 5000;

interface Props {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

export function StoryViewer({ groups, initialGroupIndex, onClose }: Props): React.ReactElement {
  const theme = useTheme();
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [postIdx, setPostIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const { user } = useSession();
  const likePost = useLikePost();
  const deletePost = useDeletePost();

  const group = groups[groupIdx];
  const post = group?.posts[postIdx];
  const postCount = group?.posts.length ?? 0;

  // Reanimated progress [0, 1] for the current segment
  const progress = useSharedValue(0);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goNextPost = useCallback(() => {
    if (!group) return;
    if (postIdx < group.posts.length - 1) {
      setPostIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setPostIdx(0);
    } else {
      onClose();
    }
  }, [group, postIdx, groupIdx, groups.length, onClose]);

  const goPrevPost = useCallback(() => {
    if (!group) return;
    if (postIdx > 0) {
      setPostIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      // Go to last post of previous group
      setPostIdx(groups[groupIdx - 1]!.posts.length - 1);
    }
  }, [group, postIdx, groupIdx, groups]);

  const goNextGroup = useCallback(() => {
    if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setPostIdx(0);
    } else {
      onClose();
    }
  }, [groupIdx, groups.length, onClose]);

  const goPrevGroup = useCallback(() => {
    if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setPostIdx(0);
    }
  }, [groupIdx]);

  // ── Progress bar animation ─────────────────────────────────────────────────

  useEffect(() => {
    progress.value = 0;
    if (paused || !post) return;

    progress.value = withTiming(1, { duration: AUTO_ADVANCE_MS }, (finished) => {
      if (finished) {
        runOnJS(goNextPost)();
      }
    });

    return () => {
      cancelAnimation(progress);
    };
  }, [groupIdx, postIdx, paused, post]);

  // ── Pause on app background ────────────────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setPaused(true);
        cancelAnimation(progress);
      } else {
        setPaused(false);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Pause on hold ──────────────────────────────────────────────────────────

  const handlePressIn = useCallback(() => {
    setPaused(true);
    cancelAnimation(progress);
  }, []);

  const handlePressOut = useCallback(() => {
    setPaused(false);
  }, []);

  // ── Swipe gestures (down = dismiss, left/right = change group) ─────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 10 || Math.abs(g.dx) > 10,
      onPanResponderGrant: () => {
        // pause while swiping
      },
      onPanResponderRelease: (_, g) => {
        const SWIPE_THRESHOLD = 60;
        if (g.dy > SWIPE_THRESHOLD) {
          // Swipe down → dismiss
          onClose();
        } else if (g.dx < -SWIPE_THRESHOLD) {
          // Swipe left → next group
          goNextGroup();
        } else if (g.dx > SWIPE_THRESHOLD) {
          // Swipe right → prev group
          goPrevGroup();
        }
      },
    }),
  ).current;

  // ── Progress bar segments ──────────────────────────────────────────────────

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!group || !post) return <View />;

  const author = group.author;
  const timeAgo = formatTimeAgo(post.created_at);

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container} {...panResponder.panHandlers}>
        {/* ── Image ── */}
        <Image
          source={{ uri: post.image_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Dark gradient overlay top */}
        <View style={styles.topGradient} />

        {/* ── Progress bar ── */}
        <View style={styles.progressContainer}>
          {group.posts.map((_, i) => (
            <View key={i} style={[styles.progressTrack, { flex: 1 }]}>
              {i < postIdx ? (
                // Completed
                <View style={[styles.progressFill, { width: '100%' }]} />
              ) : i === postIdx ? (
                // Current — animated
                <Animated.View style={[styles.progressFill, progressStyle]} />
              ) : null /* Future — empty track */}
            </View>
          ))}
        </View>

        {/* ── Author header ── */}
        <View style={styles.authorRow}>
          <Avatar
            id={author.id}
            displayName={author.display_name}
            uri={author.avatar_url}
            size="sm"
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.authorName}>{author.display_name}</Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
          <Pressable
            onPress={() =>
              likePost.mutate({ postId: post.id, liked: !post.viewer_has_liked })
            }
            hitSlop={12}
            style={{ padding: 6 }}
          >
            <Heart
              size={22}
              color="#FFFFFF"
              fill={post.viewer_has_liked ? '#FFFFFF' : 'transparent'}
            />
          </Pressable>
          <Pressable
            onPress={() => setCommentsVisible(true)}
            hitSlop={12}
            style={{ padding: 6 }}
          >
            <MessageCircle size={22} color="#FFFFFF" />
          </Pressable>
          {/* Share link */}
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(`hangoutplanner://post/${post.id}`);
              toast.success('Link copied!');
            }}
            hitSlop={12}
            style={{ padding: 6 }}
          >
            <Share2 size={20} color="#FFFFFF" />
          </Pressable>

          {/* Delete (own posts only) */}
          {post.author_id === user?.id && (
            <Pressable
              onPress={() =>
                Alert.alert('Delete post?', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      deletePost.mutate(post.id, { onSuccess: goNextPost });
                    },
                  },
                ])
              }
              hitSlop={12}
              style={{ padding: 6 }}
            >
              <MoreHorizontal size={22} color="#FFFFFF" />
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 6 }}>
            <X size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* ── Tap zones — left (prev) / right (next) ── */}
        {/* onPressIn/Out handles hold-to-pause without triggering iOS context menu */}
        <View style={styles.tapZones} pointerEvents="box-none">
          <Pressable
            style={styles.tapLeft}
            onPress={goPrevPost}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          />
          <Pressable
            style={styles.tapRight}
            onPress={goNextPost}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          />
        </View>

        {/* ── Caption ── */}
        {post.caption ? (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>{post.caption}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Comments sheet ── */}
      <Modal
        visible={commentsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCommentsVisible(false)}
      >
        <View style={[{ flex: 1 }, { backgroundColor: theme.colors.bg.canvas }]}>
          <CommentsSheet postId={post.id} postAuthorId={post.author_id} />
        </View>
      </Modal>
    </Modal>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const STATUS_BAR_H = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight ?? 0);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    // Simple dark-to-transparent via opacity layers
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  progressContainer: {
    position: 'absolute',
    top: STATUS_BAR_H + 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 3,
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  authorRow: {
    position: 'absolute',
    top: STATUS_BAR_H + 22,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timeAgo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    top: STATUS_BAR_H + 80, // below header
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 2,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    right: 16,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  commentsSheet: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
});
