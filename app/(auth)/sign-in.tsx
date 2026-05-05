import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/layout/Screen';
import { Input, Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { signInSchema, type SignInInput, useSignIn } from '@/features/auth';

export default function SignInScreen(): React.ReactElement {
  const theme = useTheme();
  const signIn = useSignIn();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (input: SignInInput): void => {
    signIn.mutate(input, {
      onSuccess: () => {
        // RouteGuard handles redirect once session updates.
      },
    });
  };

  return (
    <Screen header={{ title: 'Sign in', showBack: true }} scroll>
      <View style={styles.intro}>
        <Text style={[theme.typography.h1, { color: theme.colors.text.primary }]}>
          Welcome back
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text.secondary, marginTop: 6 },
          ]}
        >
          Sign in to continue
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
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          hitSlop={8}
          style={{ alignSelf: 'flex-end' }}
        >
          <Text style={[theme.typography.bodySmallMedium, { color: theme.colors.accentText }]}>
            Forgot password?
          </Text>
        </Pressable>

        <Button
          label="Sign in"
          onPress={handleSubmit(onSubmit)}
          loading={signIn.isPending}
          disabled={!isValid}
          fullWidth
          size="lg"
        />
      </View>

      <View style={styles.footer}>
        <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
          New here?{' '}
        </Text>
        <Pressable onPress={() => router.replace('/(auth)/sign-up')} hitSlop={8}>
          <Text
            style={[
              theme.typography.bodyMedium,
              { color: theme.colors.accentText },
            ]}
          >
            Create an account
          </Text>
        </Pressable>
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
});
