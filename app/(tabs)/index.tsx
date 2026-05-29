import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Platform,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { Compass, UtensilsCrossed, ChevronRight, Map, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useMyProfile } from '@/features/profile';
import { useMyHangouts } from '@/features/hangouts';
import { SectionHeader } from '@/components/ui';
import { HomeFab } from '@/components/HomeFab';
import { useFeedPosts } from '@/features/feed/hooks/useFeedPosts';
import { FeedCard } from '@/features/feed/components/FeedCard';
import type { Hangout } from '@/features/hangouts';
import type { FeedPostWithUrl } from '@/features/feed';

const TAB_BAR_HIDDEN: object = { display: 'none' };

export default function HomeTab(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const profile = useMyProfile();
  const hangouts = useMyHangouts();
  const feedPosts = useFeedPosts();

  const greetingName = profile.data?.display_name?.split(' ')[0] ?? 'there';
  const upcoming = (hangouts.data ?? [])
    .filter((h) => h.status !== 'cancelled')
    .slice(0, 3);

  const lastScrollY = useRef(0);
  const tabBarShown = useRef(true);
  const [fabVisible, setFabVisible] = useState(true);

  const tabBarStyle = {
    backgroundColor: theme.colors.bg.canvas,
    borderTopColor: theme.colors.border.default,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === 'ios' ? 84 : 60,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0,
  };

  // Restore tab bar when leaving this screen
  useEffect(() => {
    return () => {
      (navigation as any).setOptions({ tabBarStyle });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  function showTabBar() {
    if (!tabBarShown.current) {
      tabBarShown.current = true;
      (navigation as any).setOptions({ tabBarStyle });
    }
  }

  function hideTabBar() {
    if (tabBarShown.current) {
      tabBarShown.current = false;
      (navigation as any).setOptions({ tabBarStyle: TAB_BAR_HIDDEN });
    }
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastScrollY.current;
    if (dy > 10 && y > 80) {
      setFabVisible(false);
      hideTabBar();
    } else if (dy < -10 || y < 20) {
      setFabVisible(true);
      showTabBar();
    }
    lastScrollY.current = y;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {/* Nav header */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: insets.top + 4,
            backgroundColor: theme.colors.bg.canvas,
          },
        ]}
      >
        <Text style={[theme.typography.h2, { color: theme.colors.text.primary, letterSpacing: -0.5 }]}>
          Hangout
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/explore')}
          hitSlop={12}
          style={[styles.navIconBtn, { backgroundColor: theme.colors.bg.subtle }]}
          accessibilityLabel="Explore places"
        >
          <Map size={20} color={theme.colors.text.primary} strokeWidth={1.5} />
        </Pressable>
      </View>

      {/* Main feed */}
      <FlatList<FeedPostWithUrl>
        data={feedPosts.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FeedCard post={item} />}
        ListHeaderComponent={
          <HomeHeader
            greetingName={greetingName}
            upcoming={upcoming}
            hasPosts={(feedPosts.data?.length ?? 0) > 0}
            theme={theme}
          />
        }
        ListEmptyComponent={
          feedPosts.isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center' }]}>
                No posts yet.{'\n'}Add friends to see their photos here, or tap the camera to share a moment.
              </Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={feedPosts.isRefetching && !feedPosts.isLoading}
            onRefresh={() => feedPosts.refetch()}
            tintColor={theme.colors.accent}
          />
        }
      />

      <HomeFab visible={fabVisible} />
    </View>
  );
}

function HomeHeader({
  greetingName,
  upcoming,
  hasPosts,
  theme,
}: {
  greetingName: string;
  upcoming: Hangout[];
  hasPosts: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.headerBlock}>
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={[theme.typography.h2, { color: theme.colors.text.primary, letterSpacing: -0.3 }]}>
          Hey {greetingName} 👋
        </Text>
        <Text
          style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 3 }]}
        >
          What's the plan?
        </Text>
      </View>

      {/* Hero: Plan a hangout */}
      <View style={styles.heroSection}>
        <HeroPlanCard onPress={() => router.push('/hangout/new')} theme={theme} />
      </View>

      {/* Upcoming hangouts */}
      {upcoming.length > 0 && (
        <View style={styles.upcomingSection}>
          <SectionHeader
            title="Upcoming"
            actionLabel="See all"
            onAction={() => router.push('/(tabs)/hangouts')}
          />
          <View style={{ gap: 6 }}>
            {upcoming.map((h) => (
              <UpcomingRow key={h.id} hangout={h} theme={theme} />
            ))}
          </View>
        </View>
      )}

      {/* Feed divider */}
      {hasPosts && (
        <View style={styles.feedHeader}>
          <View style={[styles.feedDividerLine, { backgroundColor: theme.colors.border.default }]} />
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, fontWeight: '600', letterSpacing: 0.5 }]}>
            FROM FRIENDS
          </Text>
          <View style={[styles.feedDividerLine, { backgroundColor: theme.colors.border.default }]} />
        </View>
      )}
    </View>
  );
}

