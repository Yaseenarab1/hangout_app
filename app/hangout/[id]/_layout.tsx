import { Stack } from 'expo-router';

/**
 * Hangout subroute layout. Each subroute (index, participants, settings)
 * has its own header so we don't render one here — just a transparent stack.
 */
export default function HangoutLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
