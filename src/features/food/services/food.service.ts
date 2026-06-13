import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import { createHangout } from '@/features/hangouts/services/hangouts.service';
import type { CreateFoodHangoutInput, CreateRestaurantPollInput } from '../schemas';
import type { Poll } from '@/features/polls';

/**
 * Food service. Creates the right kind of poll based on the user's chosen flow,
 * with the user-selected voting method (simple or ranked).
 */

export async function createFoodHangout(
  input: CreateFoodHangoutInput,
): Promise<{ hangoutId: string; pollId: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const hangout = await createHangout({
    title: input.hangout.title,
    description: input.hangout.description,
    startTime: input.hangout.startTime,
    locationName: input.hangout.locationName,
    locationAddress: input.hangout.locationAddress,
    inviteUserIds: input.hangout.inviteUserIds,
  });

  let pollKind: 'cuisine' | 'restaurant';
  let pollTitle: string;
  let optionRows: { label: string; metadata: Record<string, unknown> }[];

  if (input.flow === 'restaurant_only') {
    pollKind = 'restaurant';
    pollTitle = 'Which restaurant?';
    optionRows = (input.restaurantOptions ?? []).map((r) => ({
      label: r.name,
      metadata: {
        placeId: r.placeId ?? null,
        address: r.address ?? null,
        rating: r.rating ?? null,
        priceLevel: r.priceLevel ?? null,
        primaryType: r.primaryType ?? null,
        mapsUrl: r.mapsUrl ?? null,
        isCustom: r.isCustom ?? false,
      },
    }));
  } else {
    pollKind = 'cuisine';
    pollTitle = 'What kind of food?';
    optionRows = (input.cuisineOptions ?? []).map((c) => ({
      label: c.label,
      metadata: {
        emoji: c.emoji ?? null,
        catalogId: c.catalogId ?? null,
      },
    }));
  }

  const { data: poll, error } = await supabase
    .from(TABLES.polls)
    .insert({
      hangout_id: hangout.id,
      created_by: auth.user.id,
      kind: pollKind,
      mode: 'simple_vote',
      voting_method: input.votingMethod,
      phase: 'voting',
      title: pollTitle,
      vote_deadline: input.voteDeadline,
    } as any)
    .select()
    .single();

  if (error) throw error;
  if (!poll) throw new Error('Poll creation returned no row');

  if (optionRows.length > 0) {
    const fullRows = optionRows.map((r) => ({
      poll_id: (poll as Poll).id,
      added_by: auth.user!.id,
      label: r.label,
      metadata: r.metadata,
    }));
    const { error: optErr } = await supabase.from(TABLES.poll_options).insert(fullRows as any);
    if (optErr) throw optErr;
  }

  return { hangoutId: hangout.id, pollId: (poll as Poll).id };
}

export async function createRestaurantPoll(input: CreateRestaurantPollInput): Promise<Poll> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data: poll, error } = await supabase
    .from(TABLES.polls)
    .insert({
      hangout_id: input.hangoutId,
      created_by: auth.user.id,
      kind: 'restaurant',
      mode: 'simple_vote',
      voting_method: input.votingMethod,
      phase: 'voting',
      title: 'Which restaurant?',
      vote_deadline: input.voteDeadline,
    } as any)
    .select()
    .single();

  if (error) throw error;
  if (!poll) throw new Error('Poll creation returned no row');

  const optionRows = input.options.map((r) => ({
    poll_id: (poll as Poll).id,
    added_by: auth.user!.id,
    label: r.name,
    metadata: {
      placeId: r.placeId ?? null,
      address: r.address ?? null,
      rating: r.rating ?? null,
      priceLevel: r.priceLevel ?? null,
      primaryType: r.primaryType ?? null,
      mapsUrl: r.mapsUrl ?? null,
      isCustom: r.isCustom ?? false,
    },
  }));

  const { error: optErr } = await supabase.from(TABLES.poll_options).insert(optionRows);

  if (optErr) throw optErr;

  return poll as Poll;
}

// -----------------------------------------------------------------------------
// User custom restaurants
// -----------------------------------------------------------------------------

export type UserCustomRestaurant = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  google_place_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function listMyCustomRestaurants(): Promise<UserCustomRestaurant[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data, error } = await (supabase as any)
    .from('user_custom_restaurants')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []) as UserCustomRestaurant[];
}

export async function saveCustomRestaurant(input: {
  name: string;
  address?: string | null;
  placeId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<UserCustomRestaurant | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const trimmedName = input.name.trim();
  if (!trimmedName) return null;

  const onConflict = input.placeId ? 'user_id,google_place_id' : 'user_id,name';

  const { data, error } = await (supabase as any)
    .from('user_custom_restaurants')
    .upsert(
      {
        user_id: auth.user.id,
        name: trimmedName,
        address: input.address ?? null,
        google_place_id: input.placeId ?? null,
        metadata: input.metadata ?? {},
      },
      { onConflict, ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as UserCustomRestaurant;
}

export async function deleteCustomRestaurant(id: string): Promise<void> {
  const { error } = await (supabase as any).from('user_custom_restaurants').delete().eq('id', id);
  if (error) throw error;
}
