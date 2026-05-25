import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  Share,
  ActionSheetIOS,
  Platform,
  type GestureResponderEvent,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Bookmark,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { toast } from '@/stores/ui.store';
import { useDeletePost } from '../hooks/useDeletePost';
import { useMakePostPermanent } from '../hooks/useMakePostPermanent';
import { useReactToPost } from '../hooks/useReactToPost';
import { CommentsSheet } from './CommentsSheet';
import type { FeedPostWithUrl } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const MAX_IMG_HEIGHT = SCREEN_W * 1.25;
const POST_LINK_BASE = 'hangoutplanner://post';

interface Props {
  post: FeedPostWithUrl;
}

export function FeedCard({ post }: Props): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const deletePost = useDeletePost();
  const makePermanent = useMakePostPermanent();
  const reactToPost = useReactToPost();
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const author = post.author;
  const isOwn = post.author_id === user?.id;
  const timeAgo = formatTimeAgo(post.created_at);
  const urls = post.image_urls ?? [post.image_url];
  const isEphemeral = isOwn && post.expires_at != null;
  const expiresIn = isEphemeral ? getExpiresIn(post.expires_at!) : null;

  const imgHeight =
    post.width && post.height
      ? Math.min((SCREEN_W * post.height) / post.width, MAX_IMG_HEIGHT)
      : SCREEN_W;

  const liked = post.viewer_has_liked ?? false;
  const heartScale = useSharedValue(1);
  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));
  const commentScale = useSharedValue(1);
  const commentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: commentScale.value }],
  }));
  const shareScale = useSharedValue(1);
  const shareAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shareScale.value }],
  }));

  function pressIn(sv: SharedValue<number>) {
    sv.value = withTiming(0.82, { duration: 90, easing: Easing.out(Easing.cubic) });
  }
  function pressOut(sv: SharedValue<number>) {
    sv.value = withSpring(1, { damping: 12, stiffness: 380 });
  }

  function handleHeartTap() {
    if (!liked) {
      heartScale.value = withSequence(
        withSpring(1.35, { damping: 5, stiffness: 450 }),
        withSpring(1, { damping: 14, stiffness: 300 }),
      );
    }
    reactToPost.mutate({ postId: post.id, reactionType: 'heart', currentReaction: liked ? 'heart' : null });
  }

  async function handleShare() {
    const link = `${POST_LINK_BASE}/${post.id}`;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Copy link', 'Share via…'],
          cancelButtonIndex: 0,
        },
        async (idx) => {
          if (idx === 1) {
            await Clipboard.setStringAsync(link);
            toast.success('Link copied!');
          } else if (idx === 2) {
            await Share.share({ url: link, message: link });
          }
        },
      );
    } else {
      // Android: native share sheet directly
      await Share.share({ message: link });
    }
  }

  return (
    <View style={styles.card}>
      {/* ── Author row ── */}
      <View style={styles.authorRow}>
        <Pressable
          onPress={() => router.push(`/profile/${post.author_id}`)}
          style={styles.authorTouchable}
          hitSlop={4}
        >
          <Avatar
            id={author?.id ?? ''}
            displayName={author?.display_name ?? ''}
            uri={author?.avatar_url ?? null}
            size="sm"
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              {author?.display_name ?? ''}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
              {timeAgo}
              {isEphemeral && expiresIn ? ` · disappears in ${expiresIn}` : ''}
            </Text>
          </View>
        </Pressable>
        {isOwn && (
          <Pressable
            onPress={() =>
              Alert.alert('Post options', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deletePost.mutate(post.id),
                },
              ])
            }
            hitSlop={12}
          >
            <MoreHorizontal size={20} color={theme.colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {/* ── Photo carousel ── */}
      <PhotoCarousel
        urls={urls}
        imgHeight={imgHeight}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        isEphemeral={isEphemeral}
        isPermanentPending={makePermanent.isPending}
        onDoubleTap={handleHeartTap}
        onKeepForever={() =>
          Alert.alert(
            'Keep on profile?',
            'This photo will stay on your profile permanently instead of disappearing.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Keep forever', onPress: () => makePermanent.mutate(post.id) },
            ],
          )
        }
      />

      {/* ── Action bar ── */}
      <View style={styles.actions}>
        <Pressable
          onPress={handleHeartTap}
          onPressIn={() => pressIn(heartScale)}
          onPressOut={() => pressOut(heartScale)}
          hitSlop={10}
          style={styles.actionBtn}
        >
          <Reanimated.View style={heartAnimStyle}>
            <Heart
              size={26}
              color={liked ? '#EF4444' : theme.colors.text.primary}
              fill={liked ? '#EF4444' : 'transparent'}
            />
          </Reanimated.View>
          {(post.like_count ?? 0) > 0 && (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.secondary, marginLeft: 5, fontWeight: '600' },
              ]}
            >
              {post.like_count}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setCommentsVisible(true)}
          onPressIn={() => pressIn(commentScale)}
          onPressOut={() => pressOut(commentScale)}
          hitSlop={10}
          style={styles.actionBtn}
        >
          <Reanimated.View style={commentAnimStyle}>
            <MessageCircle size={26} color={theme.colors.text.primary} />
          </Reanimated.View>
          {(post.comment_count ?? 0) > 0 && (
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.text.secondary, marginLeft: 5, fontWeight: '600' },
              ]}
            >
              {post.comment_count}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleShare}
          onPressIn={() => pressIn(shareScale)}
          onPressOut={() => pressOut(shareScale)}
          hitSlop={10}
          style={styles.actionBtn}
        >
          <Reanimated.View style={shareAnimStyle}>
            <Share2 size={24} color={theme.colors.text.primary} />
          </Reanimated.View>
        </Pressable>
      </View>

      {/* ── Caption ── */}
      {post.caption ? (
        <View style={styles.captionRow}>
          <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
            <Text
              style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
              onPress={() => router.push(`/profile/${post.author_id}`)}
            >
              {author?.display_name}{' '}
            </Text>
            {post.caption}
          </Text>
        </View>
      ) : null}

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
    </View>
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

