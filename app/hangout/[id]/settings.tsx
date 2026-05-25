import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar as CalIcon, MapPin, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button, Card, SectionHeader } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { AddressAutocomplete } from '@/features/places';
import { useSaveSearchLocation } from '@/features/places/hooks/useSearchLocation';
import type { PlaceDetails } from '@/features/places';
import {
  useHangout,
  useUpdateHangout,
  useCancelHangout,
  useDeleteHangout,
  updateHangoutSchema,
  type UpdateHangoutInput,
} from '@/features/hangouts';

export default function HangoutSettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const hangoutId = id ?? '';

  const hangout = useHangout(hangoutId);
  const updateHangout = useUpdateHangout(hangoutId);
  const cancelHangout = useCancelHangout(hangoutId);
  const deleteHangout = useDeleteHangout();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [addressText, setAddressText] = useState('');
  const saveSearchLocation = useSaveSearchLocation();

  const isHost = hangout.data?.host_id === user?.id;
  const myParticipationRole = hangout.data?.participants.find(
     (p) => p.user_id === user?.id,
  )?.role;
  const canManage = isHost || myParticipationRole === 'co_host';
  const isCancelled = hangout.data?.status === 'cancelled';

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateHangoutInput>({
    resolver: zodResolver(updateHangoutSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      locationName: '',
      locationAddress: '',
      startTime: undefined,
      endTime: undefined,
    },
  });

  // Hydrate form once data loads
  useEffect(() => {
    if (hangout.data) {
      reset({
        title: hangout.data.title,
        description: hangout.data.description ?? '',
        locationName: hangout.data.primary_location_name ?? '',
        locationAddress: hangout.data.primary_location_address ?? '',
        startTime: hangout.data.start_time ?? undefined,
        endTime: hangout.data.end_time ?? undefined,
      });
      setAddressText(hangout.data.primary_location_address ?? '');
    }
  }, [hangout.data, reset]);

  function handlePlaceSelected(place: PlaceDetails): void {
    setAddressText(place.address);
    setValue('locationAddress', place.address, { shouldDirty: true });
    // Auto-fill name only if it's currently empty
    const currentName = watch('locationName');
    if (!currentName?.trim()) {
      setValue('locationName', place.name, { shouldDirty: true });
    }
    // Save as search location so pickers use it immediately
    if (place.location) {
      saveSearchLocation.mutate({ name: place.name, lat: place.location.lat, lng: place.location.lng });
    }
  }

  const startTimeValue = watch('startTime');

  const onSubmit = (input: UpdateHangoutInput): void => {
    updateHangout.mutate(input, {
      onSuccess: () => router.back(),
    });
  };

  const handleCancel = (): void => {
    Alert.alert(
      'Cancel hangout?',
      'Everyone invited will be notified. You can still see it in your list.',
      [
        { text: 'Keep planning', style: 'cancel' },
        {
          text: 'Cancel hangout',
          style: 'destructive',
          onPress: () =>
            cancelHangout.mutate(undefined, {
              onSuccess: () => router.back(),
            }),
        },
      ],
    );
  };

  const handleDelete = (): void => {
    Alert.alert(
      'Delete hangout?',
      'This permanently deletes everything — chats, photos, polls, bills. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () =>
            deleteHangout.mutate(hangoutId, {
              onSuccess: () => {
                router.replace('/(tabs)/' as any);
              },
            }),
        },
      ],
    );
  };

  const handleDatePicked = (event: any, date?: Date): void => {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      setValue('startTime', date.toISOString(), { shouldDirty: true });
    }
  };

  if (!hangout.data || !canManage) {
    return (
      <Screen header={{ title: 'Settings', showBack: true }}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text.secondary, padding: 16 },
          ]}
        >
          Only the host can edit this hangout.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen header={{ title: 'Hangout settings', showBack: true }} scroll>
      {/* Edit form */}
      <View style={{ gap: 16 }}>
        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Title"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.title?.message}
              maxLength={100}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { value, onChange, onBlur } }) => (
            <Textarea
              label="Description"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.description?.message}
              maxLength={500}
              minLines={3}
              maxLines={5}
            />
          )}
        />

        {/* Date / time */}
        <View>
          <Text
            style={[
              theme.typography.bodySmallMedium,
              { color: theme.colors.text.secondary, marginBottom: 6 },
            ]}
          >
            Start time
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={({ pressed }) => [
              styles.dateField,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
              },
              pressed && { backgroundColor: theme.colors.bg.subtle },
            ]}
          >
            <CalIcon size={18} color={theme.colors.text.tertiary} />
            <Text
              style={[
                theme.typography.body,
                {
                  color: startTimeValue
                    ? theme.colors.text.primary
                    : theme.colors.text.tertiary,
                  marginLeft: 8,
                  flex: 1,
                },
              ]}
            >
              {startTimeValue ? formatDateTime(startTimeValue) : 'Pick a date and time'}
            </Text>
            {startTimeValue ? (
              <Pressable
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  setValue('startTime', null, { shouldDirty: true });
                }}
              >
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.danger },
                  ]}
                >
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              mode="datetime"
              value={startTimeValue ? new Date(startTimeValue) : new Date()}
              onChange={handleDatePicked}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
          ) : null}
        </View>

        <AddressAutocomplete
          label="Address / neighborhood"
          placeholder="e.g. Williamsburg, Brooklyn"
          value={addressText}
          onChangeText={(t) => {
            setAddressText(t);
            setValue('locationAddress', t, { shouldDirty: true });
          }}
          onSelectPlace={handlePlaceSelected}
        />

        <Controller
          control={control}
          name="locationName"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Display name (optional)"
              placeholder="e.g. Mike's place, Rooftop bar"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.locationName?.message}
              maxLength={100}
              trailing={<MapPin size={18} color={theme.colors.text.tertiary} />}
            />
          )}
        />

        <Button
          label="Save changes"
          onPress={handleSubmit(onSubmit)}
          loading={updateHangout.isPending}
          disabled={!isDirty || updateHangout.isPending}
          fullWidth
          size="lg"
        />
      </View>
     {isHost ? (
      <>
      <SectionHeader title="Danger zone" />
      <Card padding="md" variant="subtle">
        {!isCancelled ? (
          <Button
            label="Cancel hangout"
            variant="ghost"
            onPress={handleCancel}
            loading={cancelHangout.isPending}
            fullWidth
          />
        ) : null}
        <Button
          label="Delete forever"
          variant="ghost"
          leadingIcon={<Trash2 size={16} color={theme.colors.danger} />}
          onPress={handleDelete}
          loading={deleteHangout.isPending}
          fullWidth
          style={{ marginTop: 8 }}
        />
      </Card>
     </>) 
    : null}
    </Screen>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })} • ${d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

const styles = StyleSheet.create({
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 48,
  },
});
