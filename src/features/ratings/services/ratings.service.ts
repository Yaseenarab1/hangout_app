import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import type { RestaurantRating, UpsertRatingInput, HangoutPlace } from '../types';

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

export async function fetchHangoutRestaurants(hangoutId?: string): Promise<HangoutPlace[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Determine which hangout IDs to pull restaurants from
  let hangoutIds: string[];
  if (hangoutId) {
    hangoutIds = [hangoutId];
  } else {
    const { data: parts } = await (supabase as any)
      .from('hangout_participants')
      .select('hangout_id')
      .eq('user_id', user.id)
      .limit(30);
    hangoutIds = (parts ?? []).map((p: { hangout_id: string }) => p.hangout_id);
  }

  if (hangoutIds.length === 0) return [];

  // Get restaurant polls in those hangouts
  const { data: polls } = await (supabase as any)
    .from('polls')
    .select('id, hangout_id, hangouts(id, title)')
    .eq('kind', 'restaurant')
    .in('hangout_id', hangoutIds);

  if (!polls || polls.length === 0) return [];

  const pollIds: string[] = polls.map((p: any) => p.id);
  const hangoutByPollId = new Map<string, { id: string; title: string }>(
    polls.map((p: any) => [p.id, p.hangouts]),
  );

  // Get the options
  const { data: options } = await (supabase as any)
    .from('poll_options')
    .select('label, metadata, poll_id')
    .in('poll_id', pollIds)
    .limit(50);

  return (options ?? [])
    .map((o: any) => {
      const meta: Record<string, any> = o.metadata ?? {};
      const hangout = hangoutByPollId.get(o.poll_id);
      return {
        name: o.label as string,
        place_id: (meta.placeId as string) ?? null,
        address: (meta.address as string) ?? null,
        primary_type: (meta.primaryType as string) ?? null,
        hangout_title: hangout?.title ?? '',
        hangout_id: hangout?.id ?? '',
      } satisfies HangoutPlace;
    })
    .filter((p: HangoutPlace) => p.name.trim().length > 0);
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
