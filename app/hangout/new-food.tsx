import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import {
  ChevronRight,
  UtensilsCrossed,
  ListChecks,
  Building2,
  SkipForward,
  Calendar as CalIcon,
  Clock,
  Vote as VoteIcon,
  ListOrdered,
  MapPin,
  Navigation,
} from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button } from '@/components/ui';
import { SummaryRow } from '@/components/ui/SummaryRow';
import { useTheme } from '@/hooks/useTheme';
import { ParticipantPicker } from '@/features/hangouts';
import { AddressAutocomplete } from '@/features/places';
import { useSaveSearchLocation } from '@/features/places/hooks/useSearchLocation';
import type { PlaceDetails } from '@/features/places';
import {
  CuisineOptionPicker,
  RestaurantSearchPicker,
  useCreateFoodHangout,
  type CuisineOption,
  type RestaurantOption,
} from '@/features/food';
import {
  type VotingMethod,
  VotingStyleSheet,
  VoteDeadlineSheet,
  StartTimeSheet,
} from '@/features/polls';

type Step = 'flow' | 'options' | 'invite' | 'details';
type Flow =
  | 'cuisine_only'
  | 'cuisine_then_restaurant'
  | 'restaurant_only'
  | 'know_where_to_go';

type FormState = {
  title: string;
  description: string;
  locationName: string;
  locationAddress: string;
  inviteUserIds: string[];
  cuisineOptions: CuisineOption[];
  restaurantOptions: RestaurantOption[];
  voteDeadline: Date | null;
  startTime: Date | null;
  votingMethod: VotingMethod;
};

