import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActionSheetIOS, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams } from 'expo-router';
import { Plus, Download } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, Skeleton } from '@/components/ui';
import { Images } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { toast } from '@/stores/ui.store';
import {
  usePhotos,
  useUploadPhoto,
  useDeletePhoto,
  useReactToPhoto,
  useUpdateCaption,
  PhotoGrid,
  PhotoViewer,
  getPhotoSignedUrl,
} from '@/features/photos';
import type { HangoutPhoto } from '@/features/photos';

const MAX_PHOTOS = 10;

async function requestSavePermission(): Promise<boolean> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission required', 'Allow camera roll access in Settings to save photos.');
    return false;
  }
  return true;
}

async function savePhotos(
  targets: HangoutPhoto[],
  onProgress: (done: number, total: number) => void,
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i++) {
    const photo = targets[i]!;
    try {
      const url = photo.signedUrl ?? (await getPhotoSignedUrl(photo.storage_path));
      const localUri = FileSystem.cacheDirectory + `save-${photo.id}.jpg`;
      const { uri } = await FileSystem.downloadAsync(url, localUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      saved++;
    } catch {
      failed++;
    }
    onProgress(i + 1, targets.length);
  }
  return { saved, failed };
}

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

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);

  const enterSelectionMode = useCallback((photo: HangoutPhoto) => {
    setSelectionMode(true);
    setSelectedIds(new Set([photo.id]));
  }, []);

  const startSelectMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((photo: HangoutPhoto) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(photos.map((p) => p.id)));
  }, [photos]);

  const allSelected = photos.length > 0 && selectedIds.size === photos.length;

  const handlePhotoPress = useCallback(
    (photo: HangoutPhoto, index: number) => {
      if (selectionMode) {
        toggleSelected(photo);
      } else {
        setViewerIndex(index);
        setViewerOpen(true);
      }
    },
    [selectionMode, toggleSelected],
  );

  const handleSaveSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!(await requestSavePermission())) return;
    const targets = photos.filter((p) => selectedIds.has(p.id));
    setSaveProgress({ done: 0, total: targets.length });
    const { saved, failed } = await savePhotos(targets, (done, total) =>
      setSaveProgress({ done, total }),
    );
    setSaveProgress(null);
    exitSelectionMode();
    if (failed === 0) {
      toast.success(`Saved ${saved} photo${saved !== 1 ? 's' : ''} to camera roll.`);
    } else {
      toast.error(`Saved ${saved}, failed ${failed}.`);
    }
  }, [selectedIds, photos, exitSelectionMode]);

  const handleSaveAll = useCallback(async () => {
    if (photos.length === 0) return;
    if (!(await requestSavePermission())) return;
    setSaveProgress({ done: 0, total: photos.length });
    const { saved, failed } = await savePhotos(photos, (done, total) =>
      setSaveProgress({ done, total }),
    );
    setSaveProgress(null);
    if (failed === 0) {
      toast.success(`Saved ${saved} photo${saved !== 1 ? 's' : ''} to camera roll.`);
    } else {
      toast.error(`Saved ${saved}, failed ${failed}.`);
    }
  }, [photos]);

  const handleSelectButton = useCallback(() => {
    const count = photos.length;
    const options = [`Download all ${count} photo${count !== 1 ? 's' : ''}`, 'Select photos', 'Cancel'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        (idx) => {
          if (idx === 0) handleSaveAll();
          else if (idx === 1) startSelectMode();
        },
      );
    } else {
      Alert.alert('Download photos', undefined, [
        { text: `Download all ${count} photo${count !== 1 ? 's' : ''}`, onPress: handleSaveAll },
        { text: 'Select photos', onPress: startSelectMode },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [photos.length, handleSaveAll, startSelectMode]);

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

  // ── Header ──────────────────────────────────────────────────────────────────

  const headerRight = selectionMode ? (
    <Pressable onPress={exitSelectionMode} hitSlop={12} style={styles.headerBtn}>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>
        Cancel
      </Text>
    </Pressable>
  ) : (
    <View style={styles.headerBtns}>
      {photos.length > 0 && (
        <Pressable
          onPress={handleSelectButton}
          style={styles.headerBtn}
          hitSlop={12}
          disabled={!!saveProgress}
        >
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>
            Select
          </Text>
        </Pressable>
      )}
      <Pressable
        onPress={handleAddPhotos}
        style={styles.headerBtn}
        hitSlop={12}
        disabled={isPending}
      >
        <Plus size={22} color={theme.colors.accent} />
      </Pressable>
    </View>
  );

  const headerTitle = selectionMode
    ? selectedIds.size === 0
      ? 'Select photos'
      : `${selectedIds.size} selected`
    : 'Photos';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Screen
      header={{ title: headerTitle, showBack: !selectionMode, right: headerRight }}
      contentPadding={0}
    >
      {/* Progress banner */}
      {((isPending && progress) || saveProgress) && (
        <View style={[styles.progressBanner, { backgroundColor: theme.colors.bg.surface }]}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text.secondary }]}>
            {saveProgress
              ? `Saving ${saveProgress.done} of ${saveProgress.total} to camera roll…`
              : progress?.phase === 'resizing'
              ? `Processing ${progress.index + 1} of ${progress.total}…`
              : `Uploading ${progress!.index + 1} of ${progress!.total}…`}
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

      {/* Empty */}
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
          onPhotoPress={handlePhotoPress}
          onPhotoLongPress={selectionMode ? undefined : enterSelectionMode}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
        />
      )}

      {/* Selection toolbar */}
      {selectionMode && (
        <View
          style={[
            styles.selectionBar,
            {
              backgroundColor: theme.colors.bg.canvas,
              borderTopColor: theme.colors.border.default,
            },
          ]}
        >
          <Pressable
            onPress={allSelected ? exitSelectionMode : selectAll}
            hitSlop={8}
          >
            <Text style={[theme.typography.bodySmall, { color: theme.colors.accent }]}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSaveSelected}
            disabled={selectedIds.size === 0 || !!saveProgress}
            style={[
              styles.saveBtn,
              {
                backgroundColor:
                  selectedIds.size === 0 ? theme.colors.bg.subtle : theme.colors.accent,
              },
            ]}
          >
            <Download size={16} color="#fff" />
            <Text style={styles.saveBtnText}>
              {selectedIds.size === 0
                ? 'Save'
                : `Save ${selectedIds.size} photo${selectedIds.size !== 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </View>
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
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
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
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 24,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
