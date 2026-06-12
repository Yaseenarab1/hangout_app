import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import type { RestaurantRating, UpsertRatingInput } from '../types';

const SELECT = `
  id, user_id, place_id, place_name, place_address,
  place_photo, place_type, rating, notes, visited_at,
  created_at, updated_at
`.trim();

export async function fetchMyRatings(): Promise<RestaurantRating[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from(TABLES.restaurant_ratings as any)
    .select(SELECT)
    .eq('user_id', user.id)
    .order('visited_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RestaurantRating[];
}

export async function upsertRating(input: UpsertRatingInput): Promise<RestaurantRating> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload = {
    user_id: user.id,
    place_id: input.place_id,
    place_name: input.place_name,
    place_address: input.place_address ?? null,
    place_photo: input.place_photo ?? null,
    place_type: input.place_type ?? null,
    rating: input.rating,
    notes: input.notes?.trim() || null,
    visited_at: input.visited_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLES.restaurant_ratings as any)
    .upsert(payload, { onConflict: 'user_id,place_id' })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as RestaurantRating;
}

export async function deleteRating(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.restaurant_ratings as any)
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchFriendRatings(
  placeIds: string[],
  friendIds: string[],
): Promise<RestaurantRating[]> {
  if (placeIds.length === 0 || friendIds.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLES.restaurant_ratings as any)
    .select(SELECT)
    .in('place_id', placeIds)
    .in('user_id', friendIds);
  if (error) throw error;
  return (data ?? []) as unknown as RestaurantRating[];
}