function UpcomingRow({
  hangout,
  theme,
}: {
  hangout: Hangout;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const d = hangout.start_time ? new Date(hangout.start_time) : null;
  const dayNum = d
    ? d.toLocaleDateString('en-US', { day: 'numeric' })
    : null;
  const monthAbbr = d
    ? d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    : null;
  const weekday = d
    ? d.toLocaleDateString('en-US', { weekday: 'short' })
    : null;

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => router.push(`/hangout/${hangout.id}`)}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.cubic) });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        style={[
          styles.upcomingRow,
          {
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
            ...(theme.mode === 'light'
              ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }
              : {}),
          },
        ]}
      >
        {/* Date badge */}
        {d ? (
          <View style={[styles.dateBadge, { backgroundColor: theme.colors.accent + '14' }]}>
            <Text style={[styles.dateBadgeMonth, { color: theme.colors.accent }]}>{monthAbbr}</Text>
            <Text style={[styles.dateBadgeDay, { color: theme.colors.accent }]}>{dayNum}</Text>
          </View>
        ) : (
          <View style={[styles.dateBadge, { backgroundColor: theme.colors.bg.subtle }]}>
            <Text style={[styles.dateBadgeMonth, { color: theme.colors.text.tertiary }]}>TBD</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}
            numberOfLines={1}
          >
            {hangout.title}
          </Text>
          {weekday && dayNum ? (
            <Text
              style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 1 }]}
            >
              {weekday}
              {hangout.primary_location_name ? ` · ${hangout.primary_location_name}` : ''}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={theme.colors.text.tertiary} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

function HeroPlanCard({
  onPress,
  theme,
}: {
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 80, easing: Easing.out(Easing.cubic) }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
        style={[styles.heroPlanCard, { backgroundColor: theme.colors.accent }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.h2, { color: '#FFFFFF', fontWeight: '800' }]}>
            Plan a hangout
          </Text>
          <Text style={[theme.typography.body, { color: 'rgba(255,255,255,0.75)', marginTop: 4 }]}>
            Date, place, food, activities — all in one
          </Text>
        </View>
        <View style={styles.heroPlusWrap}>
          <Plus size={26} color={theme.colors.accent} strokeWidth={2.5} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Tile({
  icon,
  iconBg,
  title,
  onPress,
  theme,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}): React.ReactElement {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animStyle, { flex: 1 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 100, easing: Easing.out(Easing.cubic) });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        style={[
          styles.tile,
          {
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
            ...(theme.mode === 'light'
              ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }
              : {}),
          },
        ]}
      >
        <View style={[styles.tileIconWrap, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.primary, marginTop: 10, fontWeight: '600', lineHeight: 16 },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    paddingBottom: 8,
  },
  greeting: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heroSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  heroPlanCard: {
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroPlusWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSection: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  tileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dateBadgeMonth: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  dateBadgeDay: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 10,
  },
  feedDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
  },
});
