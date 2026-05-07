import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { supabase } from '@/services/supabase/client';
import { logError } from '@/services/errors';
import type { NotificationData } from './types';

export type { NotificationType, NotificationData } from './types';

// Show banners while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  // Expo push tokens only work on physical devices
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn('[notifications] No EAS project ID — push registration skipped');
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await upsertDeviceToken(token);
  } catch (err) {
    logError(err, { where: 'registerForPushNotifications' });
  }
}

async function upsertDeviceToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await (supabase as any).from('device_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_name: Device.deviceName ?? undefined,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );

  if (error) logError(error, { where: 'upsertDeviceToken' });
}

export async function refreshDeviceTokenLastSeen(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await upsertDeviceToken(token);
  } catch {
    // best-effort
  }
}

export async function deleteDeviceToken(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any)
      .from('device_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', token);
  } catch {
    // best-effort
  }
}

function routeFromNotification(data: NotificationData): void {
  const { type, refId } = data;
  switch (type) {
    case 'message':
      router.push(`/hangout/${refId}/chat` as any);
      break;
    case 'photo_added':
      router.push(`/hangout/${refId}/photos` as any);
      break;
    case 'bill_added':
    case 'bill_paid':
      router.push(`/hangout/${refId}/bills` as any);
      break;
    case 'friend_post':
      router.push(`/feed` as any);
      break;
    case 'hangout_invite':
    case 'poll_closed':
      router.push(`/hangout/${refId}` as any);
      break;
    case 'rsvp_change':
      router.push(`/hangout/${refId}` as any);
      break;
  }
}

let tapListenerSub: Notifications.Subscription | null = null;
let foregroundListenerSub: Notifications.Subscription | null = null;
let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;

export function setupNotificationListeners(): () => void {
  // User taps a notification (app closed or backgrounded)
  tapListenerSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as NotificationData;
      if (data?.type && data?.refId) {
        routeFromNotification(data);
      }
    },
  );

  // Notification arrives while app is foregrounded — handler above shows banner
  foregroundListenerSub = Notifications.addNotificationReceivedListener(
    (_notification) => {
      // Banner is shown via setNotificationHandler above.
      // Could badge-update or refresh cache here in future.
    },
  );

  // Refresh token last_seen_at when app comes to foreground
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') refreshDeviceTokenLastSeen();
  });

  return () => {
    tapListenerSub?.remove();
    foregroundListenerSub?.remove();
    appStateSub?.remove();
    tapListenerSub = null;
    foregroundListenerSub = null;
    appStateSub = null;
  };
}
