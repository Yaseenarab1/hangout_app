import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import {
  ChevronRight,
  Compass,
  MapPin,
  SkipForward,
  Vote as VoteIcon,
  ListOrdered,
  Calendar as CalIcon,
  Clock,
  Search as SearchIcon,
  Navigation,
} from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button } from '@/components/ui';
import { SummaryRow } from '@/components/ui/SummaryRow';
import { useTheme } from '@/hooks/useTheme';
import { AddressAutocomplete } from '@/features/places';
import { useSaveSearchLocation } from '@/features/places/hooks/useSearchLocation';
import type { PlaceDetails } from '@/features/places';
import { ParticipantPicker } from '@/features/hangouts';
import {
  ActivityOptionPicker,
  type ActivityOption,
  useCreateActivityHangout,
  type VotingMethod,
  VotingStyleSheet,
  VoteDeadlineSheet,
  StartTimeSheet,
  ACTIVITY_CATALOG,
  ACTIVITY_CATEGORIES,
} from '@/features/polls';

type Step = 'flow' | 'options' | 'pick_one' | 'invite' | 'details';
type Flow =
  | 'activity_only'         // vote on activities, no venue follow-up
  | 'activity_then_venue'   // vote on activities, then venue poll after
  | 'know_what_find_where'  // skip activity vote, pick activity inline, go straight to venue picker
  | 'know_everything';      // skip everything

type FormState = {
  title: string;
  description: string;
  locationName: string;
  locationAddress: string;
  inviteUserIds: string[];
  options: ActivityOption[];
  /** Single activity selected for know_what_find_where path. */
  pickedActivity: { label: string; emoji?: string; placesQuery?: string } | null;
  voteDeadline: Date | null;
  startTime: Date | null;
  votingMethod: VotingMethod;
};

