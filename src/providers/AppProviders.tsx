import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, type AppStateStatus, View } from 'react-native';
import { Toaster } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useSessionListener } from '@/features/auth';
import { BillDraftProvider } from '@/features/bills/context/BillDraftContext';
import { initErrorTracking } from '@/services/errors';
import { initAnalytics } from '@/services/analytics';

/**
 * The root provider tree. Used by app/_layout.tsx.
 *
 * Order matters:
 *   - GestureHandlerRootView must wrap everything (Reanimated/gestures need it).
 *   - SafeAreaProvider must wrap things that need safe-area insets.
 *   - QueryClientProvider wraps everything that uses TanStack Query.
 *   - ErrorBoundary wraps the actual screens.
 *   - Toaster sits at the top so it's drawn over everything else.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reasonable defaults for a mobile app.
      retry: (failureCount, error) => {
        // Don't retry RLS denials or 4xx-equivalents.
        const msg = error instanceof Error ? error.message.toLowerCase() : '';
        if (msg.includes('row-level security') || msg.includes('rls')) return false;
        if (msg.includes('not authenticated')) return false;
        return failureCount < 2;
      },
      staleTime: 60 * 1000, // 1 minute default
      refetchOnWindowFocus: true, // refetch on app foreground
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false, // mutations should not auto-retry
    },
  },
});

// Wire React Query's focus manager to React Native's AppState.
function onAppStateChange(status: AppStateStatus): void {
  focusManager.setFocused(status === 'active');
}

export function AppProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    initErrorTracking();
    void initAnalytics();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionGate>
            <BillDraftProvider>
              <ErrorBoundary>{children}</ErrorBoundary>
              <Toaster />
            </BillDraftProvider>
          </SessionGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Initializes the auth listener. Must live INSIDE QueryClientProvider so any
 * hooks it uses (TanStack Query) work.
 */
function SessionGate({ children }: { children: React.ReactNode }): React.ReactElement {
  useSessionListener();
  return <View style={{ flex: 1 }}>{children}</View>;
}
