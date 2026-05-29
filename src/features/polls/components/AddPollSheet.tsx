import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Activity,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListOrdered,
  MapPin,
  UtensilsCrossed,
  Vote as VoteIcon,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button, Input } from '@/components/ui';
import { SummaryRow } from '@/components/ui/SummaryRow';
import { CuisineOptionPicker } from '@/features/food/components/CuisineOptionPicker';
import { RestaurantSearchPicker } from '@/features/food/components/RestaurantSearchPicker';
import type { CuisineOption } from '@/features/food/types';
import type { RestaurantOption } from '@/features/food/types';
import { ActivityOptionPicker, type ActivityOption } from './ActivityOptionPicker';
import {
  ActivityVenuePicker,
  type ActivityVenueOption,
} from './ActivityVenuePicker';
import { VotingStyleSheet } from './VotingStyleSheet';
import { VoteDeadlineSheet } from './VoteDeadlineSheet';
import { useCreatePollOnHangout } from '../hooks/usePolls';
import type { VotingMethod } from '../types';

type PollKind = 'activity' | 'cuisine' | 'restaurant' | 'venue';
type Step = 'kind' | 'venue_label' | 'options';

export type AddPollSheetProps = {
  visible: boolean;
  onClose: () => void;
  hangoutId: string;
  onCalendarPress?: () => void;
};

