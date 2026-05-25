import { supabase } from '@/services/supabase/client';
import type {
  DayPlan,
  DayPlanItem,
  DayPlanWithItems,
  CreateDayPlanInput,
  AddDayPlanItemInput,
} from '../types';

/**
 * Day Plan service. Tables aren't in generated types yet, so we cast with `as any`.
 */

export async function getDayPlans(hangoutId: string): Promise<DayPlan[]> {
  const { data, error } = await (supabase as any)
    .from('day_plans')
    .select('*')
    .eq('hangout_id', hangoutId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DayPlan[];
}

export async function getDayPlan(planId: string): Promise<DayPlanWithItems | null> {
  const { data: plan, error: planError } = await (supabase as any)
    .from('day_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();

  if (planError) throw planError;
  if (!plan) return null;

  const { data: items, error: itemsError } = await (supabase as any)
    .from('day_plan_items')
    .select('*')
    .eq('plan_id', planId)
    .order('position', { ascending: true });

  if (itemsError) throw itemsError;

  return {
    ...(plan as DayPlan),
    items: (items ?? []) as DayPlanItem[],
  };
}

export async function createDayPlan(input: CreateDayPlanInput): Promise<DayPlan> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await (supabase as any)
    .from('day_plans')
    .insert({
      hangout_id: input.hangoutId,
      title: input.title ?? 'Day Plan',
      plan_date: input.planDate ?? null,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Day plan creation returned no row');
  return data as DayPlan;
}

export async function updateDayPlan(
  planId: string,
  updates: { title?: string; planDate?: string | null },
): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.planDate !== undefined) payload.plan_date = updates.planDate;

  const { error } = await (supabase as any)
    .from('day_plans')
    .update(payload)
    .eq('id', planId);

  if (error) throw error;
}

export async function deleteDayPlan(planId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('day_plans')
    .delete()
    .eq('id', planId);

  if (error) throw error;
}

export async function addDayPlanItem(input: AddDayPlanItemInput): Promise<DayPlanItem> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Get current max position
  const { data: existing, error: posError } = await (supabase as any)
    .from('day_plan_items')
    .select('position')
    .eq('plan_id', input.planId)
    .order('position', { ascending: false })
    .limit(1);

  if (posError) throw posError;

  const maxPosition = (existing ?? []).length > 0 ? (existing[0].position as number) : -1;
  const nextPosition = maxPosition + 1;

  const { data, error } = await (supabase as any)
    .from('day_plan_items')
    .insert({
      plan_id: input.planId,
      position: nextPosition,
      item_type: input.itemType,
      title: input.title,
      subtitle: input.subtitle ?? null,
      start_time: input.startTime ?? null,
      duration_minutes: input.durationMinutes ?? null,
      place_id: input.placeId ?? null,
      place_data: input.placeData ?? null,
      notes: input.notes ?? null,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Day plan item creation returned no row');
  return data as DayPlanItem;
}

export async function removeDayPlanItem(itemId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('day_plan_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * Batch-upsert positions for all items in a plan.
 * orderedIds: array of item IDs in the desired order (index = new position).
 */
export async function reorderDayPlanItems(
  planId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return;

  const updates = orderedIds.map((id, index) => ({
    id,
    plan_id: planId,
    position: index,
  }));

  const { error } = await (supabase as any)
    .from('day_plan_items')
    .upsert(updates, { onConflict: 'id' });

  if (error) throw error;
}
