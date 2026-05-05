import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import {
  createProfileSchema,
  type CreateProfileInput,
  useCompleteProfile,
  useUsernameAvailability,
  AvatarUpload,
} from '@/features/profile';
import { useSession } from '@/features/auth';

export default function CreateProfileScreen(): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const completeProfile = useCompleteProfile();

  const [avatarUri, setAvatarUri] = useState<string | undefined>();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateProfileInput>({
    resolver: zodResolver(createProfileSchema),
    mode: 'onChange',
    defaultValues: {
      displayName: '',
      username: '',
      bio: '',
      avatarUri: undefined,
    },
  });

  const usernameValue = watch('username');
  const displayNameValue = watch('displayName');

  const usernameQuery = useUsernameAvailability(
    usernameValue,
    !errors.username && usernameValue.length >= 3,
  );

  const usernameHint = (() => {
    if (errors.username?.message) return undefined; // schema error takes precedence
    if (!usernameValue) return 'Letters, numbers, and underscores. Visible to other users.';
    if (usernameValue.length < 3) return 'At least 3 characters.';
    if (usernameQuery.isFetching) return 'Checking availability…';
    if (usernameQuery.data === false) return undefined; // shown as error below
    if (usernameQuery.data === true) return '✓ Available';
    return undefined;
  })();

  const usernameError = (() => {
    if (errors.username?.message) return errors.username.message;
    if (usernameQuery.data === false && !usernameQuery.isFetching) {
      return 'That username is taken.';
    }
    return undefined;
  })();

  const onSubmit = (input: CreateProfileInput): void => {
    completeProfile.mutate(
      { ...input, avatarUri },
      {
        onSuccess: () => {
          router.replace('/(tabs)/');
        },
      },
    );
  };

  // Sync avatar to form
  useEffect(() => {
    // Just for completeness — the actual upload uses local state above.
  }, [avatarUri]);

  if (!user) return <Screen><Text>Loading…</Text></Screen>;

  return (
    <Screen header={{ title: 'Create your profile' }} scroll>
      <View style={styles.section}>
        <AvatarUpload
          id={user.id}
          displayName={displayNameValue || 'You'}
          uri={avatarUri ?? null}
          onPicked={setAvatarUri}
        />
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="displayName"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Display name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.displayName?.message}
              hint="What your friends will see."
              autoComplete="name"
              maxLength={32}
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="username"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Username"
              value={value}
              onChangeText={(v) => onChange(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              onBlur={onBlur}
              error={usernameError}
              hint={usernameHint}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="bio"
          render={({ field: { value, onChange, onBlur } }) => (
            <Textarea
              label="Bio (optional)"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.bio?.message}
              maxLength={280}
              minLines={3}
              maxLines={5}
              placeholder="A line or two about you."
            />
          )}
        />

        <Button
          label="Continue"
          onPress={handleSubmit(onSubmit)}
          loading={completeProfile.isPending}
          disabled={
            !isValid ||
            !usernameQuery.data ||
            (usernameQuery.isFetching && usernameValue.length >= 3)
          }
          fullWidth
          size="lg"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    alignItems: 'center',
    marginVertical: 16,
  },
  form: {
    gap: 16,
    marginTop: 16,
  },
});