export function AddPollSheet({
  visible,
  onClose,
  hangoutId,
  onCalendarPress,
}: AddPollSheetProps): React.ReactElement {
  const theme = useTheme();
  const createPoll = useCreatePollOnHangout(hangoutId);

  const [step, setStep] = useState<Step>('kind');
  const [kind, setKind] = useState<PollKind | null>(null);

  const [activityValue, setActivityValue] = useState<ActivityOption[]>([]);
  const [cuisineValue, setCuisineValue] = useState<CuisineOption[]>([]);
  const [restaurantValue, setRestaurantValue] = useState<RestaurantOption[]>([]);
  const [venueValue, setVenueValue] = useState<ActivityVenueOption[]>([]);
  const [venueLabel, setVenueLabel] = useState('');

  const [votingMethod, setVotingMethod] = useState<VotingMethod>('simple');
  const [voteDeadline, setVoteDeadline] = useState<Date | null>(null);
  const [showVotingStyle, setShowVotingStyle] = useState(false);
  const [showDeadline, setShowDeadline] = useState(false);

  function resetAndClose() {
    setStep('kind');
    setKind(null);
    setActivityValue([]);
    setCuisineValue([]);
    setRestaurantValue([]);
    setVenueValue([]);
    setVenueLabel('');
    setVotingMethod('simple');
    setVoteDeadline(null);
    onClose();
  }

  function handleKindSelect(k: PollKind) {
    setKind(k);
    if (k === 'venue') {
      setStep('venue_label');
    } else {
      setStep('options');
    }
  }

  function handleBack() {
    if (step === 'options' && kind === 'venue') {
      setStep('venue_label');
    } else if (step === 'options' || step === 'venue_label') {
      setStep('kind');
      setKind(null);
      setVenueLabel('');
    }
  }

  const optionCount =
    kind === 'activity'
      ? activityValue.length
      : kind === 'cuisine'
        ? cuisineValue.length
        : kind === 'venue'
          ? venueValue.length
          : restaurantValue.length;

  const canCreate = optionCount >= 2;

  function buildOptions(): Array<{ label: string; metadata?: Record<string, unknown> }> {
    if (kind === 'activity') {
      return activityValue.map((v) => ({
        label: v.label,
        metadata: { emoji: v.emoji ?? null, catalogId: v.catalogId ?? null },
      }));
    }
    if (kind === 'cuisine') {
      return cuisineValue.map((v) => ({
        label: v.label,
        metadata: { emoji: v.emoji ?? null, catalogId: v.catalogId ?? null },
      }));
    }
    if (kind === 'venue') {
      return venueValue.map((v) => ({
        label: v.name,
        metadata: {
          placeId: v.placeId ?? null,
          address: v.address ?? null,
          rating: v.rating ?? null,
          priceLevel: v.priceLevel ?? null,
          primaryType: v.primaryType ?? null,
          mapsUrl: v.mapsUrl ?? null,
          isCustom: v.isCustom ?? false,
        },
      }));
    }
    return restaurantValue.map((v) => ({
      label: v.name,
      metadata: {
        placeId: v.placeId ?? null,
        address: v.address ?? null,
        rating: v.rating ?? null,
        priceLevel: v.priceLevel ?? null,
        primaryType: v.primaryType ?? null,
        mapsUrl: v.mapsUrl ?? null,
        isCustom: v.isCustom ?? false,
      },
    }));
  }

  function handleCreate() {
    if (!kind) return;
    const finalDeadline = voteDeadline ?? new Date(Date.now() + 60 * 60 * 1000);
    const dbKind = kind === 'venue' ? 'restaurant' : kind;
    const title =
      kind === 'venue'
        ? `Where should we ${venueLabel.trim() ? venueLabel.trim().toLowerCase() : 'go'}?`
        : undefined;

    createPoll.mutate(
      {
        kind: dbKind,
        votingMethod,
        voteDeadline: finalDeadline.toISOString(),
        options: buildOptions(),
        title,
      },
      { onSuccess: () => resetAndClose() },
    );
  }

  // ── Step 1: kind ─────────────────────────────────────────────────────────
  if (step === 'kind') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetAndClose}
      >
        <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
          <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
            <Text style={[theme.typography.h3, { color: theme.colors.text.primary, flex: 1 }]}>
              What are we voting on?
            </Text>
            <Pressable onPress={resetAndClose} hitSlop={8}>
              <X size={22} color={theme.colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.kindList}
            showsVerticalScrollIndicator={false}
          >
            {onCalendarPress && (
              <KindChoice
                icon={<Clock size={24} color="#22C55E" />}
                title="Find a time"
                subtitle="See when everyone is free and pick a date."
                onPress={() => { onClose(); onCalendarPress(); }}
              />
            )}
            <KindChoice
              icon={<Activity size={24} color={theme.colors.accent} />}
              title="Activities"
              subtitle="Vote between bowling, hiking, game night, …"
              onPress={() => handleKindSelect('activity')}
            />
            <KindChoice
              icon={<MapPin size={24} color={theme.colors.accent} />}
              title="Find a venue"
              subtitle="Know what you're doing? Vote on where to go."
              onPress={() => handleKindSelect('venue')}
            />
            <KindChoice
              icon={<UtensilsCrossed size={24} color={theme.colors.accent} />}
              title="Cuisine vote"
              subtitle="Vote on what kind of food — Italian, sushi, tacos, …"
              onPress={() => handleKindSelect('cuisine')}
            />
            <KindChoice
              icon={<Building2 size={24} color={theme.colors.accent} />}
              title="Restaurant vote"
              subtitle="Pick specific spots and let everyone vote."
              onPress={() => handleKindSelect('restaurant')}
            />
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // ── Step 2 (venue only): pick the activity label ──────────────────────────
  if (step === 'venue_label') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetAndClose}
      >
        <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
          <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
            <Pressable onPress={handleBack} hitSlop={8} style={{ marginRight: 12 }}>
              <ChevronLeft size={22} color={theme.colors.text.secondary} />
            </Pressable>
            <Text style={[theme.typography.h3, { color: theme.colors.text.primary, flex: 1 }]}>
              What are you doing?
            </Text>
            <Pressable onPress={resetAndClose} hitSlop={8}>
              <X size={22} color={theme.colors.text.secondary} />
            </Pressable>
          </View>

          <View style={{ flex: 1, padding: 20, gap: 12 }}>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
              We'll search for the best spots to do it.
            </Text>
            <Input
              label="Activity"
              placeholder="e.g. bowling, axe throwing, mini golf, …"
              value={venueLabel}
              onChangeText={setVenueLabel}
              autoFocus
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (venueLabel.trim()) setStep('options');
              }}
              maxLength={60}
            />
          </View>

          <View style={[styles.footer, { borderTopColor: theme.colors.border.default }]}>
            <Button
              label="Find venues"
              trailingIcon={<ChevronRight size={16} color="#FFFFFF" />}
              onPress={() => setStep('options')}
              disabled={!venueLabel.trim()}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </Modal>
    );
  }

  // ── Step 3: pick options + settings ──────────────────────────────────────
  const stepTitle =
    kind === 'activity'
      ? 'Pick activities'
      : kind === 'cuisine'
        ? 'Pick cuisines'
        : kind === 'venue'
          ? `Places to ${venueLabel.trim() || 'go'}`
          : 'Pick restaurants';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border.default }]}>
          <Pressable onPress={handleBack} hitSlop={8} style={{ marginRight: 12 }}>
            <ChevronLeft size={22} color={theme.colors.text.secondary} />
          </Pressable>
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary, flex: 1 }]}>
            {stepTitle}
          </Text>
          <Pressable onPress={resetAndClose} hitSlop={8}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          {kind === 'activity' ? (
            <ActivityOptionPicker value={activityValue} onChange={setActivityValue} min={2} max={15} />
          ) : kind === 'cuisine' ? (
            <CuisineOptionPicker value={cuisineValue} onChange={setCuisineValue} min={2} max={15} />
          ) : kind === 'venue' ? (
            <ActivityVenuePicker
              value={venueValue}
              onChange={setVenueValue}
              activityQuery={venueLabel.trim()}
              activityLabel={venueLabel.trim() || 'this activity'}
              min={2}
              max={10}
            />
          ) : (
            <RestaurantSearchPicker value={restaurantValue} onChange={setRestaurantValue} min={2} max={15} />
          )}
        </View>

        <View style={[styles.summarySection, { borderTopColor: theme.colors.border.default }]}>
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
            onPress={() => setShowVotingStyle(true)}
          />
          <SummaryRow
            label="Voting closes"
            icon={<Clock size={18} color={theme.colors.text.tertiary} />}
            value={voteDeadline ? formatDate(voteDeadline) : 'In 1 hour'}
            onPress={() => setShowDeadline(true)}
            showTopSeparator
          />
        </View>

        <View style={[styles.footer, { borderTopColor: theme.colors.border.default }]}>
          <Button
            label={!canCreate ? `Pick ${2 - optionCount} more to start` : 'Start vote'}
            trailingIcon={canCreate ? <ChevronRight size={16} color="#FFFFFF" /> : undefined}
            onPress={handleCreate}
            disabled={!canCreate || createPoll.isPending}
            loading={createPoll.isPending}
            fullWidth
            size="lg"
          />
        </View>
      </View>

      <VotingStyleSheet
        visible={showVotingStyle}
        onClose={() => setShowVotingStyle(false)}
        value={votingMethod}
        onChange={setVotingMethod}
      />
      <VoteDeadlineSheet
        visible={showDeadline}
        onClose={() => setShowDeadline(false)}
        value={voteDeadline}
        onChange={setVoteDeadline}
      />
    </Modal>
  );
}

function KindChoice({
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
        styles.kindChoice,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={[styles.kindChoiceIcon, { backgroundColor: theme.colors.accent + '18' }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {title}
        </Text>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary, marginTop: 3, lineHeight: 18 },
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kindList: {
    padding: 16,
    gap: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  summarySection: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  kindChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  kindChoiceIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
