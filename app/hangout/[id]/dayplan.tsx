import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
import { AlertCircle, Plus, ArrowLeft, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import {
  useDayPlans,
  useDayPlan,
  useCreateDayPlan,
  useRemoveDayPlanItem,
  useReorderDayPlanItems,
  DayPlanItemRow,
} from '@/features/dayplan';
import type { DayPlanItem } from '@/features/dayplan';

const ACCENT = '#8B5CF6';

function FabButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.9, { damping: 12, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 300 }); }}
        style={styles.fab}
        accessibilityLabel="Add stop"
      >
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}

export default function DayPlanScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id: hangoutId } = useLocalSearchParams<{ id: string }>();

  const plans = useDayPlans(hangoutId);
  const plan = plans.data?.[0] ?? null;
  const planDetail = useDayPlan(plan?.id);
  const createPlan = useCreateDayPlan();
  const removePlanItem = useRemoveDayPlanItem(plan?.id ?? '');
  const reorder = useReorderDayPlanItems();

  const items: DayPlanItem[] = planDetail.data?.items ?? [];

  useEffect(() => {
    if (
      !plans.isLoading &&
      !plans.isError &&
      plans.data !== undefined &&
      plans.data.length === 0 &&
      !createPlan.isPending
    ) {
      createPlan.mutate({ hangoutId: hangoutId ?? '', title: 'Day Plan' });
    }
  }, [plans.isLoading, plans.isError, plans.data]);

  function handleMoveUp(index: number) {
    if (!plan || index === 0) return;
    const ids = items.map((i) => i.id);
    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
    reorder.mutate({ planId: plan.id, orderedIds: ids });
  }

  function handleMoveDown(index: number) {
    if (!plan || index === items.length - 1) return;
    const ids = items.map((i) => i.id);
    [ids[index + 1], ids[index]] = [ids[index]!, ids[index + 1]!];
    reorder.mutate({ planId: plan.id, orderedIds: ids });
  }

  function handleAddStop() {
    if (!plan) return;
    router.push({
      pathname: `/hangout/${hangoutId}/dayplan-add` as any,
      params: { planId: plan.id },
    });
  }

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = (
    <View
      style={[
        styles.headerBar,
        {
          paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 12),
          backgroundColor: theme.colors.bg.canvas,
          borderBottomColor: theme.colors.border.default,
        },
      ]}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => [
          styles.backBtn,
          { backgroundColor: theme.colors.bg.subtle, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <ArrowLeft size={18} color={theme.colors.text.primary} strokeWidth={2} />
      </Pressable>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[theme.typography.h3, { color: theme.colors.text.primary, fontWeight: '800' }]}>
          Day Plan
        </Text>
        {items.length > 0 ? (
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 1 }]}>
            {items.length} stop{items.length === 1 ? '' : 's'} planned
          </Text>
        ) : null}
      </View>
    </View>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (plans.isLoading || createPlan.isPending) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 12 }]}>
            {createPlan.isPending ? 'Setting up your plan…' : 'Loading…'}
          </Text>
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (plans.isError) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <View style={styles.center}>
          <AlertCircle size={40} color={theme.colors.danger} strokeWidth={1.5} />
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, marginTop: 12 }]}>
            Could not load day plan
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 4, textAlign: 'center' }]}>
            {(plans.error as Error)?.message ?? 'Unknown error'}
          </Text>
          <Button label="Retry" variant="secondary" onPress={() => plans.refetch()} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (!planDetail.isLoading && items.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
        {Header}
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
          {/* Hero graphic */}
          <View style={[styles.emptyHero, { backgroundColor: ACCENT + '10' }]}>
            <MapPin size={40} color={ACCENT} strokeWidth={1.5} />
            {/* Decorative dots */}
            <View style={[styles.heroDot, { top: 18, right: 24, width: 8, height: 8, backgroundColor: ACCENT + '40' }]} />
            <View style={[styles.heroDot, { bottom: 20, left: 28, width: 5, height: 5, backgroundColor: ACCENT + '30' }]} />
            <View style={[styles.heroDot, { top: 32, left: 20, width: 6, height: 6, backgroundColor: ACCENT + '25' }]} />
          </View>

          <Text style={[theme.typography.h2, { color: theme.colors.text.primary, marginTop: 24, fontWeight: '800', letterSpacing: -0.5 }]}>
            Map out your day
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 8, textAlign: 'center', lineHeight: 22 }]}>
            Add restaurants, activities, and custom stops to build your perfect itinerary.
          </Text>

          <Pressable
            onPress={handleAddStop}
            style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.emptyBtnText}>Add your first stop</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // ── Main list ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {Header}

      {planDetail.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: 20,
            paddingLeft: 16,
            paddingBottom: insets.bottom + 110,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <DayPlanItemRow
              item={item}
              index={index}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              onRemove={() => removePlanItem.mutate(item.id)}
            />
          )}
        />
      )}

      {/* FAB */}
      <View style={[styles.fabWrap, { bottom: insets.bottom + 28 }]}>
        <FabButton onPress={handleAddStop} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyHero: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDot: {
    position: 'absolute',
    borderRadius: 99,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
});
