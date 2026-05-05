import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { UserPlus, Scale } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import {
  Button,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import {
  useHangout,
  useInviteParticipants,
  useRemoveParticipant,
  useUpdateParticipant,
  ParticipantRow,
  ParticipantPicker,
} from '@/features/hangouts';
import { VoteWeightSheet } from '@/features/polls';

export default function HangoutParticipantsScreen(): React.ReactElement {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const hangoutId = id ?? '';

  const hangout = useHangout(hangoutId);
  const invite = useInviteParticipants();
  const remove = useRemoveParticipant(hangoutId);
  const updateP = useUpdateParticipant();

  const [picking, setPicking] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]);

  // Vote weight sheet state
  const [weightSheet, setWeightSheet] = useState<{
    userId: string;
    userName: string;
    currentWeight: number;
  } | null>(null);

  const isHost = hangout.data?.host_id === user?.id;
  const myParticipationRole = hangout.data?.participants.find(
    (p) => p.user_id === user?.id,
  )?.role;
  const canManage = isHost || myParticipationRole === 'co_host';

  const existingIds = useMemo(
    () => (hangout.data?.participants ?? []).map((p) => p.user_id),
    [hangout.data],
  );

  const visibleParticipants = useMemo(
    () =>
      (hangout.data?.participants ?? []).filter((p) => p.status !== 'removed'),
    [hangout.data],
  );

  const handleConfirmInvite = (): void => {
    if (pickedIds.length === 0) return;
    invite.mutate(
      { hangoutId, userIds: pickedIds },
      {
        onSuccess: () => {
          setPicking(false);
          setPickedIds([]);
        },
      },
    );
  };

  const handleRemove = (userId: string, displayName: string): void => {
    Alert.alert(
      'Remove participant?',
      `${displayName} will no longer see this hangout.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => remove.mutate(userId),
        },
      ],
    );
  };

  const handlePromote = (userId: string, displayName: string): void => {
    Alert.alert(
      'Make co-host?',
      `${displayName} will be able to invite others, edit details, and manage the hangout.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: () =>
            updateP.mutate({ hangoutId, userId, role: 'co_host' }),
        },
      ],
    );
  };

  const handleDemote = (userId: string, displayName: string): void => {
    Alert.alert(
      'Demote to guest?',
      `${displayName} will lose the ability to invite people, edit details, or manage participants. People they invited will stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          style: 'destructive',
          onPress: () =>
            updateP.mutate({ hangoutId, userId, role: 'guest' }),
        },
      ],
    );
  };

  const handleOpenWeightSheet = (
    userId: string,
    userName: string,
    currentWeight: number,
  ): void => {
    setWeightSheet({ userId, userName, currentWeight });
  };

  if (hangout.isLoading) {
    return (
      <Screen header={{ title: 'Participants', showBack: true }}>
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
        </View>
      </Screen>
    );
  }

  if (!hangout.data) {
    return (
      <Screen header={{ title: 'Participants', showBack: true }}>
        <EmptyState title="Hangout not found" />
      </Screen>
    );
  }

  // Picker mode
  if (picking) {
    return (
      <Screen
        header={{
          title: 'Invite friends',
          showBack: true,
          onBack: () => {
            setPicking(false);
            setPickedIds([]);
          },
        }}
        contentPadding={16}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <ParticipantPicker
              value={pickedIds}
              onChange={setPickedIds}
              excludeIds={existingIds}
              title="Friends to invite"
            />
          </View>
          <View style={{ paddingTop: 12 }}>
            <Button
              label={
                pickedIds.length === 0
                  ? 'Pick at least one friend'
                  : `Invite ${pickedIds.length}`
              }
              onPress={handleConfirmInvite}
              loading={invite.isPending}
              disabled={pickedIds.length === 0 || invite.isPending}
              fullWidth
              size="lg"
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={{ title: 'Participants', showBack: true }} contentPadding={0}>
      <FlatList
        data={visibleParticipants}
        keyExtractor={(p) => p.user_id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.colors.border.default,
              marginLeft: 68,
            }}
          />
        )}
        ListHeaderComponent={
          canManage ? (
            <View style={{ padding: 16, paddingBottom: 8 }}>
              <Button
                label="Invite friends"
                leadingIcon={<UserPlus size={16} color="#FFFFFF" />}
                onPress={() => setPicking(true)}
                fullWidth
              />
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const showRoleButtons =
            canManage &&
            item.user_id !== user?.id &&
            (isHost || item.role === 'guest');

          // Vote weight is shown to host for any non-removed participant.
          // Including yourself feels weird, so skip if it's me.
          const showWeightButton =
            isHost && item.user_id !== user?.id;

          const currentWeight = Number(item.vote_weight ?? 1);
          const weightLabel =
            currentWeight === 1
              ? 'Weight'
              : `${currentWeight}×`;

          return (
            <ParticipantRow
              participant={item}
              navigateOnTap={false}
              trailing={
                showRoleButtons || showWeightButton ? (
                  <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {/* Vote weight (host only) */}
                    {showWeightButton ? (
                      <Button
                        label={weightLabel}
                        leadingIcon={
                          <Scale size={12} color={theme.colors.accent} />
                        }
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          handleOpenWeightSheet(
                            item.user_id,
                            item.profile.display_name,
                            currentWeight,
                          )
                        }
                      />
                    ) : null}

                    {/* Promote (host only, on guests) */}
                    {showRoleButtons && isHost && item.role === 'guest' ? (
                      <Button
                        label="Co-host"
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          handlePromote(
                            item.user_id,
                            item.profile.display_name,
                          )
                        }
                      />
                    ) : null}

                    {/* Demote (host only, on co-hosts) */}
                    {showRoleButtons && isHost && item.role === 'co_host' ? (
                      <Button
                        label="Demote"
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          handleDemote(
                            item.user_id,
                            item.profile.display_name,
                          )
                        }
                      />
                    ) : null}

                    {/* Remove */}
                    {showRoleButtons ? (
                      <Button
                        label="Remove"
                        variant="ghost"
                        size="sm"
                        onPress={() =>
                          handleRemove(
                            item.user_id,
                            item.profile.display_name,
                          )
                        }
                      />
                    ) : null}
                  </View>
                ) : undefined
              }
            />
          );
        }}
      />

      {/* Vote weight modal */}
      {weightSheet ? (
        <VoteWeightSheet
          visible={true}
          onClose={() => setWeightSheet(null)}
          hangoutId={hangoutId}
          userId={weightSheet.userId}
          userName={weightSheet.userName}
          currentWeight={weightSheet.currentWeight}
        />
      ) : null}
    </Screen>
  );
}
