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
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Bookmark,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
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

  function handleHeartTap() {
    if (!liked) {
      heartScale.value = withSequence(
        withSpring(1.3, { damping: 6, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 300 }),
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
        <Pressable onPress={handleHeartTap} hitSlop={8} style={styles.actionBtn}>
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

        <Pressable onPress={() => setCommentsVisible(true)} hitSlop={8} style={styles.actionBtn}>
          <MessageCircle size={26} color={theme.colors.text.primary} />
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

        <Pressable onPress={handleShare} hitSlop={8} style={styles.actionBtn}>
          <Share2 size={24} color={theme.colors.text.primary} />
        </Pressable>
      </View>

      {/* ── Caption ── */}
      {post.caption ? (
        <View style={styles.captionRow}>
          <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
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
// Tap the left third → previous photo. Tap the right third → next photo.
// No gesture library needed — zero conflicts with parent scroll views.

type CarouselProps = {
  urls: string[];
  imgHeight: number;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  isEphemeral: boolean;
  isPermanentPending: boolean;
  onKeepForever: () => void;
};

function PhotoCarousel({
  urls,
  imgHeight,
  activeIndex,
  setActiveIndex,
  isEphemeral,
  isPermanentPending,
  onKeepForever,
}: CarouselProps) {
  const [fromIndex, setFromIndex] = useState<number | null>(null);
  const [toIndex, setToIndex] = useState(activeIndex);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dirAnim = useRef(new Animated.Value(0)).current;

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < urls.length - 1;

  useEffect(() => {
    if (activeIndex === toIndex) return;
    const dir = activeIndex > toIndex ? 1 : -1;

    dirAnim.setValue(-dir * SCREEN_W); // outgoing image offset
    setFromIndex(toIndex);
    setToIndex(activeIndex);
    slideAnim.setValue(dir * SCREEN_W); // incoming starts off-screen

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

      {/* Incoming image slides in */}
      <Animated.Image
        source={{ uri: urls[toIndex]! }}
        style={{
          width: SCREEN_W,
          height: imgHeight,
          transform: [{ translateX: slideAnim }],
        }}
        resizeMode="cover"
      />

      {/* Tap zones — only rendered when there are multiple photos */}
      {urls.length > 1 && (
        <>
          <Pressable
            onPress={() => canGoPrev && setActiveIndex(activeIndex - 1)}
            style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: SCREEN_W * 0.35 }}
          />
          <Pressable
            onPress={() => canGoNext && setActiveIndex(activeIndex + 1)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: SCREEN_W * 0.65 }}
          />
        </>
      )}

      {/* Keep on profile overlay — must be AFTER tap zones so it gets taps */}
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
        <View style={styles.dots}>
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
        <View style={styles.countBadge}>
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
