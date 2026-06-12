import React from 'react';
import { Stack } from 'expo-router';

export default function HangoutLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="bills-new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="follow-up-restaurant" options={{ presentation: 'modal' }} />
      <Stack.Screen name="follow-up-venue" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
