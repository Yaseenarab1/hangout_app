import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  ImageStyle,
  TextStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { getPlacePhotoUrl } from '@/features/places';
import { RateRestaurantSheet } from './RateRestaurantSheet';
import type { RestaurantRating } from '../types';

type Props = {
  rating: RestaurantRating;
  /** true = full-width row (list page), false = compact card (horizontal scroll) */
  fullWidth?: boolean;
};

export function RestaurantRatingCard({ rating, fullWidth = false }: Props): React.ReactElement {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);

  const initialPlace = {
    place_id: rating.place_id,
    place_name: rating.place_name,
    place_address: rating.place_address,
    place_photo: rating.place_photo,
    place_type: rating.place_type,
  };

  const cardStyle: ViewStyle = {
    ...staticStyles.card,
    backgroundColor: theme.colors.bg.surface,
    shadowOpacity: 0.1,
    marginRight: fullWidth ? 0 : 12,
    width: fullWidth ? undefined : 260,
    borderLeftWidth: rating.rating === 5 ? 4 : 0,
    borderLeftColor: rating.rating === 5 ? '#8B5CF6' : 'transparent',
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [cardStyle, pressed && { opacity: 0.85 }]}
        onPress={() => setEditing(true)}
        onLongPress={() => setEditing(true)}
        delayLongPress={350}
      >
        {/* Photo or emoji fallback */}
        <View style={staticStyles.photoWrap}>
          {rating.place_photo ? (
            <Image
              source={{ uri: getPlacePhotoUrl(rating.place_photo, 120) }}
              style={staticStyles.photo as ImageStyle}
              contentFit="cover"
            />
          ) : (
            <View style={[staticStyles.photo as ViewStyle, staticStyles.photoFallback]}>
              <Text style={staticStyles.fallbackEmoji}>🍽️</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={staticStyles.info}>
          <Text style={[staticStyles.name, { color: theme.colors.text.primary }]} numberOfLines={1}>
            {rating.place_name}
          </Text>
          {(rating.place_type || rating.place_address) ? (
            <Text style={[staticStyles.meta, { color: theme.colors.text.tertiary }]} numberOfLines={1}>
              {[rating.place_type, rating.place_address].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {rating.notes ? (
            <Text style={[staticStyles.note, { color: theme.colors.text.tertiary }]} numberOfLines={1}>
              {rating.notes}
            </Text>
          ) : null}
        </View>

        {/* Star pill */}
        <View style={staticStyles.pill}>
          <Star size={12} color="#8B5CF6" fill="#8B5CF6" />
          <Text style={staticStyles.pillText}>{rating.rating}</Text>
        </View>
      </Pressable>

      <RateRestaurantSheet
        visible={editing}
        onClose={() => setEditing(false)}
        initialPlace={initialPlace}
      />
    </>
  );
}

const staticStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,
  photoWrap: {
    marginRight: 12,
  } as ViewStyle,
  photo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  } as ViewStyle,
  photoFallback: {
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  fallbackEmoji: {
    fontSize: 26,
  } as TextStyle,
  info: {
    flex: 1,
    gap: 2,
  } as ViewStyle,
  name: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
  meta: {
    fontSize: 12,
  } as TextStyle,
  note: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  } as TextStyle,
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  } as ViewStyle,
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5CF6',
  } as TextStyle,
});
