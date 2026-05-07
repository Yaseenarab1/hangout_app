import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase/client';

export type SearchLocation = {
  name: string;
  lat: number;
  lng: number;
};

const STORAGE_KEY = '@hangout/search_location';

export async function getSearchLocation(): Promise<SearchLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SearchLocation) : null;
  } catch {
    return null;
  }
}

export async function saveSearchLocation(loc: SearchLocation): Promise<void> {
  // Local first — available before network, survives offline
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc));

  // Profile metadata — best-effort sync across devices
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('metadata')
      .eq('id', auth.user.id)
      .single();

    const merged = {
      ...((profile?.metadata as object) ?? {}),
      search_location: loc,
    };

    await supabase
      .from('profiles')
      .update({ metadata: merged } as any)
      .eq('id', auth.user.id);
  } catch {
    // Local save already succeeded — profile sync is not critical
  }
}

export async function clearSearchLocation(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);

  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('metadata')
      .eq('id', auth.user.id)
      .single();

    const meta = { ...((profile?.metadata as object) ?? {}) } as Record<string, unknown>;
    delete meta.search_location;

    await supabase
      .from('profiles')
      .update({ metadata: meta } as any)
      .eq('id', auth.user.id);
  } catch {
    // Best-effort
  }
}
