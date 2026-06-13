import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { PlaceCompatibility } from '../types';

type Props = {
  compat: PlaceCompatibility | undefined;
};

export function FriendCompatibilityBar({ compat }: Props): React.ReactElement | null {
  // Hooks must run before any early return (rules of hooks).
  const theme = useTheme();
  if (!compat || compat.raterCount === 0) return null;

  const avg = compat.avgRating.toFixed(1);
  const label =
    compat.raterCount === 1
      ? '1 friend has been here'
      : `${compat.raterCount} friends have been here`;

  return (
    <View style={styles.row}>
      <Text style={styles.people}>👥</Text>
      <Text style={[styles.text, { color: '#8B5CF6' }]}>{label}</Text>
      <Text style={[styles.sep, { color: theme.colors.text.tertiary }]}> · </Text>
      <Star size={11} color="#8B5CF6" fill="#8B5CF6" />
      <Text style={[styles.avg, { color: '#8B5CF6' }]}> {avg} avg</Text>
      {compat.myRating !== null && (
        <Text style={[styles.mine, { color: theme.colors.text.tertiary }]}>
          {' '}
          (you: {compat.myRating}★)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  people: {
    fontSize: 11,
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  sep: {
    fontSize: 12,
  },
  avg: {
    fontSize: 12,
    fontWeight: '600',
  },
  mine: {
    fontSize: 11,
  },
});
