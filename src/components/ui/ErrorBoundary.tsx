import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** Optional fallback element. Default: a generic error message. */
  fallback?: React.ReactNode;
};

type State = { hasError: boolean; error?: Error };

/**
 * React error boundary. Wraps any subtree so render errors don't crash the app.
 *
 * Note: error boundaries only catch render-phase errors. Async errors and
 * event-handler errors won't be caught here.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            Please reload the app. If the issue persists, restart the app.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
