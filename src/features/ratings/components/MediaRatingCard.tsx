import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { MediaRating } from '../types';

type Props = {
  rating: MediaRating;
  fullWidth?: boolean;
  onPress?: () => void;
};

export function MediaRatingCard({ rating, fullWidth = false, onPress }: Props): React.ReactElement {
  const theme = useTheme();
  const isFive = rating.rating === 5;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        fullWidth ? styles.fullWidth : styles.compact,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: isFive ? '#8B5CF6' + '60' : theme.colors.border.default,
          opacity: pressed ? 0.75 : 1,
        },
        isFive && styles.fiveAccent,
      ]}
    >
      {/* Poster */}
      {rating.poster_url ? (
        <Image
          source={{ uri: rating.poster_url }}
          style={styles.poster}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.poster, { backgroundColor: theme.colors.bg.subtle, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 22 }}>🎬</Text>
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary, fontWeight: '600' }]} numberOfLines={2}>
          {rating.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {rating.year ? (
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
              {rating.year}
            </Text>
          ) : null}
          <View style={[styles.typeBadge, { backgroundColor: rating.media_type === 'tv' ? '#3B82F620' : '#F59E0B20' }]}>
            <Text style={[theme.typography.caption, { color: rating.media_type === 'tv' ? '#3B82F6' : '#F59E0B', fontWeight: '600', fontSize: 10 }]}>
              {rating.media_type === 'tv' ? 'TV' : 'Film'}
            </Text>
          </View>
        </View>
        {rating.notes ? (
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary, fontStyle: 'italic' }]} numberOfLines={1}>
            {rating.notes}
          </Text>
        ) : null}
      </View>

      {/* Star pill */}
      <View style={[styles.starPill, { backgroundColor: '#8B5CF6' + '18' }]}>
        <Star size={10} color="#8B5CF6" fill="#8B5CF6" strokeWidth={0} />
        <Text style={[theme.typography.caption, { color: '#8B5CF6', fontWeight: '700', fontSize: 12 }]}>
          {rating.rating}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  compact: {
    width: 260,
  },
  fullWidth: {
    width: '100%',
  },
  fiveAccent: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  poster: {
    width: 48,
    height: 68,
    borderRadius: 8,
    flexShrink: 0,
  },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'center',
    flexShrink: 0,
  },
});
