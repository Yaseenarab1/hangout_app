import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import type {
  CreateHangoutInput,
  UpdateHangoutInput,
  InviteParticipantsInput,
  UpdateParticipantInput,
} from '../schemas';
import type { Hangout, HangoutParticipant, HangoutWithParticipants } from '../types';

/**
 * Hangouts service — all DB calls live here.
 *
 * Important behaviors enforced by triggers in db/003_triggers.sql:
 *   - On hangout INSERT: an `albums` row is auto-created and the host is added
 *     as a participant with role='host', status='accepted'.
 *   - On `hangout_participants` INSERT with status='invited': a notification
 *     is created for the invited user.
 *
 * RLS (db/002_rls_policies.sql) enforces:
 *   - SELECT on hangouts: visible to host or any participant.
 *   - INSERT on hangouts: caller must be the host_id.
 *   - UPDATE on hangouts: host or co_host.
 *   - DELETE on hangouts: host only.
 *   - INSERT on hangout_participants: by host or co_host.
 *   - UPDATE on hangout_participants: self can update own row; host can update any.
 */

/** Lists every hangout the current user is a host of OR a participant in. */
export async function listMyHangouts(): Promise<Hangout[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  // RLS already filters to "where I'm a host or participant".
  // We just order by start_time desc with planning/scheduled bubbled to the top.
  const { data, error } = await supabase
    .from(TABLES.hangouts)
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Get a single hangout WITH participants joined. */
export async function getHangout(id: string): Promise<HangoutWithParticipants | null> {
  // Fetch the hangout itself.
  const { data: hangout, error } = await supabase
    .from(TABLES.hangouts)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!hangout) return null;

  // Fetch its participants joined to profiles.
  const { data: participants, error: pErr } = await supabase
    .from(TABLES.hangout_participants)
    .select(
      `
      hangout_id,
      user_id,
      status,
      role,
      invited_by,
      invited_at,
      responded_at,
      vote_weight,
      notifications_muted,
      profile:profiles!hangout_participants_user_id_fkey (
        id, username, display_name, avatar_url
      )
    `,
    )
    .eq('hangout_id', id);

  if (pErr) throw pErr;

  return {
    ...hangout,
    // Cast — Supabase's typed-join inference doesn't always match our shape.
    participants: (participants ?? []) as HangoutWithParticipants['participants'],
  };
}

/**
 * Create a hangout, then invite the chosen friends.
 *
 * The caller becomes host (RLS check + trigger sets up host as participant).
 * Then we insert hangout_participants rows for each invited user.
 */
export async function createHangout(input: CreateHangoutInput): Promise<Hangout> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Step 1: insert the hangout itself.
  const { data: hangout, error } = await supabase
    .from(TABLES.hangouts)
    .insert({
      host_id: auth.user.id,
      title: input.title,
      description: input.description ?? null,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      primary_location_name: input.locationName ?? null,
      primary_location_address: input.locationAddress ?? null,
      // primary_location_geo is set later via Google Places (Phase 2C).
    })
    .select()
    .single();

  if (error) throw error;
  if (!hangout) throw new Error('Hangout creation returned no row');

  // Step 2: invite the chosen friends. The trigger handles notifications.
  if (input.inviteUserIds.length > 0) {
    const inviteRows = input.inviteUserIds.map((userId) => ({
      hangout_id: hangout.id,
      user_id: userId,
      invited_by: auth.user!.id,
      status: 'invited' as const,
      role: 'guest' as const,
    }));

    const { error: inviteErr } = await supabase
      .from(TABLES.hangout_participants)
      .insert(inviteRows);

    if (inviteErr) {
      // Don't roll back the hangout — the host can re-invite from the participants screen.
      // We just surface the error to the caller.
      throw inviteErr;
    }
  }

  return hangout;
}

/** Update a hangout's editable fields. RLS restricts to host/co-host. */
export async function updateHangout(
  id: string,
  input: UpdateHangoutInput,
): Promise<Hangout> {
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.startTime !== undefined) update.start_time = input.startTime;
  if (input.endTime !== undefined) update.end_time = input.endTime;
  if (input.locationName !== undefined) update.primary_location_name = input.locationName;
  if (input.locationAddress !== undefined)
    update.primary_location_address = input.locationAddress;
  if (input.status !== undefined) update.status = input.status;

  const { data, error } = await supabase
    .from(TABLES.hangouts)
    .update(update as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Hangout;
}

/** Soft-cancel a hangout (sets status=cancelled, cancelled_at=now). */
export async function cancelHangout(id: string): Promise<Hangout> {
  const { data, error } = await supabase
    .from(TABLES.hangouts)
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Hangout;
}

/** Hard-delete a hangout. RLS restricts to host. Cascades to participants, polls, etc. */
export async function deleteHangout(id: string): Promise<void> {
  const { error } = await supabase.from(TABLES.hangouts).delete().eq('id', id);
  if (error) throw error;
}

/** Invite additional friends to an existing hangout. */
export async function inviteParticipants(
  input: InviteParticipantsInput,
): Promise<HangoutParticipant[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const rows = input.userIds.map((userId) => ({
    hangout_id: input.hangoutId,
    user_id: userId,
    invited_by: auth.user!.id,
    status: 'invited' as const,
    role: 'guest' as const,
  }));

  // Conflict on (hangout_id, user_id) means already invited — silently ignore.
  const { data, error } = await supabase
    .from(TABLES.hangout_participants)
    .upsert(rows, { onConflict: 'hangout_id,user_id', ignoreDuplicates: true })
    .select();

  if (error) throw error;
  return (data ?? []) as HangoutParticipant[];
}

/** Update a participant — used for both self-RSVP and host edits. */
export async function updateParticipant(
  input: UpdateParticipantInput,
): Promise<HangoutParticipant> {
  const update: Record<string, unknown> = {};
  if (input.status !== undefined) {
    update.status = input.status;
    update.responded_at = new Date().toISOString();
  }
  if (input.role !== undefined) update.role = input.role;
  if (input.voteWeight !== undefined) update.vote_weight = input.voteWeight;
  if (input.notificationsMuted !== undefined)
    update.notifications_muted = input.notificationsMuted;

  const { data, error } = await supabase
    .from(TABLES.hangout_participants)
    .update(update as any)
    .eq('hangout_id', input.hangoutId)
    .eq('user_id', input.userId)
    .select()
    .single();

  if (error) throw error;
  return data as HangoutParticipant;
}

/** Remove a participant from a hangout (sets status=removed, doesn't delete row for audit). */
export async function removeParticipant(
  hangoutId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLES.hangout_participants)
    .update({ status: 'removed', responded_at: new Date().toISOString() })
    .eq('hangout_id', hangoutId)
    .eq('user_id', userId);

  if (error) throw error;
}
