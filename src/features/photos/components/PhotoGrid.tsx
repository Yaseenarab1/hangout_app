import React, { useMemo } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { PhotoTile } from './PhotoTile';
import type { HangoutPhoto } from '../types';

const COLUMNS = 3;
const GAP = 2;

type PhotoSlot = HangoutPhoto | null;

type FlatItem =
  | { type: 'header'; label: string }
  | { type: 'row'; photos: PhotoSlot[] };

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function buildFlatItems(photos: HangoutPhoto[]): FlatItem[] {
  const sections = new Map<string, HangoutPhoto[]>();
  for (const photo of photos) {
    const label = formatDateLabel(photo.created_at);
    if (!sections.has(label)) sections.set(label, []);
    sections.get(label)!.push(photo);
  }

  const items: FlatItem[] = [];
  for (const [label, sectionPhotos] of sections) {
    items.push({ type: 'header', label });
    for (let i = 0; i < sectionPhotos.length; i += COLUMNS) {
      const row: PhotoSlot[] = sectionPhotos.slice(i, i + COLUMNS);
      while (row.length < COLUMNS) row.push(null);
      items.push({ type: 'row', photos: row });
    }
  }
  return items;
}

type Props = {
  photos: HangoutPhoto[];
  isFetchingOlder: boolean;
  hasOlder: boolean;
  onFetchOlder: () => void;
  onPhotoPress: (photo: HangoutPhoto, index: number) => void;
};

export function PhotoGrid({
  photos,
  isFetchingOlder,
  hasOlder,
  onFetchOlder,
  onPhotoPress,
}: Props): React.ReactElement {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const tileSize = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);

  const items = useMemo(() => buildFlatItems(photos), [photos]);

  const renderItem = ({ item }: { item: FlatItem }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <View
            style={[styles.sectionLine, { backgroundColor: theme.colors.border.default }]}
          />
          <Text
            style={[theme.typography.caption, { color: theme.colors.text.secondary }]}
          >
            {item.label}
          </Text>
          <View
            style={[styles.sectionLine, { backgroundColor: theme.colors.border.default }]}
          />
        </View>
      );
    }

    return (
      <View style={[styles.row, { gap: GAP }]}>
        {item.photos.map((photo, col) =>
          photo ? (
            <PhotoTile
              key={photo.id}
              photo={photo}
              size={tileSize}
              onPress={() => {
                const globalIndex = photos.indexOf(photo);
                onPhotoPress(photo, globalIndex >= 0 ? globalIndex : 0);
              }}
            />
          ) : (
            <View key={`empty-${col}`} style={{ width: tileSize, height: tileSize }} />
          ),
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(item, idx) =>
        item.type === 'header' ? `header-${item.label}` : `row-${idx}`
      }
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
      contentContainerStyle={styles.list}
      removeClippedSubviews
      onEndReached={() => {
        if (hasOlder && !isFetchingOlder) onFetchOlder();
      }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        isFetchingOlder ? (
          <ActivityIndicator style={{ paddingVertical: 24 }} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row' },
});
