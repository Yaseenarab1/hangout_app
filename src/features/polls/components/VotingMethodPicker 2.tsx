import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Vote, ListOrdered } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { VotingMethod } from '../types';

export type VotingMethodPickerProps = {
  value: VotingMethod;
  onChange: (method: VotingMethod) => void;
};

/**
 * Small inline picker. Two cards side-by-side:
 *   - Simple vote: tap one option
 *   - Ranked: rank options 1, 2, 3...
 *
 * Defaults to simple — that's what most users expect.
 */
export function VotingMethodPicker({
  value,
  onChange,
}: VotingMethodPickerProps): React.ReactElement {
  const theme = useTheme();

  const Card = ({
    method,
    icon,
    title,
    body,
  }: {
    method: VotingMethod;
    icon: React.ReactNode;
    title: string;
    body: string;
  }): React.ReactElement => {
    const isActive = value === method;
    return (
      <Pressable
        onPress={() => onChange(method)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isActive
              ? theme.colors.accent + '15'
              : theme.colors.bg.surface,
            borderColor: isActive
              ? theme.colors.accent
              : theme.colors.border.default,
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={{ marginBottom: 6 }}>{icon}</View>
        <Text
          style={[
            theme.typography.bodySmallMedium,
            { color: theme.colors.text.primary },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.tertiary, marginTop: 2 },
          ]}
        >
          {body}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.row}>
      <Card
        method="simple"
        icon={
          <Vote
            size={20}
            color={value === 'simple' ? theme.colors.accent : theme.colors.text.secondary}
          />
        }
        title="Simple vote"
        body="Tap one option"
      />
      <Card
        method="ranked"
        icon={
          <ListOrdered
            size={20}
            color={value === 'ranked' ? theme.colors.accent : theme.colors.text.secondary}
          />
        }
        title="Ranked vote"
        body="Pick 1st, 2nd, 3rd"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
