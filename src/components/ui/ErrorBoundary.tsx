import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { logError } from '@/services/errors';
import { Button } from './Button';
import { lightTheme } from '@/design/theme';

type Props = {
  children: ReactNode;
  /** Optional custom fallback UI. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Wraps a screen or section. If anything inside throws during render,
 * we show a friendly fallback and log the real error to Sentry.
 *
 * Note: ErrorBoundary catches RENDER errors. It does NOT catch:
 *   - errors in event handlers (catch those manually)
 *   - errors in async code (use try/catch in mutations/queries)
 *   - errors during server-side rendering (N/A in RN)
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError(error, { componentStack: errorInfo.componentStack });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return <DefaultFallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ onReset }: { onReset: () => void }): React.ReactElement {
  // We intentionally don't useTheme() here — if the theme system is what crashed,
  // we'd loop. Use light tokens directly.
  const theme = lightTheme;
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
      <AlertTriangle size={48} color={theme.colors.danger} />
      <Text style={[theme.typography.h2, { color: theme.colors.text.primary, marginTop: 16 }]}>
        Something went wrong
      </Text>
      <Text
        style={[
          theme.typography.body,
          {
            color: theme.colors.text.secondary,
            textAlign: 'center',
            marginTop: 8,
            marginBottom: 24,
          },
        ]}
      >
        We've been notified. Try again, or restart the app if it keeps happening.
      </Text>
      <Button label="Try again" onPress={onReset} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
});
