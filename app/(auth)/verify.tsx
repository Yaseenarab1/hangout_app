import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/layout/Screen';
import { Input, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import {
  verifyEmailSchema,
  type VerifyEmailInput,
  useVerifyEmail,
} from '@/features/auth';

export default function VerifyEmailScreen(): React.ReactElement {
  const theme = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const verify = useVerifyEmail();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    mode: 'onChange',
    defaultValues: { email: email ?? '', token: '' },
  });

  return (
    <Screen header={{ title: 'Verify email', showBack: true }} scroll>
      <View style={styles.intro}>
        <Text style={[theme.typography.h1, { color: theme.colors.text.primary }]}>
          Check your email
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text.secondary, marginTop: 6 },
          ]}
        >
          We sent a 6-digit code to <Text style={{ fontWeight: '600' }}>{email}</Text>.
        </Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="token"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="6-digit code"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.token?.message}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              returnKeyType="done"
            />
          )}
        />

        <Button
          label="Verify"
          onPress={handleSubmit((input) => verify.mutate(input))}
          loading={verify.isPending}
          disabled={!isValid}
          fullWidth
          size="lg"
        />

        <Text
          style={[
            theme.typography.caption,
            {
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              marginTop: 8,
            },
          ]}
        >
          Didn't get the code? Check your spam folder or wait a minute and request a new one.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
});
