import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronRight, Calendar as CalIcon, MapPin } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import {
  createHangoutSchema,
  type CreateHangoutInput,
  useCreateHangout,
  ParticipantPicker,
} from '@/features/hangouts';

type Step = 'details' | 'invite';

export default function NewHangoutScreen(): React.ReactElement {
  const theme = useTheme();
  const createHangout = useCreateHangout();
  const [step, setStep] = useState<Step>('details');

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

  const onSubmit = (input: CreateHangoutInput): void => {
    createHangout.mutate(input, {
      onSuccess: (hangout) => {
        // Replace so back from detail goes to home, not back to this modal.
        router.replace(`/hangout/${hangout.id}`);
      },
    });
  };

  if (step === 'details') {
    return (
      <Screen header={{ title: 'New hangout', showClose: true }} scroll>
        <View style={{ gap: 16 }}>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="What's the plan?"
                placeholder="Movie night, brunch with the crew, …"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.title?.message}
                maxLength={100}
                returnKeyType="next"
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur } }) => (
              <Textarea
                label="Anything else? (optional)"
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

          <Controller
            control={control}
            name="locationName"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Where? (optional)"
                placeholder="Sara's apartment, downtown, etc."
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.locationName?.message}
                maxLength={100}
                trailing={<MapPin size={18} color={theme.colors.text.tertiary} />}
              />
            )}
          />

          <Text
            style={[
              theme.typography.caption,
              {
                color: theme.colors.text.tertiary,
                paddingHorizontal: 4,
                marginTop: -8,
              },
            ]}
          >
            You can pick a date, time, and exact location later.
          </Text>

          <Button
            label="Next: invite friends"
            trailingIcon={<ChevronRight size={16} color="#FFFFFF" />}
            onPress={() => setStep('invite')}
            disabled={!isValid || !watch('title')}
            fullWidth
            size="lg"
          />
        </View>
      </Screen>
    );
  }

  // Step: invite
  return (
    <Screen
      header={{
        title: 'Invite friends',
        showBack: true,
        onBack: () => setStep('details'),
      }}
      contentPadding={16}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary, marginBottom: 12 },
          ]}
        >
          You can invite more people later.
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

        <View style={styles.footer}>
          <Button
            label={
              inviteUserIds.length === 0
                ? 'Create without inviting'
                : `Create & invite ${inviteUserIds.length}`
            }
            onPress={handleSubmit(onSubmit)}
            loading={createHangout.isPending}
            disabled={createHangout.isPending}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
  },
});
