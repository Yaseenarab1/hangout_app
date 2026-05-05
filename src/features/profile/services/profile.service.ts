import { supabase } from '@/services/supabase/client';
import { TABLES } from '@/services/supabase/tables';
import { uploadAvatar } from '@/services/storage';
import type { Profile } from '@/services/supabase/types.gen';
import type { CreateProfileInput, UpdateProfileInput } from '../schemas';

/**
 * The profile row is auto-created by a trigger when an auth user is created
 * (see db/003_triggers.sql). The user then "completes" their profile via
 * `completeProfile`, which UPDATEs that row.
 */

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  return getProfile(auth.user.id);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return !data;
}

export async function completeProfile(input: CreateProfileInput): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const userId = auth.user.id;

  let avatarUrl: string | null = null;
  if (input.avatarUri) {
    const result = await uploadAvatar(input.avatarUri, userId);
    avatarUrl = result.publicUrl ? `${result.publicUrl}?v=${Date.now()}` : null;
  }

  const { data, error } = await supabase
    .from(TABLES.profiles)
    .update({
      display_name: input.displayName,
      username: input.username.toLowerCase(),
      bio: input.bio ?? null,
      avatar_url: avatarUrl,
      profile_complete: true,
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const update: Record<string, unknown> = {};
  if (input.displayName !== undefined) update.display_name = input.displayName;
  if (input.username !== undefined) update.username = input.username.toLowerCase();
  if (input.bio !== undefined) update.bio = input.bio;
  if (input.defaultPostVisibility !== undefined)
    update.default_post_visibility = input.defaultPostVisibility;
  if (input.defaultCalendarVisibility !== undefined)
    update.default_calendar_visibility = input.defaultCalendarVisibility;

  const { data, error } = await supabase
    .from(TABLES.profiles)
    .update(update)
    .eq('id', auth.user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAvatar(localUri: string): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const result = await uploadAvatar(localUri, auth.user.id);

  // Append a timestamp so the URL changes every time, busting any image cache.
  // The underlying file path stays the same; this just tricks clients into refetching.
  const cacheBustedUrl = result.publicUrl
    ? `${result.publicUrl}?v=${Date.now()}`
    : null;

  await supabase
    .from(TABLES.profiles)
    .update({ avatar_url: cacheBustedUrl })
    .eq('id', auth.user.id);

  return cacheBustedUrl;
}
