import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react-native';
import { useUIStore, type Toast as ToastType, type ToastKind } from '@/stores/ui.store';
import { useTheme } from '@/hooks/useTheme';

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

/**
 * Sits at the root of the app and renders any active toasts at the top of the screen.
 * Each toast auto-dismisses after `durationMs`; tap the X to dismiss early.
 */
export function Toaster(): React.ReactElement {
  const toasts = useUIStore((s) => s.toasts);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: insets.top + 8 }]}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
      {/* Force re-render when theme changes so colors update */}
      <View style={{ height: 0, opacity: 0, backgroundColor: theme.colors.accent }} />
    </View>
  );
}

function ToastItem({ toast }: { toast: ToastType }): React.ReactElement {
  const theme = useTheme();
  const dismiss = useUIStore((s) => s.dismissToast);
  const Icon = ICONS[toast.kind];

  const palette = (() => {
    switch (toast.kind) {
      case 'success':
        return { bg: theme.colors.bg.surface, accent: theme.colors.success };
      case 'error':
        return { bg: theme.colors.bg.surface, accent: theme.colors.danger };
      case 'warning':
        return { bg: theme.colors.bg.surface, accent: theme.colors.warning };
      case 'info':
      default:
        return { bg: theme.colors.bg.surface, accent: theme.colors.info };
    }
  })();

  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => clearTimeout(t);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.duration(200)}
      style={[
        styles.toast,
        Platform.select({
          ios: theme.elevations.e2,
          android: { elevation: 4 },
        }),
        {
          backgroundColor: palette.bg,
          borderColor: theme.colors.border.default,
          borderLeftColor: palette.accent,
          borderLeftWidth: 4,
        },
      ]}
    >
      <Icon size={20} color={palette.accent} />
      <Text
        style={[
          theme.typography.bodySmall,
          { color: theme.colors.text.primary, flex: 1, marginHorizontal: 12 },
        ]}
        numberOfLines={3}
      >
        {toast.message}
      </Text>
      <Pressable
        onPress={() => dismiss(toast.id)}
        accessibilityLabel="Dismiss notification"
        hitSlop={8}
      >
        <X size={18} color={theme.colors.text.tertiary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
});
