import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/layout/Screen';
import { Input, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import {
  requestPasswordResetSchema,
  type RequestPasswordResetInput,
  useRequestPasswordReset,
} from '@/features/auth';

export default function ForgotPasswordScreen(): React.ReactElement {
  const theme = useTheme();
  const reset = useRequestPasswordReset();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    mode: 'onChange',
    defaultValues: { email: '' },
  });

  return (
    <Screen header={{ title: 'Reset password', showBack: true }} scroll>
      <View style={styles.intro}>
        <Text style={[theme.typography.h1, { color: theme.colors.text.primary }]}>
          Forgot your password?
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text.secondary, marginTop: 6 },
          ]}
        >
          Enter your email and we'll send you a reset link.
        </Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="go"
            />
          )}
        />

        <Button
          label="Send reset link"
          onPress={handleSubmit((input) => {
            reset.mutate(input.email, {
              onSuccess: () => router.back(),
            });
          })}
          loading={reset.isPending}
          disabled={!isValid}
          fullWidth
          size="lg"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: 32 },
  form: { gap: 16 },
});
