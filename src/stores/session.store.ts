import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

/**
 * In-memory cache of the current Supabase session.
 *
 * The Supabase client persists tokens to SecureStore (see services/supabase/client.ts).
 * This store is just an in-memory mirror so React components can react to auth changes.
 *
 * Source of truth: the database. Never trust the cached user — always re-validate via RLS.
 */
type SessionStore = {
  session: Session | null;
  user: User | null;
  isLoading: boolean; // true while we're determining initial auth state
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  setSession: (session) => set({ session, user: session?.user ?? null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ session: null, user: null, isLoading: false }),
}));