export default function NewFoodHangoutScreen(): React.ReactElement {
  const theme = useTheme();
  const createMutation = useCreateFoodHangout();

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
      cuisineOptions: [],
      restaurantOptions: [],
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
    setValue('locationAddress', place.address, { shouldDirty: true });
    if (!watch('locationName')?.trim()) {
      setValue('locationName', place.name, { shouldDirty: true });
    }
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
      setValue('locationName', 'Current location', { shouldDirty: true });
      setValue('locationAddress', '', { shouldDirty: true });
      setAddressText('');
    } catch {
      // silently fail
    } finally {
      setLocatingMe(false);
    }
  }

  const cuisineOptions = watch('cuisineOptions');
  const restaurantOptions = watch('restaurantOptions');
  const inviteUserIds = watch('inviteUserIds');
  const voteDeadline = watch('voteDeadline');
  const startTime = watch('startTime');
  const title = watch('title');
  const votingMethod = watch('votingMethod');

  const usesPoll = flow !== 'know_where_to_go' && flow !== null;

  const optionsValid =
    flow === 'restaurant_only'
      ? restaurantOptions.length >= 2
      : flow === 'know_where_to_go'
        ? true
        : cuisineOptions.length >= 2;

  const optionsCount =
    flow === 'restaurant_only' ? restaurantOptions.length : cuisineOptions.length;

  const handleSubmit = (): void => {
    const v = getValues();
    if (!flow || !v.title.trim()) return;

    if (!usesPoll) {
      router.replace({
        pathname: '/hangout/new',
        params: { prefilledTitle: v.title.trim() },
      });
      return;
    }

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
        flow: flow as 'cuisine_only' | 'cuisine_then_restaurant' | 'restaurant_only',
        votingMethod: v.votingMethod,
        voteDeadline: finalDeadline.toISOString(),
        cuisineOptions:
          flow === 'restaurant_only'
            ? undefined
            : v.cuisineOptions.map((c) => ({
                label: c.label,
                catalogId: c.catalogId,
                emoji: c.emoji,
              })),
        restaurantOptions:
          flow === 'restaurant_only'
            ? v.restaurantOptions.map((r) => ({
                name: r.name,
                address: r.address,
                placeId: r.placeId,
                rating: r.rating,
                priceLevel: r.priceLevel,
                primaryType: r.primaryType,
                mapsUrl: r.mapsUrl,
                isCustom: r.isCustom,
              }))
            : undefined,
      },
      {
        onSuccess: ({ hangoutId }) => {
          router.replace(`/hangout/${hangoutId}`);
        },
      },
    );
  };

  // ---- Step: pick flow ----
  if (step === 'flow') {
    return (
      <Screen header={{ title: 'Plan food', showClose: true }} contentPadding={16}>
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
            icon={<UtensilsCrossed size={24} color={theme.colors.accent} />}
            title="Just pick a cuisine"
            subtitle="Vote on what kind of food. Decide the place in person."
            onPress={() => {
              setFlow('cuisine_only');
              setStep('options');
            }}
          />
          <FlowChoice
            icon={<ListChecks size={24} color={theme.colors.accent} />}
            title="Cuisine, then restaurant"
            subtitle="Vote on cuisine first. Then vote on specific restaurants."
            onPress={() => {
              setFlow('cuisine_then_restaurant');
              setStep('options');
            }}
          />
          <FlowChoice
            icon={<Building2 size={24} color={theme.colors.accent} />}
            title="Pick specific restaurants"
            subtitle="Skip cuisine. Vote between restaurants directly."
            onPress={() => {
              setFlow('restaurant_only');
              setStep('options');
            }}
          />
          <FlowChoice
            icon={<SkipForward size={24} color={theme.colors.text.secondary} />}
            title="I already know where to go"
            subtitle="Skip the poll, just create the hangout."
            onPress={() => {
              setFlow('know_where_to_go');
              setStep('details');
            }}
          />
        </View>
      </Screen>
    );
  }

  // ---- Step: options ----
  if (step === 'options' && usesPoll) {
    return (
      <Screen
        header={{
          title:
            flow === 'restaurant_only' ? 'Pick restaurants' : 'Pick cuisines',
          showBack: true,
          onBack: () => setStep('flow'),
        }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            {flow === 'cuisine_then_restaurant' ? (
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
                  After the cuisine vote closes, we'll help you pick specific restaurants.
                </Text>
              </View>
            ) : null}

            {flow === 'restaurant_only' ? (
              <Controller
                control={control}
                name="restaurantOptions"
                render={({ field: { value, onChange } }) => (
                  <RestaurantSearchPicker
                    value={value}
                    onChange={onChange}
                    min={2}
                    max={10}
                  />
                )}
              />
            ) : (
              <Controller
                control={control}
                name="cuisineOptions"
                render={({ field: { value, onChange } }) => (
                  <CuisineOptionPicker
                    value={value}
                    onChange={onChange}
                    min={2}
                    max={10}
                  />
                )}
              />
            )}
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
              { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas },
            ]}
          >
            <Button
              label={
                !optionsValid
                  ? `Pick ${2 - optionsCount} more to continue`
                  : 'Next: invite friends'
              }
              trailingIcon={
                optionsValid ? <ChevronRight size={16} color="#FFFFFF" /> : undefined
              }
              onPress={() => setStep('invite')}
              disabled={!optionsValid}
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

  // ---- Step: invite ----
  if (step === 'invite') {
    return (
      <Screen
        header={{
          title: 'Invite friends',
          showBack: true,
          onBack: () => setStep(usesPoll ? 'options' : 'flow'),
        }}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
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
          <View
            style={[
              styles.bottomBar,
              { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas },
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

  // ---- Step: final touches ----
  return (
    <Screen
      header={{
        title: 'Final touches',
        showBack: true,
        onBack: () => setStep(usesPoll ? 'invite' : 'flow'),
      }}
      contentPadding={0}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 16 }}>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Title"
                placeholder="Friday dinner"
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
                setValue('locationAddress', t, { shouldDirty: true });
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

          {watch('locationName') ? (
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
                  maxLength={100}
                  trailing={<MapPin size={18} color={theme.colors.text.tertiary} />}
                />
              )}
            />
          ) : null}
          <SummaryRow
            label="When?"
            icon={<CalIcon size={18} color={theme.colors.text.tertiary} />}
            value={startTime ? formatDate(startTime) : "We'll figure it out"}
            onPress={() => setShowStartTimeSheet(true)}
            highlightValue={startTime !== null}
          />
        </View>

        <View
          style={[
            styles.bottomBar,
            { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas },
          ]}
        >
          <Button
            label={usesPoll ? 'Create & start vote' : 'Create hangout'}
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
  summarySection: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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
});
