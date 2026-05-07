import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/AppProviders';
import { useSession } from '@/features/auth';
import { useTheme } from '@/hooks/useTheme';
import { useMyProfile } from '@/features/profile';
import {
  registerForPushNotifications,
  setupNotificationListeners,
  deleteDeviceToken,
} from '@/services/notifications';

// Keep splash visible until we know whether the user is signed in.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* swallow — already hidden */
});

/**
 * The single entry point. Wraps everything in providers, then renders the Stack.
 *
 * The redirect logic (authed → tabs, unauthed → auth) lives in `RouteGuard`
 * which has access to the session state via the listener in `AppProviders`.
 */
export default function RootLayout(): React.ReactElement {
  return (
    <AppProviders>
      <RouteGuard />
      <NotificationSetup />
      <ThemedStatusBar />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'default',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="users/[id]"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="profile/edit"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="friends/search"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="friends/requests"
          options={{ presentation: 'card' }}
        />
        <Stack.Screen
          name="profile/settings"
        />
	<Stack.Screen name="hangout/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="hangout/new-food" options={{ presentation: 'modal' }} />
        <Stack.Screen name="hangout/[id]/follow-up-restaurant" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="hangout/[id]/follow-up-venue" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="hangout/new-activity" options={{ presentation: 'modal' }} />
        <Stack.Screen name="hangout/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="hangout/[id]/chat" options={{ presentation: 'card' }} />
        <Stack.Screen name="hangout/[id]/photos" options={{ presentation: 'card' }} />
        <Stack.Screen name="hangout/[id]/bills" options={{ presentation: 'card' }} />
        <Stack.Screen name="feed" options={{ presentation: 'card' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AppProviders>
  );
}

function NotificationSetup(): null {
  const { isAuthenticated } = useSession();
  const prevAuthRef = useRef<boolean | null>(null);

  // Set up tap handler + foreground listener once at root level
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);

  // Register / deregister token as auth state changes
  useEffect(() => {
    const prev = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (isAuthenticated && prev !== true) {
      registerForPushNotifications();
    } else if (!isAuthenticated && prev === true) {
      deleteDeviceToken();
    }
  }, [isAuthenticated]);

  return null;
}

function ThemedStatusBar(): React.ReactElement {
  const theme = useTheme();
  return <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Routes the user based on auth state.
 *
 *  - isLoading: stay on splash.
 *  - !auth + in (auth) group: stay (sign-in/sign-up).
 *  - !auth + elsewhere: redirect to /(auth)/welcome.
 *  - auth + in (auth) group: redirect to /(tabs)/.
 *  - auth + elsewhere: stay (the user is in a normal screen).
 */

function RouteGuard(): null {
  const { isAuthenticated, isLoading, user } = useSession();
  const segments = useSegments();
  const { data: profile, isLoading: profileLoading } = useMyProfile();

  console.log('[RouteGuard]', {
    isAuthenticated,
    isLoading,
    profileLoading,
    profile_complete: profile?.profile_complete,
    profile_id: profile?.id,
    segments: segments.join('/'),
  });

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && profileLoading) return; // wait for profile to load

    SplashScreen.hideAsync().catch(() => undefined);

    const inAuthGroup = segments[0] === '(auth)';
    const onCreateProfile =
      segments[0] === '(auth)' && segments[1] === 'create-profile';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
      return;
    }

    // Authenticated but profile not complete → force them to Create Profile
    if (isAuthenticated && profile && !profile.profile_complete) {
      if (!onCreateProfile) {
        router.replace('/(auth)/create-profile');
      }
      return;
    }

    // Authenticated, profile complete, but still in auth group → go home
    if (isAuthenticated && profile?.profile_complete && inAuthGroup) {
      router.replace('/(tabs)/' as any);
    }
  }, [isAuthenticated, isLoading, profile, profileLoading, segments]);

  return null;
}