export default function NewActivityHangoutScreen(): React.ReactElement {
  const theme = useTheme();
  const createMutation = useCreateActivityHangout();

  const [step, setStep] = useState<Step>('flow');
  const [flow, setFlow] = useState<Flow | null>(null);

  const [showVotingStyleSheet, setShowVotingStyleSheet] = useState(false);
  const [showDeadlineSheet, setShowDeadlineSheet] = useState(false);
  const [showStartTimeSheet, setShowStartTimeSheet] = useState(false);

  const { control, watch, setValue, getValues } = useForm<FormState>({
    defaultValues: {
      title: '',
      description: '',
      locationName: '',
      locationAddress: '',
      inviteUserIds: [],
      options: [],
      pickedActivity: null,
      voteDeadline: null,
      startTime: null,
      votingMethod: 'simple',
    },
  });

  const [addressText, setAddressText] = useState('');
  const [locatingMe, setLocatingMe] = useState(false);
  const saveSearchLocation = useSaveSearchLocation();

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
      if (status !== 'granted') {
        Alert.alert('Location access denied', 'Enable location in Settings to use this feature.');
        setLocatingMe(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = pos.coords;
      saveSearchLocation.mutate({ name: 'Current location', lat, lng });
      setValue('locationName', 'Current location');
      setValue('locationAddress', '');
      setAddressText('');
    } catch {
      // silently fail
    } finally {
      setLocatingMe(false);
    }
  }

  const options = watch('options');
  const pickedActivity = watch('pickedActivity');
  const inviteUserIds = watch('inviteUserIds');
  const voteDeadline = watch('voteDeadline');
  const startTime = watch('startTime');
  const title = watch('title');
  const votingMethod = watch('votingMethod');

  const usesActivityPoll =
    flow === 'activity_only' || flow === 'activity_then_venue';
  const isDirectVenue = flow === 'know_what_find_where';
  const isNoPoll = flow === 'know_everything';

  const handleSubmit = (): void => {
    const v = getValues();
    if (!flow || !v.title.trim()) return;

    if (isDirectVenue) {
      // Create the hangout, then push to follow-up-venue with the picked activity
      const finalDeadline = v.voteDeadline ?? new Date(Date.now() + 60 * 60 * 1000);
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
          poll: null, // no activity poll
        },
        {
          onSuccess: ({ hangoutId }) => {
            // Hand off to the venue picker route — same one used for follow-ups
            router.replace({
              pathname: '/hangout/[id]/follow-up-venue',
              params: {
                id: hangoutId,
                activity: v.pickedActivity?.label ?? 'venue',
                query: v.pickedActivity?.placesQuery ?? v.pickedActivity?.label ?? '',
                returnDeadline: finalDeadline.toISOString(),
              },
            });
          },
        },
      );
      return;
    }

    if (isNoPoll) {
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
          poll: null,
        },
        {
          onSuccess: ({ hangoutId }) => {
            router.replace(`/hangout/${hangoutId}`);
          },
        },
      );
      return;
    }

    // Activity-poll paths (activity_only, activity_then_venue)
    const finalDeadline = v.voteDeadline ?? new Date(Date.now() + 60 * 60 * 1000);
    createMutation.mutate(
      {
        hangout: {
          title: v.title.trim(),
          description: v.description.trim() || undefined,
          startTime: v.startTime ? v.startTime.toISOString() : undefined,
          locationName: v.locationName.trim() || undefined,
          inviteUserIds: v.inviteUserIds,
        },
        poll: {
          mode: 'simple_vote',
          votingMethod: v.votingMethod,
          voteDeadline: finalDeadline.toISOString(),
          options: v.options.map((o) => ({
            label: o.label,
            catalogId: o.catalogId,
            emoji: o.emoji,
          })),
        },
      },
      {
        onSuccess: ({ hangoutId }) => {
          router.replace(`/hangout/${hangoutId}`);
        },
      },
    );
  };

  // ============= Step: Flow =============
  if (step === 'flow') {
    return (
      <Screen header={{ title: 'Find what to do', showClose: true }} contentPadding={16}>
        <Text style={[theme.typography.h2, { color: theme.colors.text.primary }]}>
          How are we deciding?
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text.secondary, marginTop: 4, marginBottom: 24 },
          ]}
        >
          Pick a path — you can always adjust later.
        </Text>

        <View style={{ gap: 12 }}>
          <FlowChoice
            icon={<Compass size={24} color={theme.colors.accent} />}
            title="Just pick an activity"
            subtitle="Vote on what to do. Decide where in person."
            onPress={() => {
              setFlow('activity_only');
              setStep('options');
            }}
          />
          <FlowChoice
            icon={<MapPin size={24} color={theme.colors.accent} />}
            title="Activity, then where"
            subtitle="Vote on what to do. Then vote on specific places."
            onPress={() => {
              setFlow('activity_then_venue');
              setStep('options');
            }}
          />
          <FlowChoice
            icon={<SearchIcon size={24} color={theme.colors.accent} />}
            title="I know what to do, find where"
            subtitle="Pick the activity, then we vote on specific places (e.g. bars, escape rooms)."
            onPress={() => {
              setFlow('know_what_find_where');
              setStep('pick_one');
            }}
          />
          <FlowChoice
            icon={<SkipForward size={24} color={theme.colors.text.secondary} />}
            title="I know everything"
            subtitle="Skip the polls, just create the hangout."
            onPress={() => {
              setFlow('know_everything');
              setStep('invite');
            }}
          />
        </View>
      </Screen>
    );
  }

  // ============= Step: pick_one (single activity for direct-venue path) =============
  if (step === 'pick_one') {
    return (
      <Screen
        header={{
          title: 'What activity?',
          showBack: true,
          onBack: () => setStep('flow'),
        }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={[
                theme.typography.bodySmall,
                { color: theme.colors.text.secondary, marginBottom: 16 },
              ]}
            >
              Pick what you want to do. We'll find specific places for it next.
            </Text>

            {ACTIVITY_CATEGORIES.map((cat) => {
              const items = ACTIVITY_CATALOG.filter((a) => a.category === cat.id);
              if (items.length === 0) return null;
              return (
                <View key={cat.id} style={{ marginBottom: 16 }}>
                  <View style={styles.categoryHeader}>
                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                    <Text
                      style={[
                        theme.typography.bodySmallMedium,
                        { color: theme.colors.text.secondary, marginLeft: 6 },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </View>
                  <View style={styles.chipsWrap}>
                    {items.map((item) => {
                      const isSelected = pickedActivity?.label === item.label;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            setValue('pickedActivity', {
                              label: item.label,
                              emoji: item.emoji,
                              placesQuery: item.placesQuery,
                            });
                          }}
                          style={({ pressed }) => [
                            styles.catalogChip,
                            {
                              backgroundColor: isSelected
                                ? cat.color + '30'
                                : cat.color + '10',
                              borderColor: isSelected
                                ? cat.color
                                : cat.color + '40',
                              borderWidth: isSelected ? 1.5 : 1,
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={{ fontSize: 16, marginRight: 6 }}>
                            {item.emoji}
                          </Text>
                          <Text
                            style={[
                              theme.typography.bodySmall,
                              {
                                color: theme.colors.text.primary,
                                fontWeight: isSelected ? '600' : '400',
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Custom free-text option */}
            <View style={{ marginTop: 8, marginBottom: 24 }}>
              <Text
                style={[
                  theme.typography.bodySmallMedium,
                  { color: theme.colors.text.secondary, marginBottom: 8 },
                ]}
              >
                Or describe it yourself
              </Text>
              <Input
                placeholder="e.g. rooftop bar, vegan bakery, axe throwing"
                value={
                  pickedActivity && !pickedActivity.placesQuery
                    ? pickedActivity.label
                    : ''
                }
                onChangeText={(text) => {
                  if (text.trim()) {
                    setValue('pickedActivity', { label: text.trim() });
                  } else {
                    setValue('pickedActivity', null);
                  }
                }}
                maxLength={100}
              />
            </View>
          </ScrollView>

          <View
            style={[
              styles.bottomBar,
              {
                borderTopColor: theme.colors.border.default,
                backgroundColor: theme.colors.bg.canvas,
              },
            ]}
          >
            <Button
              label={pickedActivity ? 'Next: invite friends' : 'Pick an activity'}
              trailingIcon={
                pickedActivity ? <ChevronRight size={16} color="#FFFFFF" /> : undefined
              }
              onPress={() => setStep('invite')}
              disabled={!pickedActivity}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </Screen>
    );
  }

  // ============= Step: options (activity poll) =============
  if (step === 'options' && usesActivityPoll) {
    return (
      <Screen
        header={{
          title: 'Pick options',
          showBack: true,
          onBack: () => setStep('flow'),
        }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            {flow === 'activity_then_venue' ? (
              <View
                style={[
                  styles.flowHint,
                  {
                    backgroundColor: theme.colors.accent + '10',
                    borderColor: theme.colors.accent + '40',
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  After the vote, we'll help you pick specific places for the winning activity.
                </Text>
              </View>
            ) : null}

            <Controller
              control={control}
              name="options"
              render={({ field: { value, onChange } }) => (
                <View style={{ flex: 1 }}>
                  <ActivityOptionPicker
                    value={value}
                    onChange={onChange}
                    min={2}
                    max={10}
                  />
                </View>
              )}
            />
          </View>

          <View
            style={[
              styles.summarySection,
              { borderTopColor: theme.colors.border.default },
            ]}
          >
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
            <SummaryRow
              label="Voting closes"
              icon={<Clock size={18} color={theme.colors.text.tertiary} />}
              value={voteDeadline ? formatDate(voteDeadline) : 'In 1 hour'}
              onPress={() => setShowDeadlineSheet(true)}
              showTopSeparator
            />
          </View>

          <View
            style={[
              styles.bottomBar,
              {
                borderTopColor: theme.colors.border.default,
                backgroundColor: theme.colors.bg.canvas,
              },
            ]}
          >
            <Button
              label={
                options.length < 2
                  ? `Pick ${2 - options.length} more to continue`
                  : 'Next: invite friends'
              }
              trailingIcon={
                options.length >= 2 ? <ChevronRight size={16} color="#FFFFFF" /> : undefined
              }
              onPress={() => setStep('invite')}
              disabled={options.length < 2}
              fullWidth
              size="lg"
            />
          </View>
        </View>

        <VotingStyleSheet
          visible={showVotingStyleSheet}
          onClose={() => setShowVotingStyleSheet(false)}
          value={votingMethod}
          onChange={(m) => setValue('votingMethod', m)}
        />
        <VoteDeadlineSheet
          visible={showDeadlineSheet}
          onClose={() => setShowDeadlineSheet(false)}
          value={voteDeadline}
          onChange={(d) => setValue('voteDeadline', d)}
        />
      </Screen>
    );
  }

  // ============= Step: Invite =============
  if (step === 'invite') {
    const backStep: Step =
      flow === 'know_what_find_where'
        ? 'pick_one'
        : usesActivityPoll
          ? 'options'
          : 'flow';
    return (
      <Screen
        header={{
          title: 'Invite friends',
          showBack: true,
          onBack: () => setStep(backStep),
        }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            <Text
              style={[
                theme.typography.bodySmall,
                { color: theme.colors.text.secondary, marginBottom: 12 },
              ]}
            >
              You can invite more later.
            </Text>
            <View style={{ flex: 1 }}>
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
          </View>
          <View
            style={[
              styles.bottomBar,
              {
                borderTopColor: theme.colors.border.default,
                backgroundColor: theme.colors.bg.canvas,
              },
            ]}
          >
            <Button
              label={
                inviteUserIds.length === 0
                  ? 'Continue without inviting'
                  : `Invite ${inviteUserIds.length} & continue`
              }
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

  // ============= Step: Details =============
  return (
    <Screen
      header={{
        title: 'Final touches',
        showBack: true,
        onBack: () => setStep('invite'),
      }}
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
                placeholder={
                  isDirectVenue
                    ? `${pickedActivity?.label ?? 'Find a place'} night`
                    : usesActivityPoll
                      ? 'Friday night vote'
                      : 'Movie night'
                }
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
                placeholder="Pre-game at my place, dress code, etc."
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
              placeholder="Search an address, neighborhood, …"
              value={addressText}
              onChangeText={(t) => {
                setAddressText(t);
                setValue('locationAddress', t);
              }}
              onSelectPlace={handlePlaceSelected}
            />
            <Pressable
              onPress={useMyLocation}
              disabled={locatingMe}
              style={styles.useLocationBtn}
            >
              <Navigation size={13} color={theme.colors.accent} />
              <Text style={[theme.typography.caption, { color: theme.colors.accent, marginLeft: 4 }]}>
                {locatingMe ? 'Getting location…' : 'Use my current location'}
              </Text>
            </Pressable>
          </View>
          <SummaryRow
            label="When?"
            icon={<CalIcon size={18} color={theme.colors.text.tertiary} />}
            value={startTime ? formatDate(startTime) : "We'll figure it out"}
            onPress={() => setShowStartTimeSheet(true)}
            highlightValue={startTime !== null}
          />

          {/* Voting closes — for direct-venue we still need a deadline for the venue poll that follows */}
          {isDirectVenue ? (
            <SummaryRow
              label="Venue voting closes"
              icon={<Clock size={18} color={theme.colors.text.tertiary} />}
              value={voteDeadline ? formatDate(voteDeadline) : 'In 1 hour'}
              onPress={() => setShowDeadlineSheet(true)}
            />
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            {
              borderTopColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.canvas,
            },
          ]}
        >
          <Button
            label={
              isDirectVenue
                ? 'Create & pick venues'
                : usesActivityPoll
                  ? 'Create & start vote'
                  : 'Create hangout'
            }
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
      <VoteDeadlineSheet
        visible={showDeadlineSheet}
        onClose={() => setShowDeadlineSheet(false)}
        value={voteDeadline}
        onChange={(d) => setValue('voteDeadline', d)}
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
        styles.bigChoice,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={[
          styles.bigChoiceIcon,
          { backgroundColor: theme.colors.accent + '20' },
        ]}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {title}
        </Text>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary, marginTop: 2 },
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  bigChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  bigChoiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowHint: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  summarySection: { borderTopWidth: StyleSheet.hairlineWidth },
  bottomBar: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  useLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catalogChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
});
