import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Slot at the left (avatar, icon). */
  leading?: React.ReactNode;
  /** Slot at the right; if omitted and onPress provided, shows a chevron. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** Removes the chevron when onPress is set. */
  hideChevron?: boolean;
  style?: ViewStyle;
};

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  destructive = false,
  hideChevron = false,
  style,
}: ListItemProps): React.ReactElement {
  const theme = useTheme();

  const content = (
    <View style={[styles.row, style]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <Text
          style={[
            theme.typography.body,
            { color: destructive ? theme.colors.danger : theme.colors.text.primary },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.text.secondary, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <View style={styles.trailing}>{trailing}</View>
      ) : onPress && !hideChevron ? (
        <ChevronRight size={20} color={theme.colors.text.tertiary} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        pressed && { backgroundColor: theme.colors.bg.subtle },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  leading: {
    marginRight: 12,
  },
  body: {
    flex: 1,
  },
  trailing: {
    marginLeft: 12,
  },
});
