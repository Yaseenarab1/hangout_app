import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Navigation, MapPin, ChevronRight, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Textarea, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { AddressAutocomplete } from '@/features/places';
import { useSaveSearchLocation } from '@/features/places/hooks/useSearchLocation';
import type { PlaceDetails } from '@/features/places';
import {
  createHangoutSchema,
  type CreateHangoutInput,
  useCreateHangout,
  ParticipantPicker,
} from '@/features/hangouts';

type Step = 'details' | 'invite';

function StepDots({ step }: { step: Step }) {
  return (
    <View style={styles.dots}>
      <View style={[styles.dot, step === 'details' && styles.dotActive]} />
      <View style={[styles.dot, step === 'invite' && styles.dotActive]} />
    </View>
  );
}

export default function NewHangoutScreen(): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const createHangout = useCreateHangout();
  const [step, setStep] = useState<Step>('details');
  const [addressText, setAddressText] = useState('');
  const [locatingMe, setLocatingMe] = useState(false);
  const saveSearchLocation = useSaveSearchLocation();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<CreateHangoutInput>({
    resolver: zodResolver(createHangoutSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      locationName: '',
      locationAddress: '',
      inviteUserIds: [],
    },
  });

  const inviteUserIds = watch('inviteUserIds');

  function handlePlaceSelected(place: PlaceDetails) {
    setAddressText(place.address);
    setValue('locationAddress', place.address, { shouldDirty: true });
    if (!watch('locationName')?.trim()) {
      setValue('locationName', place.name, { shouldDirty: true });
    }
    if (place.location) {
      saveSearchLocation.mutate({ name: place.name, lat: place.location.lat, lng: place.location.lng });
    }
  }

  async function handleMyLocation() {
    setLocatingMe(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location access denied', 'Enable location in Settings to use this feature.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = pos.coords;
      saveSearchLocation.mutate({ name: 'Current location', lat, lng });
      setValue('locationName', 'Current location', { shouldDirty: true });
      setValue('locationAddress', '', { shouldDirty: true });
      setAddressText('');
    } catch {
      // silently fail
    } finally {
      setLocatingMe(false);
    }
  }

  const onSubmit = (input: CreateHangoutInput): void => {
    createHangout.mutate(input, {
      onSuccess: (hangout) => {
        router.replace(`/hangout/${hangout.id}`);
      },
    });
  };

  const headerTop = insets.top + 12;

  if (step === 'details') {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Nav bar */}
        <View style={[styles.navBar, { paddingTop: headerTop, backgroundColor: theme.colors.bg.canvas }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, { backgroundColor: theme.colors.bg.subtle, opacity: pressed ? 0.6 : 1 }]}
          >
            <X size={18} color={theme.colors.text.primary} strokeWidth={2} />
          </Pressable>
          <StepDots step="details" />
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🗓️</Text>
            <Text style={[theme.typography.h2, { color: theme.colors.text.primary, marginTop: 12, letterSpacing: -0.5 }]}>
              What's the plan?
            </Text>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}>
              You can always fill in details later.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Controller
              control={control}
              name="title"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="Name it"
                  placeholder="Movie night, brunch with the crew…"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.title?.message}
                  maxLength={100}
                  returnKeyType="next"
                  autoFocus
                />
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({ field: { value, onChange, onBlur } }) => (
                <Textarea
                  label="Details (optional)"
                  placeholder="Wear something nice. Pre-game at 7."
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

            {/* Location */}
            <View>
              <AddressAutocomplete
                label="Where? (optional)"
                placeholder="Search a neighborhood or venue…"
                value={addressText}
                onChangeText={(t) => {
                  setAddressText(t);
                  setValue('locationAddress', t, { shouldDirty: true });
                }}
                onSelectPlace={handlePlaceSelected}
                error={errors.locationAddress?.message}
              />
              <Pressable
                onPress={handleMyLocation}
                disabled={locatingMe}
                style={styles.locationBtn}
              >
                <Navigation size={13} color={theme.colors.accent} />
                <Text style={[theme.typography.caption, { color: theme.colors.accent, marginLeft: 5 }]}>
                  {locatingMe ? 'Getting location…' : 'Use my current location'}
                </Text>
              </Pressable>
            </View>

            {watch('locationName') ? (
              <Controller
                control={control}
                name="locationName"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Display name (optional)"
                    placeholder="e.g. Mike's rooftop, Club XYZ"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.locationName?.message}
                    maxLength={100}
                    trailing={<MapPin size={18} color={theme.colors.text.tertiary} />}
                  />
                )}
              />
            ) : null}
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 8 : 16),
              backgroundColor: theme.colors.bg.canvas,
              borderTopColor: theme.colors.border.default,
            },
          ]}
        >
          <Button
            label="Next: invite friends"
            trailingIcon={<ChevronRight size={16} color="#FFFFFF" />}
            onPress={() => setStep('invite')}
            disabled={!isValid || !watch('title')}
            fullWidth
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2: Invite ────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg.canvas }]}>
      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: headerTop, backgroundColor: theme.colors.bg.canvas }]}>
        <Pressable
          onPress={() => setStep('details')}
          hitSlop={12}
          style={({ pressed }) => [styles.closeBtn, { backgroundColor: theme.colors.bg.subtle, opacity: pressed ? 0.6 : 1 }]}
        >
          <ChevronRight
            size={18}
            color={theme.colors.text.primary}
            strokeWidth={2}
            style={{ transform: [{ rotate: '180deg' }] }}
          />
        </Pressable>
        <StepDots step="invite" />
        <View style={{ width: 36 }} />
      </View>

      {/* Header */}
      <View style={styles.inviteHeader}>
        <Text style={styles.heroEmoji}>👥</Text>
        <Text style={[theme.typography.h2, { color: theme.colors.text.primary, marginTop: 12, letterSpacing: -0.5 }]}>
          Invite friends
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}>
          You can always invite more people later.
        </Text>
      </View>

      {/* Picker */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <Controller
          control={control}
          name="inviteUserIds"
          render={({ field: { value, onChange } }) => (
            <ParticipantPicker
              value={value}
              onChange={onChange}
              title="Friends to invite"
            />
          )}
        />
      </View>

      {/* Sticky footer */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 8 : 16),
            backgroundColor: theme.colors.bg.canvas,
            borderTopColor: theme.colors.border.default,
          },
        ]}
      >
        <Button
          label={
            inviteUserIds.length === 0
              ? 'Create hangout'
              : `Create & invite ${inviteUserIds.length}`
          }
          leadingIcon={inviteUserIds.length === 0
            ? undefined
            : <Users size={16} color="#FFFFFF" />}
          onPress={handleSubmit(onSubmit)}
          loading={createHangout.isPending}
          disabled={createHangout.isPending}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },
  heroEmoji: {
    fontSize: 48,
  },
  form: {
    gap: 16,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inviteHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
});
