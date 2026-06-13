import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import {
  Clapperboard,
  Tv,
  SkipForward,
  ChevronRight,
  CalendarDays,
  Navigation,
  ListOrdered,
  Vote as VoteIcon,
} from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button } from '@/components/ui';
import { SummaryRow } from '@/components/ui/SummaryRow';
import { useTheme } from '@/hooks/useTheme';
import { ParticipantPicker } from '@/features/hangouts';
import { AddressAutocomplete } from '@/features/places';
import { useSaveSearchLocation } from '@/features/places/hooks/useSearchLocation';
import type { PlaceDetails } from '@/features/places';
import { ActivityVenuePicker, type ActivityVenueOption } from '@/features/polls';
import { StartTimeSheet, VotingStyleSheet, type VotingMethod } from '@/features/polls';
import { MoviePicker, type MovieOption } from '@/features/movies';
import { useCreateActivityHangout } from '@/features/polls';

type Step = 'mode' | 'pick' | 'venue' | 'invite' | 'details';
type Mode = 'cinema' | 'streaming' | 'skip';

type FormState = {
  title: string;
  description: string;
  locationName: string;
  locationAddress: string;
  inviteUserIds: string[];
  movieOptions: MovieOption[];
  venueOptions: ActivityVenueOption[];
  votingMethod: VotingMethod;
  startTime: Date | null;
};

