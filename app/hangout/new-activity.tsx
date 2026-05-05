import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
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
} from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button } from '@/components/ui';
import { SummaryRow } from '@/components/ui/SummaryRow';
import { useTheme } from '@/hooks/useTheme';
import { ParticipantPicker } from '@/features/hangouts';
import {
  ActivityOptionPicker,
  type ActivityOption,
  useCreateActivityHangout,
  type VotingMethod,
  VotingStyleSheet,
  VoteDeadlineSheet,
  StartTimeSheet,
} from '@/features/polls';

type Step = 'flow' | 'options' | 'invite' | 'details';
type Flow = 'activity_only' | 'activity_then_venue' | 'know_what_to_do';

type FormState = {
  title: string;
  description: string;
  locationName: string;
  inviteUserIds: string[];
  options: ActivityOption[];
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
      inviteUserIds: [],
      options: [],
      voteDeadline: null,
      startTime: null,
      votingMethod: 'simple',
    },
  });

  const options = watch('options');
  const inviteUserIds = watch('inviteUserIds');
  const voteDeadline = watch('voteDeadline');
  const startTime = watch('startTime');
  const title = watch('title');
  const votingMethod = watch('votingMethod');

  const usesPoll = flow === 'activity_only' || flow === 'activity_then_venue';

  const handleSubmit = (): void => {
    const v = getValues();
    if (!flow || !v.title.trim()) return;

    const finalDeadline =
      v.voteDeadline ?? new Date(Date.now() + 60 * 60 * 1000);

    createMutation.mutate(
      {
        hangout: {
          title: v.title.trim(),
          description: v.description.trim() || undefined,
          startTime: v.startTime ? v.startTime.toISOString() : undefined,
          locationName: v.locationName.trim() || undefined,
          inviteUserIds: v.inviteUserIds,
        },
        poll: usesPoll
          ? {
              mode: 'simple_vote',
              votingMethod: v.votingMethod,
              voteDeadline: finalDeadline.toISOString(),
              options: v.options.map((o) => ({
                label: o.label,
                catalogId: o.catalogId,
                emoji: o.emoji,
              })),
            }
          : null,
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
            subtitle="Vote on what to do. Then vote on specific places (e.g. bars, escape rooms)."
            onPress={() => {
              setFlow('activity_then_venue');
              setStep('options');
            }}
          />
          <FlowChoice
            icon={<SkipForward size={24} color={theme.colors.text.secondary} />}
            title="I already know what to do"
            subtitle="Skip the poll, just create the hangout."
            onPress={() => {
              setFlow('know_what_to_do');
              setStep('invite');
            }}
          />
        </View>
      </Screen>
    );
  }

  // ---- Step: options + secondary settings ----
  if (step === 'options') {
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

          {/* Compact summary rows */}
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

          {/* Sticky bottom button */}
          <View
            style={[
              styles.bottomBar,
              { borderTopColor: theme.colors.border.default, backgroundColor: theme.colors.bg.canvas },
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
        onBack: () => setStep('invite'),
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
                placeholder={usesPoll ? 'Friday night vote' : 'Movie night'}
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
          <Controller
            control={control}
            name="locationName"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Where? (optional)"
                placeholder="A neighborhood, address, etc."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                maxLength={100}
              />
            )}
          />
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
});
