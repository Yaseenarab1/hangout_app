import { supabase } from '@/services/supabase/client';
import type { AvailabilitySession, SessionWithResponses, CreateSessionInput } from '../types';

// Cast to any because these tables are new and not yet in generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function getHangoutSession(hangoutId: string): Promise<SessionWithResponses | null> {
  const { data: sessions, error } = await db
    .from('availability_sessions')
    .select('*')
    .eq('hangout_id', hangoutId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!sessions || sessions.length === 0) return null;

  return fetchSessionWithResponses(sessions[0].id as string);
}

export async function getSession(sessionId: string): Promise<SessionWithResponses | null> {
  return fetchSessionWithResponses(sessionId);
}

async function fetchSessionWithResponses(sessionId: string): Promise<SessionWithResponses | null> {
  const { data: session, error: sErr } = await db
    .from('availability_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sErr) {
    // PGRST116 = 0 rows (session doesn't exist or RLS blocked it)
    if (sErr.code === 'PGRST116') return null;
    throw new Error(`availability_sessions fetch failed: ${sErr.message} (${sErr.code})`);
  }
  if (!session) return null;

  const { data: responses, error: rErr } = await db
    .from('availability_responses')
    .select('id, session_id, user_id, guest_name, available, created_at, updated_at')
    .eq('session_id', sessionId);

  if (rErr) throw new Error(`availability_responses fetch failed: ${rErr.message} (${rErr.code})`);

  return { ...session, responses: responses ?? [] } as SessionWithResponses;
}

export async function getUserSessions(userId: string): Promise<AvailabilitySession[]> {
  const { data, error } = await db
    .from('availability_sessions')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as AvailabilitySession[];
}

export async function createSession(input: CreateSessionInput): Promise<AvailabilitySession> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('availability_sessions')
    .insert({
      created_by: user.id,
      hangout_id: input.hangoutId ?? null,
      title: input.title ?? 'When can we meet?',
      dates: input.dates,
      start_hour: input.startHour ?? 9,
      end_hour: input.endHour ?? 22,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AvailabilitySession;
}

export async function upsertMyAvailability(sessionId: string, available: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await db
    .from('availability_responses')
    .upsert(
      { session_id: sessionId, user_id: user.id, available, updated_at: new Date().toISOString() },
      { onConflict: 'session_id,user_id' },
    );

  if (error) throw error;
}