export default function NewMovieScreen(): React.ReactElement {
  const theme = useTheme();
  const { prefilledTitle } = useLocalSearchParams<{ prefilledTitle?: string }>();
  const createMutation = useCreateActivityHangout();
  const saveSearchLocation = useSaveSearchLocation();

  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<Mode | null>(null);
  const [showStartTimeSheet, setShowStartTimeSheet] = useState(false);
  const [showVotingStyleSheet, setShowVotingStyleSheet] = useState(false);
  const [addressText, setAddressText] = useState('');
  const [locatingMe, setLocatingMe] = useState(false);

  const { control, watch, setValue, getValues } = useForm<FormState>({
    defaultValues: {
      title: prefilledTitle ?? 'Movie night',
      description: '',
      locationName: '',
      locationAddress: '',
      inviteUserIds: [],
      movieOptions: [],
      venueOptions: [],
      votingMethod: 'simple',
      startTime: null,
    },
  });

  const movieOptions = watch('movieOptions');
  const venueOptions = watch('venueOptions');
  const inviteUserIds = watch('inviteUserIds');
  const votingMethod = watch('votingMethod');
  const startTime = watch('startTime');
  const title = watch('title');

  // Movies + (cinema venues, only when there are movies) form one merged poll.
  const pollOptionCount = movieOptions.length + (movieOptions.length > 0 ? venueOptions.length : 0);

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

  const canProceedFromPick = movieOptions.length >= 1;

  const handleSubmit = (): void => {
    const v = getValues();
    if (!v.title.trim()) return;

    const pollOptions = v.movieOptions.map((m) => ({
      label: m.title,
      emoji: m.mediaType === 'tv' ? '📺' : '🎬',
    }));

    const venueOpts = v.venueOptions.map((u) => ({
      label: u.name,
      metadata: {
        placeId: u.placeId ?? null,
        address: u.address ?? null,
        rating: u.rating ?? null,
        priceLevel: u.priceLevel ?? null,
        primaryType: u.primaryType ?? null,
        mapsUrl: u.mapsUrl ?? null,
        isCustom: u.isCustom ?? false,
      },
    }));

    // Merge movie + venue into one poll if we have both, otherwise just movies
    const allOptions = pollOptions.length > 0
      ? [...pollOptions, ...(venueOpts.length > 0 ? venueOpts : [])]
      : null;

    const finalDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

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
        poll: allOptions && allOptions.length >= 1
          ? {
              mode: 'simple_vote',
              votingMethod: allOptions.length >= 2 ? v.votingMethod : 'simple',
              voteDeadline: finalDeadline,
              options: allOptions,
            }
          : null,
      },
      {
        onSuccess: ({ hangoutId }) => router.replace(`/hangout/${hangoutId}`),
      },
    );
  };

  // ── Step: Mode ──
  if (step === 'mode') {
    return (
      <Screen header={{ title: 'Movie night', showClose: true }} contentPadding={16}>
        <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>
          How are we watching?
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4, marginBottom: 24 }]}>
          Pick a vibe — you can always adjust later.
        </Text>
        <View style={{ gap: 12 }}>
          <FlowChoice
            icon={<Clapperboard size={24} color={theme.colors.accent} strokeWidth={1.8} />}
            title="At the cinema"
            subtitle="Browse what's playing in theaters + pick a venue to vote on."
            onPress={() => { setMode('cinema'); setStep('pick'); }}
          />
          <FlowChoice
            icon={<Tv size={24} color={theme.colors.accent} strokeWidth={1.8} />}
            title="Watch at home — streaming"
            subtitle="Browse Netflix, Hulu, Max, Disney+ and more. Vote on a title."
            onPress={() => { setMode('streaming'); setStep('pick'); }}
          />
          <FlowChoice
            icon={<SkipForward size={24} color={theme.colors.text.secondary} strokeWidth={1.8} />}
            title="We already know what we're watching"
            subtitle="Skip straight to creating the hangout."
            onPress={() => { setMode('skip'); setStep('invite'); }}
          />
        </View>
      </Screen>
    );
  }

  // ── Step: Pick movies ──
  if (step === 'pick' && mode !== 'skip') {
    return (
      <Screen
        header={{
          title: mode === 'cinema' ? 'What to watch?' : 'Pick titles to vote on',
          showBack: true,
          onBack: () => setStep('mode'),
        }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            <MoviePicker
              mode={mode!}
              value={movieOptions}
              onChange={(opts) => setValue('movieOptions', opts)}
              participantIds={inviteUserIds}
              min={1}
              max={8}
            />
          </View>
          <View style={[styles.bottomBar, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
            <Button
              label={
                !canProceedFromPick
                  ? 'Pick at least 1 title'
                  : mode === 'cinema'
                    ? 'Next: pick a cinema →'
                    : `Continue with ${movieOptions.length} title${movieOptions.length > 1 ? 's' : ''}`
              }
              onPress={() => mode === 'cinema' ? setStep('venue') : setStep('invite')}
              disabled={!canProceedFromPick}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </Screen>
    );
  }

  // ── Step: Venue (cinema only) ──
  if (step === 'venue') {
    return (
      <Screen
        header={{
          title: '🎥 Cinemas near you',
          showBack: true,
          onBack: () => setStep('pick'),
        }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginBottom: 10 }]}>
              Add cinemas to vote on, or skip and decide in person.
            </Text>
            <ActivityVenuePicker
              activityQuery="movie theater"
              activityLabel="Cinema"
              includedTypes={['movie_theater']}
              value={venueOptions}
              onChange={(opts) => setValue('venueOptions', opts)}
              min={0}
              max={6}
            />
          </View>
          <View style={[styles.bottomBar, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
            <Button
              label={venueOptions.length > 0 ? `Continue with ${venueOptions.length} cinema${venueOptions.length > 1 ? 's' : ''}` : "Skip — we'll figure it out"}
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
        header={{ title: 'Invite friends', showBack: true, onBack: () => setStep(mode === 'cinema' ? 'venue' : mode === 'streaming' ? 'pick' : 'mode') }}
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
                placeholder="Movie night"
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
                placeholder="Snacks, dress code, BYOB…"
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
              label="Where? (optional)"
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
          {pollOptionCount >= 2 ? (
            <SummaryRow
              label="Voting style"
              icon={
                votingMethod === 'ranked' ? (
                  <ListOrdered size={18} color={theme.colors.text.tertiary} />
                ) : (
                  <VoteIcon size={18} color={theme.colors.text.tertiary} />
                )
              }
              value={votingMethod === 'ranked' ? 'Ranked vote' : 'Simple vote'}
              onPress={() => setShowVotingStyleSheet(true)}
            />
          ) : null}
        </ScrollView>

        <View style={[styles.bottomBar, { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas }]}>
          <Button
            label={movieOptions.length > 0 ? 'Create & start vote' : 'Create hangout'}
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

      <VotingStyleSheet
        visible={showVotingStyleSheet}
        onClose={() => setShowVotingStyleSheet(false)}
        value={votingMethod}
        onChange={(m) => setValue('votingMethod', m)}
      />
    </Screen>
  );
}

function FlowChoice({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.flowChoice,
        { backgroundColor: theme.colors.bg.surface, borderColor: theme.colors.border.default },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.flowChoiceIcon, { backgroundColor: theme.colors.accent + '18' }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>{title}</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={theme.colors.text.tertiary} />
    </Pressable>
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
  flowChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  flowChoiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
});
