import { useEffect } from 'react';
import { supabase } from '@/services/supabase/client';
import { useSessionStore } from '@/stores/session.store';
import { setUserContext } from '@/services/errors';
import { identifyUser, resetAnalytics } from '@/services/analytics';

/**
 * Initializes the auth-state listener. Call this ONCE at the app root.
 *
 * It does two things:
 *   1. Fetches the current session on mount (might come from secure storage).
 *   2. Subscribes to auth changes so the session store updates on sign-in/out/refresh.
 */
export function useSessionListener(): void {
  const setSession = useSessionStore((s) => s.setSession);
  const setLoading = useSessionStore((s) => s.setLoading);

  useEffect(() => {
    let mounted = true;

    setLoading(true);

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        setUserContext({ id: data.session.user.id });
        identifyUser(data.session.user.id);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);

      if (event === 'SIGNED_OUT') {
        resetAnalytics();
        setUserContext(null);
      } else if (session?.user) {
        setUserContext({ id: session.user.id });
        identifyUser(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [setSession, setLoading]);
}

/**
 * Read-only hook for the current session. Components use this to react to auth state.
 */
export function useSession(): {
  session: ReturnType<typeof useSessionStore.getState>['session'];
  user: ReturnType<typeof useSessionStore.getState>['user'];
  isLoading: boolean;
  isAuthenticated: boolean;
} {
  const session = useSessionStore((s) => s.session);
  const user = useSessionStore((s) => s.user);
  const isLoading = useSessionStore((s) => s.isLoading);

  return {
    session,
    user,
    isLoading,
    isAuthenticated: Boolean(session?.user),
  };
}
