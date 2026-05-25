import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, EmptyState, SectionHeader } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import {
  useDayPlans,
  useDayPlan,
  useCreateDayPlan,
  useRemoveDayPlanItem,
  useReorderDayPlanItems,
  DayPlanItemRow,
  AddItemSheet,
} from '@/features/dayplan';
import type { DayPlanItem } from '@/features/dayplan';

export default function DayPlanScreen(): React.ReactElement {
  const theme = useTheme();
  const { id: hangoutId } = useLocalSearchParams<{ id: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const plans = useDayPlans(hangoutId);
  const plan = plans.data?.[0] ?? null;

  const planDetail = useDayPlan(plan?.id);
  const createPlan = useCreateDayPlan();
  const removePlanItem = useRemoveDayPlanItem(plan?.id ?? '');
  const reorder = useReorderDayPlanItems();

  const items: DayPlanItem[] = planDetail.data?.items ?? [];

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

  // Loading state
  if (plans.isLoading) {
    return (
      <Screen header={{ title: 'Day Plan', showBack: true }}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </Screen>
    );
  }

  // No plan yet — show create state
  if (!plan) {
    return (
      <Screen header={{ title: 'Day Plan', showBack: true }}>
        <EmptyState
          icon={<MapPin size={42} color={theme.colors.text.tertiary} strokeWidth={1} />}
          title="No day plan yet"
          body="Create a plan to map out your hangout — restaurants, activities, and custom stops."
          action={
            <Button
              label="Create day plan"
              variant="primary"
              loading={createPlan.isPending}
              onPress={() =>
                createPlan.mutate({ hangoutId: hangoutId ?? '', title: 'Day Plan' })
              }
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={{
        title: plan.title,
        showBack: true,
        right: (
          <Button
            label={isEditing ? 'Done' : 'Edit'}
            variant="ghost"
            size="sm"
            onPress={() => setIsEditing((v) => !v)}
          />
        ),
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {planDetail.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyItems}>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center' }]}>
              No stops yet. Add restaurants, activities, or custom spots.
            </Text>
          </View>
        ) : (
          <>
            <SectionHeader title={`${items.length} stop${items.length === 1 ? '' : 's'}`} />
            <View style={styles.timeline}>
              {items.map((item, index) => (
                <DayPlanItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  isEditing={isEditing}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  onRemove={() => removePlanItem.mutate(item.id)}
                />
              ))}
            </View>
          </>
        )}

        <View style={styles.addBtn}>
          <Button
            label="+ Add stop"
            variant="secondary"
            fullWidth
            onPress={() => setShowAddSheet(true)}
          />
        </View>
      </ScrollView>

      <AddItemSheet
        planId={plan.id}
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onAdded={() => setShowAddSheet(false)}
      />
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
  content: {
    paddingBottom: 40,
  },
  emptyItems: {
    padding: 32,
    alignItems: 'center',
  },
  timeline: {
    paddingHorizontal: 4,
  },
  addBtn: {
    marginTop: 16,
  },
});
