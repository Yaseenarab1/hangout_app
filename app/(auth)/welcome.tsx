import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useTheme } from '@/hooks/useTheme';
import { appleAuthAvailable, useAppleSignIn } from '@/features/auth';
import { AppConfig } from '@/config/app.config';

export default function WelcomeScreen(): React.ReactElement {
  const theme = useTheme();
  const appleSignIn = useAppleSignIn();
  const [appleAvailable, setAppleAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void appleAuthAvailable().then(setAppleAvailable);
  }, []);

  return (
    <Screen contentPadding={24} backgroundColor={theme.colors.bg.canvas}>
      <View style={styles.heroSection}>
        <View
          style={[
            styles.logoBox,
            { backgroundColor: theme.colors.accent },
          ]}
          accessibilityLabel={`${AppConfig.APP_NAME} logo`}
        >
          <Text style={styles.logoLetter}>H</Text>
        </View>
        <Text
          style={[
            theme.typography.display,
            { color: theme.colors.text.primary, marginTop: 24, textAlign: 'center' },
          ]}
        >
          {AppConfig.APP_NAME}
        </Text>
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.text.secondary,
              textAlign: 'center',
              marginTop: 8,
              maxWidth: 320,
            },
          ]}
        >
          {AppConfig.TAGLINE}
        </Text>
      </View>

      <View style={styles.actions}>
        {Platform.OS === 'ios' && appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              theme.mode === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={10}
            style={styles.appleButton}
            onPress={() => appleSignIn.mutate()}
          />
        )}
        {appleSignIn.isPending && <Spinner style={{ marginVertical: 8 }} />}

        <Button
          label="Continue with email"
          variant={appleAvailable ? 'secondary' : 'primary'}
          size="lg"
          fullWidth
          onPress={() => router.push('/(auth)/sign-up')}
        />
        <Button
          label="I already have an account"
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => router.push('/(auth)/sign-in')}
        />

        <Text
          style={[
            theme.typography.caption,
            {
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              marginTop: 16,
              paddingHorizontal: 16,
            },
          ]}
        >
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actions: {
    gap: 12,
    paddingBottom: 24,
  },
  appleButton: {
    width: '100%',
    height: 52,
  },
});
