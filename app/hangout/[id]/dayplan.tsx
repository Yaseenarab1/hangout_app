import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AlertCircle, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/layout/Screen';
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

  // Auto-create the plan on first open — no manual "Create" step needed
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
    router.push({ pathname: `/hangout/${hangoutId}/dayplan-add` as any, params: { planId: plan.id } });
  }

  // Loading — either fetching plans or auto-creating
  if (plans.isLoading || createPlan.isPending) {
    return (
      <Screen header={{ title: 'Day Plan', showBack: true }}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
          {createPlan.isPending ? (
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 10 }]}>
              Setting up your plan…
            </Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  // DB error state
  if (plans.isError) {
    return (
      <Screen header={{ title: 'Day Plan', showBack: true }}>
        <View style={styles.center}>
          <AlertCircle size={40} color={theme.colors.danger} strokeWidth={1.5} />
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary, marginTop: 12 }]}>
            Could not load day plan
          </Text>
          <Text
            style={[theme.typography.caption, { color: theme.colors.text.secondary, marginTop: 4, textAlign: 'center' }]}
          >
            {(plans.error as Error)?.message ?? 'Unknown error'}
          </Text>
          <Button
            label="Retry"
            variant="secondary"
            onPress={() => plans.refetch()}
            style={{ marginTop: 16 }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={{ title: 'Day Plan', showBack: true }}>
      <View style={{ flex: 1 }}>
        {planDetail.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={[theme.typography.h3, { color: theme.colors.text.primary, marginTop: 12 }]}>
              No stops yet
            </Text>
            <Text
              style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 6, textAlign: 'center' }]}
            >
              Add restaurants, activities, or custom spots to map out your day.
            </Text>
            <Pressable
              onPress={handleAddStop}
              style={[styles.emptyAddBtn, { backgroundColor: '#8B5CF6' }]}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                Add your first stop
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 100 }}
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

        {/* FAB — only shown when plan has stops */}
        {items.length > 0 ? (
          <Pressable
            onPress={handleAddStop}
            style={[styles.fab, { bottom: insets.bottom + 24 }]}
            accessibilityLabel="Add stop"
          >
            <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 52,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
