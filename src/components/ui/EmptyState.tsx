import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button, type ButtonProps } from './Button';

export type EmptyStateProps = {
  /** Lucide icon component (or any element). */
  icon?: React.ReactNode;
  title: string;
  body?: string;
  /** Pass label + onPress to render a primary button. */
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonProps['variant'];
  style?: ViewStyle;
};

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  style,
}: EmptyStateProps): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={[styles.container, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text
        style={[
          theme.typography.h3,
          { color: theme.colors.text.primary, marginBottom: theme.spacing[2] },
        ]}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={[
            theme.typography.body,
            {
              color: theme.colors.text.secondary,
              textAlign: 'center',
              marginBottom: theme.spacing[5],
            },
          ]}
        >
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant={actionVariant} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  icon: {
    marginBottom: 16,
  },
});
