import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/layout/Screen';
import { Input, Textarea, Button } from '@/components/ui';
import {
  updateProfileSchema,
  type UpdateProfileInput,
  useMyProfile,
  useUpdateProfile,
  useUpdateAvatar,
  useUsernameAvailability,
  AvatarUpload,
} from '@/features/profile';
import { useTheme } from '@/hooks/useTheme';

export default function EditProfileScreen(): React.ReactElement {
  const theme = useTheme();
  const myProfile = useMyProfile();
  const updateProfile = useUpdateProfile();
  const updateAvatar = useUpdateAvatar();

  // Local state for the chosen-but-not-yet-uploaded avatar URI.
  // null  = no change
  // string = local URI of newly picked photo
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    mode: 'onChange',
    defaultValues: {
      displayName: '',
      username: '',
      bio: '',
    },
  });

  // Hydrate form from server profile
  useEffect(() => {
    if (myProfile.data) {
      reset({
        displayName: myProfile.data.display_name,
        username: myProfile.data.username,
        bio: myProfile.data.bio ?? '',
      });
    }
  }, [myProfile.data, reset]);

  const usernameValue = watch('username') ?? '';
  const usernameChanged =
    !!myProfile.data && usernameValue.toLowerCase() !== myProfile.data.username;

  const usernameQuery = useUsernameAvailability(
    usernameValue,
    usernameChanged && !errors.username && usernameValue.length >= 3,
  );

  const usernameError = (() => {
    if (errors.username?.message) return errors.username.message;
    if (
      usernameChanged &&
      usernameQuery.data === false &&
      !usernameQuery.isFetching
    ) {
      return 'That username is taken.';
    }
    return undefined;
  })();

  // Save button is enabled if either the form changed OR the avatar changed.
  const hasAvatarChange = pendingAvatarUri !== null;
  const hasChanges = isDirty || hasAvatarChange;

  const onSubmit = async (input: UpdateProfileInput): Promise<void> => {
    // Upload avatar first if there's one pending.
    if (pendingAvatarUri) {
      try {
        await new Promise<void>((resolve, reject) => {
          updateAvatar.mutate(pendingAvatarUri, {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          });
        });
        setPendingAvatarUri(null);
      } catch {
        // The mutation already toasted. Don't proceed with profile update.
        return;
      }
    }

    // Then save text fields if any changed.
    if (isDirty) {
      updateProfile.mutate(input, {
        onSuccess: () => router.back(),
      });
    } else {
      // Avatar-only change — just go back.
      router.back();
    }
  };

  if (!myProfile.data) {
    return <Screen header={{ title: 'Edit profile', showClose: true }}><View /></Screen>;
  }

  // Show the newly-picked photo if any, else the saved one.
  const displayedAvatarUri = pendingAvatarUri ?? myProfile.data.avatar_url;

  return (
    <Screen header={{ title: 'Edit profile', showClose: true }} scroll>
      <View style={styles.section}>
        <AvatarUpload
          id={myProfile.data.id}
          displayName={myProfile.data.display_name}
          uri={displayedAvatarUri}
          onPicked={(localUri) => setPendingAvatarUri(localUri)}
        />
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="displayName"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Display name"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.displayName?.message}
              maxLength={32}
            />
          )}
        />

        <Controller
          control={control}
          name="username"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Username"
              value={value ?? ''}
              onChangeText={(v) => onChange(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              onBlur={onBlur}
              error={usernameError}
              hint={
                usernameChanged && usernameQuery.isFetching
                  ? 'Checking availability…'
                  : usernameChanged && usernameQuery.data === true
                  ? '✓ Available'
                  : undefined
              }
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
          )}
        />

        <Controller
          control={control}
          name="bio"
          render={({ field: { value, onChange, onBlur } }) => (
            <Textarea
              label="Bio"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.bio?.message}
              maxLength={280}
              minLines={3}
              maxLines={5}
            />
          )}
        />

        <Button
          label="Save changes"
          onPress={handleSubmit(onSubmit)}
          loading={updateProfile.isPending || updateAvatar.isPending}
          disabled={
            !hasChanges ||
            !isValid ||
            (usernameChanged && (usernameQuery.isFetching || !usernameQuery.data)) ||
            updateProfile.isPending ||
            updateAvatar.isPending
          }
          fullWidth
          size="lg"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', marginVertical: 16 },
  form: { gap: 16, marginTop: 16 },
});
