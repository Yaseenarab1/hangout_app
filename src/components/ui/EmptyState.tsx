import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type EmptyStateProps = {
  title: string;
  body?: string;
  /** Optional icon node (e.g. lucide icon). */
  icon?: React.ReactNode;
  /** Optional action button or other element. */
  action?: React.ReactNode;
};

/**
 * Friendly empty state — used when a list/screen has no content.
 */
export function EmptyState({
  title,
  body,
  icon,
  action,
}: EmptyStateProps): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {icon ? <View style={{ marginBottom: 12 }}>{icon}</View> : null}
      <Text
        style={[
          theme.typography.bodyMedium,
          { color: theme.colors.text.primary, textAlign: 'center' },
        ]}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={[
            theme.typography.bodySmall,
            {
              color: theme.colors.text.secondary,
              textAlign: 'center',
              marginTop: 6,
              maxWidth: 320,
            },
          ]}
        >
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 48,
  },
});
