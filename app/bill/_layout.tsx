import { Stack } from 'expo-router';
import { BillDraftProvider } from '@/features/bills/context/BillDraftContext';

export default function BillLayout() {
  return (
    <BillDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </BillDraftProvider>
  );
}
