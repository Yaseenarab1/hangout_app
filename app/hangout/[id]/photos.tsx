import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, Skeleton } from '@/components/ui';
import { Images } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import {
  usePhotos,
  useUploadPhoto,
  useDeletePhoto,
  useReactToPhoto,
  useUpdateCaption,
  PhotoGrid,
  PhotoViewer,
} from '@/features/photos';
import type { HangoutPhoto } from '@/features/photos';

const MAX_PHOTOS = 10;

export default function PhotosScreen(): React.ReactElement {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hangoutId = id ?? '';
  const { user } = useSession();

  const { photos, isLoading, isError, fetchOlder, hasOlder, isFetchingOlder } =
    usePhotos(hangoutId);
  const { upload, isPending, progress } = useUploadPhoto(hangoutId);
  const deletePhoto = useDeletePhoto(hangoutId);
  const reactToPhoto = useReactToPhoto(hangoutId);
  const updateCaption = useUpdateCaption(hangoutId);

  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const openViewer = useCallback((photo: HangoutPhoto, index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  }, []);

  const handleAddPhotos = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow photo library access in Settings to add photos.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      quality: 1,
      exif: false,
    });

    if (result.canceled || result.assets.length === 0) return;
    await upload(result.assets);
  }, [upload]);

  const handleDelete = useCallback(
    (photo: HangoutPhoto) => {
      deletePhoto.mutate({
        photoId: photo.id,
        storagePath: photo.storage_path,
        thumbnailPath: photo.thumbnail_path,
      });
    },
    [deletePhoto],
  );

  const handleReact = useCallback(
    (photoId: string, emoji: string) => {
      if (!user) return;
      reactToPhoto.mutate({ photoId, emoji, myUserId: user.id });
    },
    [reactToPhoto, user],
  );

  const handleUpdateCaption = useCallback(
    (photoId: string, caption: string) => {
      updateCaption.mutate({ photoId, caption });
    },
    [updateCaption],
  );

  const headerRight = (
    <Pressable
      onPress={handleAddPhotos}
      style={styles.addBtn}
      hitSlop={12}
      disabled={isPending}
    >
      <Plus size={22} color={theme.colors.accent} />
    </Pressable>
  );

  return (
    <Screen
      header={{ title: 'Photos', showBack: true, right: headerRight }}
      contentPadding={0}
    >
      {/* Upload progress banner */}
      {isPending && progress && (
        <View
          style={[styles.progressBanner, { backgroundColor: theme.colors.bg.surface }]}
        >
          <Text
            style={[theme.typography.bodySmall, { color: theme.colors.text.secondary }]}
          >
            {progress.phase === 'resizing'
              ? `Processing ${progress.index + 1} of ${progress.total}…`
              : `Uploading ${progress.index + 1} of ${progress.total}…`}
          </Text>
        </View>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} height={120} radius={0} style={{ flex: 1 }} />
          ))}
        </View>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <EmptyState
          title="Couldn't load photos"
          body="Check your connection and try again."
        />
      )}

      {/* Empty state */}
      {!isLoading && !isError && photos.length === 0 && (
        <EmptyState
          icon={<Images size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
          title="No photos yet"
          body="Tap + to add the first photo to this hangout."
        />
      )}

      {/* Grid */}
      {!isLoading && photos.length > 0 && (
        <PhotoGrid
          photos={photos}
          isFetchingOlder={isFetchingOlder}
          hasOlder={hasOlder ?? false}
          onFetchOlder={fetchOlder}
          onPhotoPress={openViewer}
        />
      )}

      {/* Full-screen viewer */}
      <PhotoViewer
        visible={viewerOpen}
        photos={photos}
        initialIndex={viewerIndex}
        myUserId={user?.id ?? ''}
        onClose={() => setViewerOpen(false)}
        onDelete={handleDelete}
        onReact={handleReact}
        onUpdateCaption={handleUpdateCaption}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    padding: 8,
  },
  progressBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    padding: 0,
  },
});
