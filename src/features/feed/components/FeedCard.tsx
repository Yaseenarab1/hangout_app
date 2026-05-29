import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
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
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const REELS_HEIGHT = Math.floor(SCREEN_H * 0.78);
const HEART_SIZE = 90;
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
        { options: ['Cancel', 'Copy link', 'Share via…'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) { await Clipboard.setStringAsync(link); toast.success('Link copied!'); }
          else if (idx === 2) { await Share.share({ url: link, message: link }); }
        },
      );
    } else {
      await Share.share({ message: link });
    }
  }

  return (
    <View style={styles.card}>
      {/* ── Photo carousel (full-height, Reels style) ── */}
      <PhotoCarousel
        urls={urls}
        height={REELS_HEIGHT}
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
      >
        {/* ── Bottom scrim so text is readable ── */}
        <View
          pointerEvents="none"
          style={styles.gradientScrim}
        />

        {/* ── Right-side actions (TikTok layout) ── */}
        <View style={styles.actionsCol} pointerEvents="box-none">
          <Pressable
            onPress={handleHeartTap}
            onPressIn={() => pressIn(heartScale)}
            onPressOut={() => pressOut(heartScale)}
            hitSlop={10}
            style={styles.actionItem}
          >
            <Reanimated.View style={heartAnimStyle}>
              <Heart
                size={30}
                color={liked ? '#EF4444' : '#FFFFFF'}
                fill={liked ? '#EF4444' : 'transparent'}
              />
            </Reanimated.View>
            {(post.like_count ?? 0) > 0 && (
              <Text style={styles.actionCount}>{post.like_count}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setCommentsVisible(true)}
            onPressIn={() => pressIn(commentScale)}
            onPressOut={() => pressOut(commentScale)}
            hitSlop={10}
            style={styles.actionItem}
          >
            <Reanimated.View style={commentAnimStyle}>
              <MessageCircle size={28} color="#FFFFFF" />
            </Reanimated.View>
            {(post.comment_count ?? 0) > 0 && (
              <Text style={styles.actionCount}>{post.comment_count}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleShare}
            onPressIn={() => pressIn(shareScale)}
            onPressOut={() => pressOut(shareScale)}
            hitSlop={10}
            style={styles.actionItem}
          >
            <Reanimated.View style={shareAnimStyle}>
              <Share2 size={26} color="#FFFFFF" />
            </Reanimated.View>
          </Pressable>

          {isOwn && (
            <Pressable
              onPress={() =>
                Alert.alert('Post options', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deletePost.mutate(post.id) },
                ])
              }
              hitSlop={12}
              style={styles.actionItem}
            >
              <MoreHorizontal size={26} color="#FFFFFF" />
            </Pressable>
          )}
        </View>

        {/* ── Bottom: author + caption ── */}
        <View style={styles.bottomOverlay} pointerEvents="box-none">
          <Pressable
            onPress={() => router.push(`/profile/${post.author_id}`)}
            style={styles.authorRow}
            hitSlop={4}
          >
            <Avatar
              id={author?.id ?? ''}
              displayName={author?.display_name ?? ''}
              uri={author?.avatar_url ?? null}
              size="sm"
            />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.authorName}>{author?.display_name ?? ''}</Text>
              <Text style={styles.authorTime}>
                {timeAgo}
                {isEphemeral && expiresIn ? ` · disappears in ${expiresIn}` : ''}
              </Text>
            </View>
          </Pressable>

          {post.caption ? (
            <Text style={styles.caption} numberOfLines={3}>
              {post.caption}
            </Text>
          ) : null}

          {urls.length > 1 && (
            <View style={styles.dots} pointerEvents="none">
              {urls.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                      width: i === activeIndex ? 8 : 5,
                      height: i === activeIndex ? 8 : 5,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </PhotoCarousel>

      {/* ── Comments sheet ── */}
      <Modal
        visible={commentsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCommentsVisible(false)}
      >
        <View style={[{ flex: 1 }, { backgroundColor: '#09090b' }]}>
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
// Reanimated-based carousel running on the UI thread at 60fps.
// Tap left/right third → navigate. Double-tap → like + heart burst.

type CarouselProps = {
  urls: string[];
  height: number;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  isEphemeral: boolean;
  isPermanentPending: boolean;
  onDoubleTap: () => void;
  onKeepForever: () => void;
  children?: React.ReactNode;
};

function PhotoCarousel({
  urls,
  height,
  activeIndex,
  setActiveIndex,
  isEphemeral,
  isPermanentPending,
  onDoubleTap,
  onKeepForever,
  children,
}: CarouselProps) {
  // Offset in screen-widths. 0 = current, 1 = going right, -1 = going left.
  const offset = useSharedValue(0);

  // Track previous index for cross-fade slide
  const prevIndexRef = useRef(activeIndex);
  const [renderFrom, setRenderFrom] = useState<number | null>(null);
  const [renderTo, setRenderTo] = useState(activeIndex);

  const fromAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(offset.value, [-1, 0, 1], [-SCREEN_W, 0, SCREEN_W]) }],
    position: 'absolute',
    width: SCREEN_W,
    height,
  }));
  const toAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(offset.value, [-1, 0, 1], [0, 0, 0]) }],
    width: SCREEN_W,
    height,
  }));

  const goTo = useCallback((next: number) => {
    if (next === renderTo) return;
    const dir = next > renderTo ? 1 : -1;
    setRenderFrom(renderTo);
    setRenderTo(next);
    offset.value = dir; // start from off-screen
    offset.value = withSpring(0, { damping: 26, stiffness: 280, mass: 0.8 }, (done) => {
      if (done) {
        setRenderFrom(null);
        offset.value = 0;
      }
    });
    setActiveIndex(next);
  }, [renderTo, offset, setActiveIndex]);

  // Double-tap detection
  const lastTapAt = useRef(0);

  // Heart burst
  const [heartPos, setHeartPos] = useState({ x: SCREEN_W / 2, y: height / 2 });
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartBurstStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showHeartBurst(x: number, y: number) {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setHeartPos({ x, y });
    heartScale.value = 0;
    heartOpacity.value = 0;
    heartScale.value = withSpring(1, { damping: 4, stiffness: 260 });
    heartOpacity.value = withTiming(1, { duration: 80 });
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
      lastTapAt.current = 0;
      showHeartBurst(x, y);
      onDoubleTap();
    } else {
      lastTapAt.current = now;
      if (urls.length > 1) {
        if (x < SCREEN_W * 0.35 && renderTo > 0) {
          goTo(renderTo - 1);
        } else if (x >= SCREEN_W * 0.35 && renderTo < urls.length - 1) {
          goTo(renderTo + 1);
        }
      }
    }
  }

  return (
    <View style={{ width: SCREEN_W, height, overflow: 'hidden' }}>
      {/* Current (target) image */}
      <Reanimated.View style={toAnimStyle}>
        <Image source={{ uri: urls[renderTo]! }} style={{ width: SCREEN_W, height }} contentFit="cover" />
      </Reanimated.View>

      {/* Outgoing image slides away */}
      {renderFrom !== null && (
        <Reanimated.View style={fromAnimStyle}>
          <Image source={{ uri: urls[renderFrom]! }} style={{ width: SCREEN_W, height }} contentFit="cover" />
        </Reanimated.View>
      )}

      {/* Overlay children (gradient, actions, author) */}
      {children}

      {/* Keep on profile overlay */}
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

      {/* Heart burst */}
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.heartBurst,
          { left: heartPos.x - HEART_SIZE / 2, top: heartPos.y - HEART_SIZE / 2 },
          heartBurstStyle,
        ]}
      >
        <Heart size={HEART_SIZE} color="#fff" fill="#fff" />
      </Reanimated.View>

      {/* Full-area tap handler */}
      <Pressable onPress={handleTap} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 2,
  },
  gradientScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Math.floor(REELS_HEIGHT * 0.55),
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  actionsCol: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
    gap: 20,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 64,
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  authorTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 1,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  dot: {
    borderRadius: 4,
  },
  keepOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
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
  heartBurst: {
    position: 'absolute',
    width: HEART_SIZE,
    height: HEART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
