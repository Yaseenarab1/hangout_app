import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X as XIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export type HeaderProps = {
  title?: string;
  /** Show a back chevron on the left. Defaults to true if `router.canGoBack()`. */
  showBack?: boolean;
  /** Show a close 'X' instead of a chevron (for modals). */
  showClose?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  /** Custom right-side action (button text, icon, etc.) */
  right?: React.ReactNode;
  /** When true, header is borderless (used over background images). */
  transparent?: boolean;
  /** Center the title (iOS-style). Default true on iOS. */
  centered?: boolean;
};

export function Header({
  title,
  showBack,
  showClose = false,
  onBack,
  onClose,
  right,
  transparent = false,
  centered = Platform.OS === 'ios',
}: HeaderProps): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const canBack = showBack ?? (router.canGoBack() && !showClose);

  const handleBack = (): void => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  const handleClose = (): void => {
    if (onClose) onClose();
    else if (router.canGoBack()) router.back();
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          backgroundColor: transparent ? 'transparent' : theme.colors.bg.canvas,
          borderBottomColor: transparent ? 'transparent' : theme.colors.border.default,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.side}>
          {canBack ? (
            <Pressable hitSlop={12} onPress={handleBack} accessibilityLabel="Back">
              <ChevronLeft size={28} color={theme.colors.text.primary} />
            </Pressable>
          ) : showClose ? (
            <Pressable hitSlop={12} onPress={handleClose} accessibilityLabel="Close">
              <XIcon size={26} color={theme.colors.text.primary} />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.titleWrap, centered && styles.titleCentered]}>
          {title ? (
            <Text
              style={[theme.typography.h3, { color: theme.colors.text.primary }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
        </View>

        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  side: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  titleWrap: {
    flex: 1,
  },
  titleCentered: {
    alignItems: 'center',
  },
});
