import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import type { HangoutPhoto } from '../types';

const ACCENT = '#8B5CF6';

type Props = {
  photo: HangoutPhoto;
  size: number;
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
};

export function PhotoTile({
  photo,
  size,
  onPress,
  onLongPress,
  selectionMode = false,
  isSelected = false,
}: Props): React.ReactElement {
  const uri = photo.thumbnailSignedUrl ?? photo.signedUrl;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.tile, { width: size, height: size }]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, isSelected && styles.selectedDim]}
          contentFit="cover"
          recyclingKey={photo.id}
          transition={150}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}

      {/* Selection overlay */}
      {selectionMode && (
        <View style={styles.checkOverlay} pointerEvents="none">
          <View
            style={[
              styles.checkCircle,
              isSelected
                ? { backgroundColor: ACCENT, borderColor: ACCENT }
                : { backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.85)' },
            ]}
          >
            {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  placeholder: {
    backgroundColor: '#2a2a2a',
  },
  selectedDim: {
    opacity: 0.75,
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 6,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
