import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { X, Vote, ListOrdered, Check } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { VotingMethod } from '../types';

export type VotingStyleSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: VotingMethod;
  onChange: (method: VotingMethod) => void;
};

/**
 * Bottom sheet for picking voting style.
 * Replaces the inline two-card picker that ate too much vertical space.
 */
export function VotingStyleSheet({
  visible,
  onClose,
  value,
  onChange,
}: VotingStyleSheetProps): React.ReactElement {
  const theme = useTheme();

  const select = (method: VotingMethod): void => {
    onChange(method);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        <View style={styles.header}>
          <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>
            Voting style
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.text.secondary, marginBottom: 20 },
          ]}
        >
          How will friends vote on the options?
        </Text>

        <View style={{ gap: 10 }}>
          <Option
            active={value === 'simple'}
            icon={<Vote size={22} color={theme.colors.accent} />}
            title="Simple vote"
            body="Everyone taps their favorite. Highest-voted option wins. Best for quick decisions."
            onPress={() => select('simple')}
          />
          <Option
            active={value === 'ranked'}
            icon={<ListOrdered size={22} color={theme.colors.accent} />}
            title="Ranked vote"
            body="Voters rank options 1st, 2nd, 3rd. Winner found by elimination rounds — fairest for tough choices."
            onPress={() => select('ranked')}
          />
        </View>
      </View>
    </Modal>
  );
}

function Option({
  active,
  icon,
  title,
  body,
  onPress,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: active
            ? theme.colors.accent + '15'
            : theme.colors.bg.surface,
          borderColor: active ? theme.colors.accent : theme.colors.border.default,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.optionIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {title}
        </Text>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.secondary, marginTop: 4 },
          ]}
        >
          {body}
        </Text>
      </View>
      {active ? <Check size={20} color={theme.colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  optionIcon: { width: 40, alignItems: 'center', paddingTop: 2 },
});
