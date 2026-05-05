import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/layout/Screen';
import { Input, Button, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { signUpSchema, type SignUpInput, useSignUp } from '@/features/auth';

export default function SignUpScreen(): React.ReactElement {
  const theme = useTheme();
  const signUp = useSignUp();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      age18Confirmed: false,
    },
  });

  const email = watch('email');

  const onSubmit = (input: SignUpInput): void => {
    signUp.mutate(input, {
      onSuccess: ({ needsVerification }) => {
        if (needsVerification) {
          router.push({
            pathname: '/(auth)/verify',
            params: { email: input.email },
          });
        }
        // If session is already present, RouteGuard will redirect.
      },
    });
  };

  return (
    <Screen header={{ title: 'Create account', showBack: true }} scroll>
      <View style={styles.intro}>
        <Text style={[theme.typography.h1, { color: theme.colors.text.primary }]}>
          Let's get started
        </Text>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text.secondary, marginTop: 6 },
          ]}
        >
          Plans with friends, made easy.
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
              textContentType="username"
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
              hint="At least 10 characters with a letter and a number."
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Confirm password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword?.message}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
            />
          )}
        />

        <Controller
          control={control}
          name="age18Confirmed"
          render={({ field: { value, onChange } }) => (
            <View>
              <Switch
                value={value}
                onValueChange={onChange}
                label="I am 18 or older"
                hint="Required to use Hangout Planner."
              />
              {errors.age18Confirmed?.message ? (
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.danger, marginTop: 4 },
                  ]}
                >
                  {errors.age18Confirmed.message}
                </Text>
              ) : null}
            </View>
          )}
        />

        <Button
          label="Continue"
          onPress={handleSubmit(onSubmit)}
          loading={signUp.isPending}
          disabled={!isValid || !email || signUp.isPending}
          fullWidth
          size="lg"
        />

        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, textAlign: 'center', marginTop: 4 },
          ]}
        >
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
          Already have an account?{' '}
        </Text>
        <Pressable onPress={() => router.replace('/(auth)/sign-in')} hitSlop={8}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.accentText }]}>
            Sign in
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
