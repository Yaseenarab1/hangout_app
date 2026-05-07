import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { HangoutPhoto } from '../types';

type Props = {
  photo: HangoutPhoto;
  size: number;
  onPress: () => void;
};

export function PhotoTile({ photo, size, onPress }: Props): React.ReactElement {
  const uri = photo.thumbnailSignedUrl ?? photo.signedUrl;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, { width: size, height: size }]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={photo.id}
          transition={150}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
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
});