function getExpiresIn(iso: string): string | null {
  const msLeft = new Date(iso).getTime() - Date.now();
  if (msLeft <= 0) return null;
  const hrs = Math.floor(msLeft / 3_600_000);
  if (hrs >= 1) return `${hrs}h`;
  const mins = Math.floor(msLeft / 60_000);
  return `${mins}m`;
}

// ── PhotoCarousel ─────────────────────────────────────────────────────────────
// Single-tap left third → prev photo. Single-tap right → next photo.
// Double-tap anywhere → like + heart burst animation.

const HEART_SIZE = 90;

type CarouselProps = {
  urls: string[];
  imgHeight: number;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  isEphemeral: boolean;
  isPermanentPending: boolean;
  onDoubleTap: () => void;
  onKeepForever: () => void;
};

function PhotoCarousel({
  urls,
  imgHeight,
  activeIndex,
  setActiveIndex,
  isEphemeral,
  isPermanentPending,
  onDoubleTap,
  onKeepForever,
}: CarouselProps) {
  const [fromIndex, setFromIndex] = useState<number | null>(null);
  const [toIndex, setToIndex] = useState(activeIndex);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dirAnim = useRef(new Animated.Value(0)).current;

  // Double-tap detection
  const lastTapAt = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Heart burst animation
  const [heartPos, setHeartPos] = useState({ x: SCREEN_W / 2, y: imgHeight / 2 });
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (activeIndex === toIndex) return;
    const dir = activeIndex > toIndex ? 1 : -1;

    dirAnim.setValue(-dir * SCREEN_W);
    setFromIndex(toIndex);
    setToIndex(activeIndex);
    slideAnim.setValue(dir * SCREEN_W);

    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 20,
    }).start(({ finished }) => {
      if (finished) {
        setFromIndex(null);
        slideAnim.setValue(0);
      }
    });
  }, [activeIndex]);

  function showHeartBurst(x: number, y: number) {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setHeartPos({ x, y });

    // Reset then spring in with overshoot (same feel as the FAB icon rotation)
    heartScale.value = 0;
    heartOpacity.value = 0;
    heartScale.value = withSpring(1, { damping: 4, stiffness: 260 });
    heartOpacity.value = withTiming(1, { duration: 80 });

    // Fade out after 850ms
    fadeTimer.current = setTimeout(() => {
      heartScale.value = withTiming(0.7, { duration: 380, easing: Easing.in(Easing.cubic) });
      heartOpacity.value = withTiming(0, { duration: 380 });
    }, 850);
  }

  function handleTap(e: GestureResponderEvent) {
    const now = Date.now();
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;

    if (now - lastTapAt.current < 300) {
      // Double-tap
      lastTapAt.current = 0;
      showHeartBurst(x, y);
      onDoubleTap();
    } else {
      lastTapAt.current = now;
      // Navigate photos on single-tap
      if (urls.length > 1) {
        if (x < SCREEN_W * 0.35 && activeIndex > 0) {
          setActiveIndex(activeIndex - 1);
        } else if (x >= SCREEN_W * 0.35 && activeIndex < urls.length - 1) {
          setActiveIndex(activeIndex + 1);
        }
      }
    }
  }

  return (
    <View style={{ width: SCREEN_W, height: imgHeight, overflow: 'hidden' }}>
      {/* Outgoing image slides away */}
      {fromIndex !== null && (
        <Animated.Image
          source={{ uri: urls[fromIndex]! }}
          style={{
            position: 'absolute',
            width: SCREEN_W,
            height: imgHeight,
            transform: [{ translateX: Animated.add(slideAnim, dirAnim) }],
          }}
          resizeMode="cover"
        />
      )}

      {/* Incoming image */}
      <Animated.Image
        source={{ uri: urls[toIndex]! }}
        style={{
          width: SCREEN_W,
          height: imgHeight,
          transform: [{ translateX: slideAnim }],
        }}
        resizeMode="cover"
      />

      {/* Full-area tap handler — handles both nav and double-tap */}
      <Pressable onPress={handleTap} style={StyleSheet.absoluteFill} />

      {/* Heart burst overlay — pointerEvents none so it doesn't block taps */}
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.heartBurst,
          {
            left: heartPos.x - HEART_SIZE / 2,
            top: heartPos.y - HEART_SIZE / 2,
          },
          heartAnimStyle,
        ]}
      >
        <Heart size={HEART_SIZE} color="#fff" fill="#fff" />
      </Reanimated.View>

      {/* Keep on profile overlay — rendered AFTER the full-area Pressable, so it captures its own taps */}
      {isEphemeral && (
        <Pressable
          onPress={onKeepForever}
          disabled={isPermanentPending}
          style={styles.keepOverlay}
        >
          <Bookmark size={14} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.keepText}>
            {isPermanentPending ? 'Saving…' : 'Keep on profile'}
          </Text>
        </Pressable>
      )}

      {/* Dot indicators */}
      {urls.length > 1 && (
        <View pointerEvents="none" style={styles.dots}>
          {urls.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                  width: i === activeIndex ? 8 : 6,
                  height: i === activeIndex ? 8 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Count badge */}
      {urls.length > 1 && (
        <View pointerEvents="none" style={styles.countBadge}>
          <Text style={styles.countText}>{activeIndex + 1}/{urls.length}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  authorTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  heartBurst: {
    position: 'absolute',
    width: HEART_SIZE,
    height: HEART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  keepText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    width: SCREEN_W,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    borderRadius: 4,
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 18,
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  captionRow: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
});
