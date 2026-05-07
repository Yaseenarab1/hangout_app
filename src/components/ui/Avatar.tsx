import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, type ImageStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 20,
  xl: 28,
};

export type AvatarProps = {
  /** Image URI. Falls back to initials if missing or fails to load. */
  uri?: string | null;
  /** Display name — used to compute initials when no image. */
  name?: string | null;
  /** Alias for `name` — accepted for ergonomics at callsites. */
  displayName?: string | null;
  /** Accepted but unused — lets callers pass an entity id without errors. */
  id?: string;
  size?: AvatarSize;
  /** Custom background color (defaults to a theme-aware tint). */
  backgroundColor?: string;
  /** Optional extra styling on the wrapper. */
  style?: ImageStyle;
};

/**
 * Themed avatar. Prefers the image, falls back to colored circle with initials.
 */
export function Avatar({
  uri,
  name,
  displayName,
  id: _id,
  size = 'md',
  backgroundColor,
  style,
}: AvatarProps): React.ReactElement {
  const resolvedName = name ?? displayName;
  const theme = useTheme();
  const [errored, setErrored] = useState(false);

  const dim = SIZE_MAP[size];
  const fontSize = FONT_SIZE_MAP[size];
  const initials = computeInitials(resolvedName);
  const bg = backgroundColor ?? theme.colors.accent + '30';
  const showImage = !!uri && !errored;

  return (
    <View
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: showImage ? theme.colors.bg.subtle : bg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style as object,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          onError={() => setErrored(true)}
          style={{ width: dim, height: dim }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            fontSize,
            fontWeight: '600',
            color: theme.colors.accent,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

function computeInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
