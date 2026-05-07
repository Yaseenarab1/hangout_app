import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { env } from '@/config/env';
import { getPlacePhotoUrl } from '../services/places.service';

type PlacePhotoProps = {
  photoName: string | null | undefined;
  width: number;
  height: number;
  style?: object;
};

const AUTH_HEADERS = { Authorization: `Bearer ${env.supabaseAnonKey}` };

export function PlacePhoto({ photoName, width, height, style }: PlacePhotoProps): React.ReactElement {
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!photoName || error) {
    return (
      <View
        style={[
          styles.placeholder,
          { width, height, backgroundColor: theme.colors.bg.subtle },
          style,
        ]}
      >
        <ImageOff size={24} color={theme.colors.text.tertiary} />
      </View>
    );
  }

  const uri = getPlacePhotoUrl(photoName, width * 2); // 2× for retina

  return (
    <View style={[{ width, height }, style]}>
      {!loaded ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.bg.subtle },
          ]}
        />
      ) : null}
      <Image
        source={{ uri, headers: AUTH_HEADERS }}
        style={{ width, height }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
