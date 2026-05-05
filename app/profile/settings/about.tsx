import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import * as Application from 'expo-application';
import { Screen } from '@/components/layout/Screen';
import { Card, ListItem, SectionHeader } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { AppConfig } from '@/config/app.config';

export default function AboutScreen(): React.ReactElement {
  const theme = useTheme();
  const version = Application.nativeApplicationVersion ?? '0.1.0';
  const build = Application.nativeBuildVersion ?? '1';

  const open = (url: string): void => {
    void Linking.openURL(url);
  };

  return (
    <Screen header={{ title: 'About', showBack: true }} scroll>
      <View style={styles.hero}>
        <View style={[styles.logoBox, { backgroundColor: theme.colors.accent }]}>
          <Text style={styles.logoLetter}>H</Text>
        </View>
        <Text
          style={[
            theme.typography.h2,
            { color: theme.colors.text.primary, marginTop: 16 },
          ]}
        >
          {AppConfig.APP_NAME}
        </Text>
        <Text
          style={[theme.typography.caption, { color: theme.colors.text.tertiary, marginTop: 4 }]}
        >
          Version {version} ({build})
        </Text>
      </View>

      <SectionHeader title="Legal" />
      <Card padding="none">
        <ListItem title="Terms of Service" onPress={() => open(AppConfig.TERMS_URL)} />
        <Divider />
        <ListItem title="Privacy Policy" onPress={() => open(AppConfig.PRIVACY_URL)} />
        <Divider />
        <ListItem
          title="Open-source licenses"
          subtitle="Acknowledgements"
          onPress={() => {
            // Phase 5: ship a licenses screen
          }}
        />
      </Card>

      <SectionHeader title="Support" />
      <Card padding="none">
        <ListItem
          title="Contact us"
          subtitle={AppConfig.SUPPORT_EMAIL}
          onPress={() => open(`mailto:${AppConfig.SUPPORT_EMAIL}`)}
        />
        <Divider />
        <ListItem
          title="Report a security issue"
          subtitle={AppConfig.SECURITY_EMAIL}
          onPress={() => open(`mailto:${AppConfig.SECURITY_EMAIL}`)}
        />
      </Card>
    </Screen>
  );
}

function Divider(): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border.default,
        marginLeft: 16,
      }}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
