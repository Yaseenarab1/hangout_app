import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { ChevronRight, CalendarDays, Navigation, Play, Tv } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button } from '@/components/ui';
import { SummaryRow } from '@/components/ui/SummaryRow';
import { useTheme } from '@/hooks/useTheme';
import { ParticipantPicker } from '@/features/hangouts';
import { AddressAutocomplete } from '@/features/places';
import { useSaveSearchLocation } from '@/features/places/hooks/useSearchLocation';
import type { PlaceDetails } from '@/features/places';
import { StartTimeSheet } from '@/features/polls';
import { useCreateVenueHangout } from '@/features/polls';
import { SportPicker, SportVenuePicker, type Sport, type SportVenueOption } from '@/features/sports';

type Step = 'sport' | 'mode' | 'venue' | 'invite' | 'details';
type SportMode = 'play' | 'watch';

type FormState = {
  title: string;
  description: string;
  locationName: string;
  locationAddress: string;
  inviteUserIds: string[];
  venueOptions: SportVenueOption[];
  startTime: Date | null;
};

export default function NewSportsScreen(): React.ReactElement {
  const theme = useTheme();
  const { prefilledTitle } = useLocalSearchParams<{ prefilledTitle?: string }>();
  const createMutation = useCreateVenueHangout();
  const saveSearchLocation = useSaveSearchLocation();

  const [step, setStep] = useState<Step>('sport');
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [sportMode, setSportMode] = useState<SportMode>('play');
  const [showStartTimeSheet, setShowStartTimeSheet] = useState(false);
  const [addressText, setAddressText] = useState('');
  const [locatingMe, setLocatingMe] = useState(false);

  const { control, watch, setValue, getValues } = useForm<FormState>({
    defaultValues: {
      title: prefilledTitle ?? '',
      description: '',
      locationName: '',
      locationAddress: '',
      inviteUserIds: [],
      venueOptions: [],
      startTime: null,
    },
  });

  const venueOptions = watch('venueOptions');
  const inviteUserIds = watch('inviteUserIds');
  const startTime = watch('startTime');
  const title = watch('title');

  function handlePlaceSelected(place: PlaceDetails) {
    setAddressText(place.address);
    setValue('locationAddress', place.address);
    if (!watch('locationName')?.trim()) setValue('locationName', place.name);
    if (place.location) {
      saveSearchLocation.mutate({ name: place.name, lat: place.location.lat, lng: place.location.lng });
    }
  }

  async function useMyLocation() {
    setLocatingMe(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      saveSearchLocation.mutate({ name: 'Current location', lat: pos.coords.latitude, lng: pos.coords.longitude });
      setValue('locationName', 'Current location');
      setValue('locationAddress', '');
      setAddressText('');
    } catch { /* silently fail */ }
    finally { setLocatingMe(false); }
  }

  function handleSportSelect(sport: Sport): void {
    setSelectedSport(sport);
    setValue('title', `${sport.label} hangout`);
    setStep('mode');
  }

  function handleModeSelect(mode: SportMode): void {
    setSportMode(mode);
    if (selectedSport) {
      setValue('title', mode === 'watch'
        ? `Watch ${selectedSport.label}`
        : `${selectedSport.label} hangout`);
    }
    setStep('venue');
  }

  const handleSubmit = (): void => {
    const v = getValues();
    if (!selectedSport || !v.title.trim()) return;

    const finalDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pollOptions = v.venueOptions.map((u) => ({
      label: u.name,
      metadata: {
        placeId: u.placeId ?? null,
        address: u.address ?? null,
        rating: u.rating ?? null,
        priceLevel: u.priceLevel ?? null,
        primaryType: u.primaryType ?? null,
        mapsUrl: u.mapsUrl ?? null,
        isCustom: false,
      },
    }));

    const pollTitle = sportMode === 'watch'
      ? `Where should we watch ${selectedSport.label.toLowerCase()}?`
      : `Where should we play ${selectedSport.label.toLowerCase()}?`;

    createMutation.mutate(
      {
        hangout: {
          title: v.title.trim(),
          description: v.description.trim() || undefined,
          startTime: v.startTime ? v.startTime.toISOString() : undefined,
          locationName: v.locationName.trim() || undefined,
          locationAddress: v.locationAddress.trim() || undefined,
          inviteUserIds: v.inviteUserIds,
        },
        poll: pollOptions.length >= 1
          ? {
              title: pollTitle,
              votingMethod: 'simple',
              voteDeadline: finalDeadline,
              options: pollOptions,
            }
          : null,
      },
      {
        onSuccess: ({ hangoutId }) => router.replace(`/hangout/${hangoutId}`),
      },
    );
  };

  // ── Step: Sport pick ──
  if (step === 'sport') {
    return (
      <Screen header={{ title: 'Sports', showClose: true }} scroll contentPadding={16}>
        <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>
          What sport?
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4, marginBottom: 24 }]}>
          We'll find places to play near you.
        </Text>
        <SportPicker onSelect={handleSportSelect} />
      </Screen>
    );
  }

  // ── Step: Mode (play or watch) ──
  if (step === 'mode' && selectedSport) {
    return (
      <Screen
        header={{ title: `${selectedSport.emoji} ${selectedSport.label}`, showBack: true, onBack: () => setStep('sport') }}
        scroll
        contentPadding={16}
      >
        <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>
          Play or watch?
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4, marginBottom: 28 }]}>
          We'll find the right spots based on your answer.
        </Text>
        <View style={styles.modeOptions}>
          <Pressable
            onPress={() => handleModeSelect('play')}
            style={({ pressed }) => [
              styles.modeCard,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={[styles.modeIcon, { backgroundColor: theme.colors.accent + '18' }]}>
              <Play size={28} color={theme.colors.accent} fill={theme.colors.accent} />
            </View>
            <Text style={[theme.typography.h3, { color: theme.colors.text.primary, marginTop: 12 }]}>
              Play {selectedSport.emoji}
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, marginTop: 4, textAlign: 'center' }]}>
              Find courts, fields & gyms near you
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleModeSelect('watch')}
            style={({ pressed }) => [
              styles.modeCard,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={[styles.modeIcon, { backgroundColor: theme.colors.accent + '18' }]}>
              <Tv size={28} color={theme.colors.accent} />
            </View>
            <Text style={[theme.typography.h3, { color: theme.colors.text.primary, marginTop: 12 }]}>
              Watch {selectedSport.emoji}
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, marginTop: 4, textAlign: 'center' }]}>
              Find sports bars & watch parties
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── Step: Venue ──
  if (step === 'venue' && selectedSport) {
    const venueTitle = sportMode === 'watch'
      ? `📺 Watch ${selectedSport.label}`
      : `${selectedSport.emoji} ${selectedSport.label} near you`;
    const watchSport: Sport = {
      ...selectedSport,
      query: 'sports bar',
      freeHint: false,
    };
    const activeSport = sportMode === 'watch' ? watchSport : selectedSport;
    return (
      <Screen
        header={{
          title: venueTitle,
          showBack: true,
          onBack: () => setStep('mode'),
        }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            <SportVenuePicker
              sport={activeSport}
              value={venueOptions}
              onChange={(opts) => setValue('venueOptions', opts)}
              min={0}
              max={6}
            />
          </View>
          <View style={[styles.bottomBar, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
            <Button
              label={venueOptions.length > 0 ? `Continue with ${venueOptions.length} venue${venueOptions.length > 1 ? 's' : ''}` : "We'll figure it out"}
              trailingIcon={<ChevronRight size={16} color="#FFFFFF" />}
              onPress={() => setStep('invite')}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </Screen>
    );
  }

  // ── Step: Invite ──
  if (step === 'invite') {
    return (
      <Screen
        header={{ title: 'Invite friends', showBack: true, onBack: () => setStep('venue') }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, marginBottom: 12 }]}>
              You can invite more later.
            </Text>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="inviteUserIds"
                render={({ field: { value, onChange } }) => (
                  <ParticipantPicker value={value} onChange={onChange} title="Friends to invite" />
                )}
              />
            </View>
          </View>
          <View style={[styles.bottomBar, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
            <Button
              label={inviteUserIds.length === 0 ? 'Continue without inviting' : `Invite ${inviteUserIds.length} & continue`}
              trailingIcon={<ChevronRight size={16} color="#FFFFFF" />}
              onPress={() => setStep('details')}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </Screen>
    );
  }

  // ── Step: Details ──
  return (
    <Screen
      header={{ title: 'Final touches', showBack: true, onBack: () => setStep('invite') }}
      contentPadding={0}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Title"
                placeholder={selectedSport ? `${selectedSport.label} hangout` : 'Sports hangout'}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                maxLength={100}
                autoFocus
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur } }) => (
              <Textarea
                label="Anything else? (optional)"
                placeholder="Gear to bring, skill level, etc."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                maxLength={500}
                minLines={2}
                maxLines={4}
              />
            )}
          />
          <View>
            <AddressAutocomplete
              label="Meeting point (optional)"
              placeholder="Search an address, neighborhood…"
              value={addressText}
              onChangeText={(t) => { setAddressText(t); setValue('locationAddress', t); }}
              onSelectPlace={handlePlaceSelected}
            />
            <Pressable onPress={useMyLocation} disabled={locatingMe} style={styles.locationBtn}>
              <Navigation size={13} color={theme.colors.accent} />
              <Text style={[theme.typography.caption, { color: theme.colors.accent, marginLeft: 4 }]}>
                {locatingMe ? 'Getting location…' : 'Use my current location'}
              </Text>
            </Pressable>
          </View>
          <SummaryRow
            label="When?"
            icon={<CalendarDays size={18} color={theme.colors.text.tertiary} />}
            value={startTime ? formatDate(startTime) : "We'll figure it out"}
            onPress={() => setShowStartTimeSheet(true)}
            highlightValue={startTime !== null}
          />
        </ScrollView>

        <View style={[styles.bottomBar, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
          <Button
            label={venueOptions.length > 0 ? 'Create & start venue vote' : 'Create hangout'}
            onPress={handleSubmit}
            loading={createMutation.isPending}
            disabled={!title.trim() || createMutation.isPending}
            fullWidth
            size="lg"
          />
        </View>
      </View>

      <StartTimeSheet
        visible={showStartTimeSheet}
        onClose={() => setShowStartTimeSheet(false)}
        value={startTime}
        onChange={(d) => setValue('startTime', d)}
      />
    </Screen>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  bottomBar: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  modeOptions: {
    flexDirection: 'row',
    gap: 14,
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
