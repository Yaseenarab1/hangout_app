import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Card, SectionHeader, Spinner } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useMyProfile, useUpdateProfile } from '@/features/profile';

const POST_OPTIONS = [
  { value: 'friends' as const, label: 'All friends', desc: 'Posts visible to all your friends' },
  {
    value: 'hangout_only' as const,
    label: 'Hangout only',
    desc: 'Only people who were at the hangout',
  },
  {
    value: 'selected' as const,
    label: 'Selected friends',
    desc: 'Pick a custom list each time',
  },
];

const CAL_OPTIONS = [
  {
    value: 'friends' as const,
    label: 'All friends',
    desc: 'Friends can see when you are free',
  },
  {
    value: 'selected' as const,
    label: 'Selected friends',
    desc: 'Pick who can see your availability',
  },
  { value: 'private' as const, label: 'Private', desc: 'No one can see your availability' },
];

export default function PrivacySettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const myProfile = useMyProfile();
  const update = useUpdateProfile();

  if (myProfile.isLoading || !myProfile.data) {
    return (
      <Screen header={{ title: 'Privacy', showBack: true }}>
        <Spinner fullScreen />
      </Screen>
    );
  }

  return (
    <Screen header={{ title: 'Privacy', showBack: true }} scroll>
      <SectionHeader title="Default post visibility" />
      <Card padding="none">
        {POST_OPTIONS.map((opt, i) => (
          <Row
            key={opt.value}
            label={opt.label}
            desc={opt.desc}
            selected={myProfile.data!.default_post_visibility === opt.value}
            onPress={() => update.mutate({ defaultPostVisibility: opt.value })}
            divider={i < POST_OPTIONS.length - 1}
          />
        ))}
      </Card>

      <SectionHeader title="Default calendar visibility" />
      <Card padding="none">
        {CAL_OPTIONS.map((opt, i) => (
          <Row
            key={opt.value}
            label={opt.label}
            desc={opt.desc}
            selected={myProfile.data!.default_calendar_visibility === opt.value}
            onPress={() => update.mutate({ defaultCalendarVisibility: opt.value })}
            divider={i < CAL_OPTIONS.length - 1}
          />
        ))}
      </Card>

      <Text
        style={[
          theme.typography.caption,
          {
            color: theme.colors.text.tertiary,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 24,
          },
        ]}
      >
        These are defaults — you can change visibility on each post or block.
      </Text>
    </Screen>
  );
}

type RowProps = {
  label: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
  divider: boolean;
};

function Row({ label, desc, selected, onPress, divider }: RowProps): React.ReactElement {
  const theme = useTheme();
  return (
    <>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: theme.colors.bg.subtle },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
            {label}
          </Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginTop: 2 },
            ]}
          >
            {desc}
          </Text>
        </View>
        {selected ? <Check size={20} color={theme.colors.accent} /> : null}
      </Pressable>
      {divider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.border.default,
            marginLeft: 16,
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
});
