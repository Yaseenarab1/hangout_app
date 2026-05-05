import React from 'react';
import { Pressable, View, Text, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/hooks/useTheme';

export type AvatarUploadProps = {
  /** Used for the fallback color seeding before an image is picked. */
  id: string;
  displayName: string;
  uri?: string | null;
  onPicked: (localUri: string) => void;
};

/**
 * A circular avatar with a camera badge. Tap to pick from library.
 */
export function AvatarUpload({
  id,
  displayName,
  uri,
  onPicked,
}: AvatarUploadProps): React.ReactElement {
  const theme = useTheme();

  const onPress = async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access in Settings to pick a profile picture.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      // EXIF is stripped server-side via expo-image-manipulator in our upload pipeline.
      exif: false,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset) onPicked(asset.uri);
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Change profile photo"
      accessibilityRole="button"
      style={styles.wrap}
    >
      <Avatar id={id} displayName={displayName} uri={uri} size="xl" />
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.colors.accent, borderColor: theme.colors.bg.canvas },
        ]}
      >
        <Camera size={16} color="#FFFFFF" />
      </View>
      <Text
        style={[
          theme.typography.caption,
          { color: theme.colors.text.tertiary, marginTop: 8, textAlign: 'center' },
        ]}
      >
        Tap to change
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: 18, // sits over the corner of the 80px avatar
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
