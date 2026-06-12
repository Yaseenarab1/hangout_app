import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Settings as SettingsIcon,
  Pencil,
  Grid3x3,
  Camera,
  ChevronRight,
  Heart,
  MessageCircle,
  Receipt,
  X,
  Timer,
  Utensils,
} from 'lucide-react-native';

import { Avatar, Card, Skeleton } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useMyProfile } from '@/features/profile';
import { useSession } from '@/features/auth';
import { useFriends } from '@/features/friends';
import { useMyHangouts } from '@/features/hangouts';
import { useAuthorAllPosts } from '@/features/feed/hooks/useFeedPosts';
import { FeedCard } from '@/features/feed/components/FeedCard';
import { useMyRatings, useMyMediaRatings, RateRestaurantSheet, RestaurantRatingCard, MediaRatingCard } from '@/features/ratings';
import type { RestaurantRating, MediaRating } from '@/features/ratings';
import type { FeedPostWithUrl } from '@/features/feed';

const CELL_SIZE = Math.floor(Dimensions.get('window').width / 3);

export default function ProfileTab(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const profile = useMyProfile();
  const friends = useFriends();
  const hangouts = useMyHangouts();
  const authorAllPosts = useAuthorAllPosts(user?.id);
  const [selectedPost, setSelectedPost] = useState<FeedPostWithUrl | null>(null);
  const [showRateSheet, setShowRateSheet] = useState(false);
  const listRef = useRef<FlatList<FeedPostWithUrl>>(null);
  const myRatings = useMyRatings();
  const myMediaRatings = useMyMediaRatings();

  // Merge place + media ratings sorted by date
  const allRatings = useMemo(() => {
    const places = (myRatings.data ?? []).map((r) => ({ ...r, _kind: 'place' as const }));
    const media = (myMediaRatings.data ?? []).map((r) => ({ ...r, _kind: 'media' as const }));
    return [...places, ...media].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [myRatings.data, myMediaRatings.data]);

  const p = profile.data;
  const allPosts = authorAllPosts.data ?? [];
  const permanentPosts = allPosts.filter((p) => p.expires_at === null);
  const expiringPosts = allPosts.filter((p) => p.expires_at !== null);

  const friendCount = friends.data?.length ?? 0;
  const postCount = permanentPosts.length;
  const hangoutCount = hangouts.data?.length ?? 0;

  const ListHeader = (
    <View>
      {/* ── Nav bar ── */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: insets.top + 4,
            borderBottomColor: theme.colors.border.default,
            backgroundColor: theme.colors.bg.canvas,
          },
        ]}
      >
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {p?.username ? `@${p.username}` : 'Profile'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            onPress={() => router.push('/post/new')}
            hitSlop={12}
            style={{ padding: 6 }}
            accessibilityLabel="New post"
          >
            <Camera size={22} color={theme.colors.text.primary} strokeWidth={1.5} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/profile/settings')}
            hitSlop={12}
            style={{ padding: 6 }}
            accessibilityLabel="Settings"
          >
            <SettingsIcon size={22} color={theme.colors.text.primary} strokeWidth={1.5} />
          </Pressable>
        </View>
      </View>

      {/* ── Hero ── */}
      {profile.isLoading ? (
        <View style={styles.hero}>
          <Skeleton width={56} height={56} radius={28} />
          <Skeleton width={160} height={22} style={{ marginTop: 14 }} />
          <Skeleton width={100} height={14} style={{ marginTop: 6 }} />
        </View>
      ) : p ? (
        <View style={styles.hero}>
          <Avatar id={p.id} displayName={p.display_name} uri={p.avatar_url} size="lg" />
          <Text
            style={[theme.typography.h2, { color: theme.colors.text.primary, marginTop: 14 }]}
          >
            {p.display_name}
          </Text>
          <Text
            style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 3 }]}
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
                  marginTop: 10,
                  paddingHorizontal: 24,
                },
              ]}
            >
              {p.bio}
            </Text>
          ) : null}

          {/* ── Stats: Posts | Friends ── */}
          <View style={styles.statsRow}>
            <StatPill value={postCount} label="Posts" />
            <View style={styles.statDivider} />
            <StatPill
              value={friendCount}
              label="Friends"
              onPress={() => router.push('/(tabs)/friends')}
            />
          </View>

          {/* ── Edit profile ── */}
          <Pressable
            onPress={() => router.push('/profile/edit')}
            style={({ pressed }) => [
              styles.editBtn,
              {
                borderColor: theme.colors.border.default,
                backgroundColor: pressed ? theme.colors.bg.subtle : theme.colors.bg.canvas,
              },
            ]}
          >
            <Pencil size={14} color={theme.colors.text.primary} strokeWidth={2} />
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              Edit profile
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Bills card ── */}
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Pressable
          onPress={() => router.push('/profile/bills')}
          style={({ pressed }) => [
            styles.billsCard,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <View style={[styles.billsIconWrap, { backgroundColor: theme.colors.accentSubtle }]}>
            <Receipt size={20} color={theme.colors.accent} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              My Bills
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
              Split &amp; track shared expenses
            </Text>
          </View>
          <ChevronRight size={16} color={theme.colors.text.tertiary} />
        </Pressable>
      </View>

      {/* ── My Ratings ── */}
      <View style={{ marginBottom: 20 }}>
        {/* Section header */}
        <View style={[styles.ratingsSectionHeader, { paddingHorizontal: 16 }]}>
          <View style={styles.ratingsSectionLeft}>
            <View style={[styles.ratingsIconWrap, { backgroundColor: '#EDE9FE' }]}>
              <Utensils size={16} color="#8B5CF6" strokeWidth={1.5} />
            </View>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              My ratings
            </Text>
          </View>
          <Pressable
            onPress={() => setShowRateSheet(true)}
            hitSlop={12}
            style={({ pressed }) => [styles.ratingsAction, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[theme.typography.caption, { color: '#8B5CF6', fontWeight: '600' }]}>
              Add a rating →
            </Text>
          </Pressable>
        </View>

        {/* Horizontal list — places + movies combined */}
        {(myRatings.isLoading || myMediaRatings.isLoading) ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Skeleton width={260} height={80} radius={16} />
          </View>
        ) : allRatings.length > 0 ? (
          <>
            <FlatList
              horizontal
              data={allRatings.slice(0, 20)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) =>
                item._kind === 'media'
                  ? <MediaRatingCard rating={item as MediaRating} />
                  : <RestaurantRatingCard rating={item as RestaurantRating} />
              }
              ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
              showsHorizontalScrollIndicator={false}
            />
            {allRatings.length > 3 && (
              <Pressable onPress={() => router.push('/ratings')} hitSlop={8} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                <Text style={[theme.typography.caption, { color: '#8B5CF6', fontWeight: '600' }]}>
                  See all {allRatings.length} →
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <Pressable
            onPress={() => setShowRateSheet(true)}
            style={({ pressed }) => [
              styles.ratingsEmpty,
              { marginHorizontal: 16, backgroundColor: '#EDE9FE', borderRadius: 14, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={{ fontSize: 24 }}>⭐</Text>
            <Text style={[theme.typography.body, { color: '#8B5CF6', marginTop: 6, fontWeight: '600' }]}>
              Rate places & movies
            </Text>
            <Text style={[theme.typography.caption, { color: '#6D28D9', marginTop: 2 }]}>
              Track what you love so friends know what to pick
            </Text>
          </Pressable>
        )}
      </View>


      {/* ── Grid header ── */}
      <View
        style={[
          styles.gridHeader,
          {
            borderTopColor: theme.colors.border.default,
            borderBottomColor: theme.colors.border.default,
          },
        ]}
      >
        <Grid3x3 size={18} color={theme.colors.accent} />
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.secondary, marginLeft: 6, fontWeight: '600', flex: 1 },
          ]}
        >
          {postCount > 0 ? `${postCount} saved` : 'Nothing saved yet'}
        </Text>
        {expiringPosts.length > 0 && (
          <Pressable
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
            hitSlop={12}
            style={[styles.jumpBtn, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default }]}
          >
            <Timer size={12} color={theme.colors.text.secondary} />
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginLeft: 4 }]}>
              {expiringPosts.length} expiring
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      <FlatList<FeedPostWithUrl>
        ref={listRef}
        data={permanentPosts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => <GridThumb item={item} onPress={setSelectedPost} />}
        ListEmptyComponent={
          authorAllPosts.isLoading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Camera size={36} color={theme.colors.text.tertiary} strokeWidth={1} />
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.text.secondary, textAlign: 'center', marginTop: 12 },
                ]}
              >
                No saved posts yet.{'\n'}Toggle "Keep on profile" when posting.
              </Text>
              <Pressable
                onPress={() => router.push('/post/new')}
                style={[styles.firstPostBtn, { backgroundColor: theme.colors.accent }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                  Share a photo
                </Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          expiringPosts.length > 0 ? (
            <ExpiringSection posts={expiringPosts} onPress={setSelectedPost} theme={theme} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      />

      <RateRestaurantSheet visible={showRateSheet} onClose={() => setShowRateSheet(false)} />

      {/* Post detail modal */}
      {selectedPost && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedPost(null)}
        >
          <View style={[styles.postModal, { backgroundColor: theme.colors.bg.canvas }]}>
            <View style={[styles.postModalHeader, { borderBottomColor: theme.colors.border.default }]}>
              <Pressable onPress={() => setSelectedPost(null)} hitSlop={12} style={{ padding: 4 }}>
                <X size={22} color={theme.colors.text.primary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <FeedCard post={selectedPost} />
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

function GridThumb({
  item,
  onPress,
}: {
  item: FeedPostWithUrl;
  onPress: (post: FeedPostWithUrl) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.85 }]}
    >
      <Image source={{ uri: item.image_url }} style={styles.gridImage} resizeMode="cover" />

      {/* Like + comment overlay */}
      {((item.like_count ?? 0) > 0 || (item.comment_count ?? 0) > 0) && (
        <View style={styles.gridOverlay}>
          {(item.like_count ?? 0) > 0 && (
            <View style={styles.gridStat}>
              <Heart size={11} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.gridStatText}>{item.like_count}</Text>
            </View>
          )}
          {(item.comment_count ?? 0) > 0 && (
            <View style={styles.gridStat}>
              <MessageCircle size={11} color="#FFFFFF" />
              <Text style={styles.gridStatText}>{item.comment_count}</Text>
            </View>
          )}
        </View>
      )}

      {(item.image_urls?.length ?? 1) > 1 && (
        <View style={styles.multiIndicator}>
          <Grid3x3 size={10} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

function ExpiringSection({
  posts,
  onPress,
  theme,
}: {
  posts: FeedPostWithUrl[];
  onPress: (post: FeedPostWithUrl) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View>
      {/* Section header */}
      <View
        style={[
          styles.gridHeader,
          {
            borderTopColor: theme.colors.border.default,
            borderBottomColor: theme.colors.border.default,
            marginTop: 8,
          },
        ]}
      >
        <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, fontWeight: '600' }]}>
          Disappearing soon
        </Text>
      </View>

      {/* Horizontal scroll row */}
      <View style={styles.expiringRow}>
        {posts.map((item) => {
          const msLeft = item.expires_at ? new Date(item.expires_at).getTime() - Date.now() : 0;
          const hrsLeft = Math.max(0, Math.floor(msLeft / 3_600_000));
          const minsLeft = Math.max(0, Math.floor((msLeft % 3_600_000) / 60_000));
          const label = hrsLeft >= 1 ? `${hrsLeft}h` : `${minsLeft}m`;

          return (
            <Pressable
              key={item.id}
              onPress={() => onPress(item)}
              style={({ pressed }) => [styles.expiringItem, pressed && { opacity: 0.8 }]}
            >
              <Image
                source={{ uri: item.image_url }}
                style={styles.expiringImage}
                resizeMode="cover"
              />
              {/* Timer badge */}
              <View style={[styles.timerBadge, { backgroundColor: theme.colors.bg.canvas }]}>
                <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, fontSize: 10 }]}>
                  {label}
                </Text>
              </View>
              {/* Like/comment overlay */}
              {((item.like_count ?? 0) > 0 || (item.comment_count ?? 0) > 0) && (
                <View style={[styles.gridOverlay, { borderRadius: 10 }]}>
                  {(item.like_count ?? 0) > 0 && (
                    <View style={styles.gridStat}>
                      <Heart size={10} color="#FFFFFF" fill="#FFFFFF" />
                      <Text style={styles.gridStatText}>{item.like_count}</Text>
                    </View>
                  )}
                  {(item.comment_count ?? 0) > 0 && (
                    <View style={styles.gridStat}>
                      <MessageCircle size={10} color="#FFFFFF" />
                      <Text style={styles.gridStatText}>{item.comment_count}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}


function StatPill({
  value,
  label,
  onPress,
}: {
  value: number | null;
  label: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.statPill, pressed && onPress ? { opacity: 0.6 } : undefined]}
    >
      {value !== null && (
        <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>{value}</Text>
      )}
      <Text
        style={[
          theme.typography.caption,
          {
            color: onPress ? theme.colors.accent : theme.colors.text.secondary,
            fontWeight: onPress ? '600' : '400',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  statPill: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 9,
    marginTop: 16,
  },
  billsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  billsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  jumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gridItem: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridStatText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  multiIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  firstPostBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  postModal: {
    flex: 1,
  },
  postModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ratingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  ratingsSectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingsIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingsAction: {
    paddingVertical: 4,
  },
  ratingsEmpty: {
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  expiringRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 2,
  },
  expiringItem: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    padding: 2,
  },
  expiringImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  timerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    opacity: 0.9,
  },
});
