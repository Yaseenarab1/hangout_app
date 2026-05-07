import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useUnreadCount } from '../hooks/useUnreadCount';

type Props = { hangoutId: string };

export function UnreadBadge({ hangoutId }: Props): React.ReactElement | null {
  const theme = useTheme();
  const { data: count } = useUnreadCount(hangoutId);

  if (!count || count === 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
