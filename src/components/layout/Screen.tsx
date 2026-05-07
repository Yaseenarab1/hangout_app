import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Header, type HeaderProps } from '@/components/ui/Header';

export type ScreenProps = {
  children: React.ReactNode;
  /** If provided, renders the standard Header above the content. */
  header?: HeaderProps;
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
  /** Pad the content area. Default: theme.spacing[4]. Pass 0 for full-bleed. */
  contentPadding?: number;
  /** Avoid the keyboard on focus (default true on iOS). */
  avoidKeyboard?: boolean;
  /** Extra props for the inner ScrollView. */
  scrollProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>;
  /** Pull-to-refresh control. Passed directly to the inner ScrollView. */
  refreshControl?: React.ReactElement;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  /** Background color override. */
  backgroundColor?: string;
};

/**
 * The standard screen wrapper. Every route should use this so we have consistent
 * safe-area handling, keyboard avoidance, and background color.
 */
export function Screen({
  children,
  header,
  scroll = false,
  contentPadding,
  avoidKeyboard = Platform.OS === 'ios',
  scrollProps,
  refreshControl,
  contentContainerStyle,
  style,
  backgroundColor,
}: ScreenProps): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding = contentPadding ?? theme.spacing[4];
  const bg = backgroundColor ?? theme.colors.bg.canvas;

  const inner = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          padding,
          paddingBottom: insets.bottom + theme.spacing[8],
          flexGrow: 1,
        },
        contentContainerStyle,
      ]}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        {
          flex: 1,
          padding,
          paddingBottom: padding + insets.bottom,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  const content = (
    <View style={[styles.root, { backgroundColor: bg }, style]}>
      {header ? <Header {...header} /> : null}
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );

  return content;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
