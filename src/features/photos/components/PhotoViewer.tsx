import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Alert,
  PanResponder,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { X, Trash2, Download, Flag, MoreHorizontal, Check } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { toast } from '@/stores/ui.store';
import { getPhotoSignedUrl, fetchPhotoReactions } from '../services/photos.service';
import type { PhotoReaction } from '../types';
import { REACTION_EMOJIS } from '../types';
import type { HangoutPhoto } from '../types';

const REACTION_COLORS = {
  mine: 'rgba(139,92,246,0.3)',
  theirs: 'rgba(128,128,128,0.15)',
};

type Props = {
  visible: boolean;
  photos: HangoutPhoto[];
  initialIndex: number;
  myUserId: string;
  onClose: () => void;
  onDelete: (photo: HangoutPhoto) => void;
  onReact: (photoId: string, emoji: string) => void;
  onUpdateCaption: (photoId: string, caption: string) => void;
};

function ZoomablePhoto({
  photo,
  width,
  height,
  onZoomChange,
}: {
  photo: HangoutPhoto;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
}): React.ReactElement {
  const [uri, setUri] = useState(photo.signedUrl ?? photo.thumbnailSignedUrl);

  useEffect(() => {
    if (!photo.signedUrl && photo.storage_path) {
      getPhotoSignedUrl(photo.storage_path).then(setUri).catch(() => {});
    }
  }, [photo.signedUrl, photo.storage_path]);

  return (
    <ScrollView
      style={{ width, height }}
      contentContainerStyle={{ width, height }}
      maximumZoomScale={4}
      minimumZoomScale={1}
      centerContent
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      bouncesZoom
      scrollEventThrottle={100}
      onScrollEndDrag={(e) => {
        const zoom = (e.nativeEvent as any).zoomScale ?? 1;
        onZoomChange(zoom > 1.05);
      }}
    >
      <Image
        source={{ uri }}
        style={{ width, height }}
        contentFit="contain"
        recyclingKey={photo.id}
      />
    </ScrollView>
  );
}

function ReactionBar({
  reactions,
  myUserId,
  onReact,
}: {
  reactions: PhotoReaction[];
  myUserId: string;
  onReact: (emoji: string) => void;
}): React.ReactElement {
  const theme = useTheme();

  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    if (r.user_id === myUserId) mine.add(r.emoji);
  }

  return (
    <View style={styles.reactionBar}>
      {/* Emoji picker */}
      <View style={styles.emojiPicker}>
        {REACTION_EMOJIS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => onReact(emoji)}
            style={[
              styles.emojiBtn,
              mine.has(emoji) && { backgroundColor: REACTION_COLORS.mine },
            ]}
          >
            <Text style={styles.emojiText} allowFontScaling={false}>{emoji}</Text>
          </Pressable>
        ))}
      </View>

      {/* Reaction counts */}
      {counts.size > 0 && (
        <View style={styles.reactionCounts}>
          {Array.from(counts.entries()).map(([emoji, count]) => (
            <Pressable
              key={emoji}
              onPress={() => onReact(emoji)}
              style={[
                styles.reactionChip,
                {
                  backgroundColor: mine.has(emoji)
                    ? REACTION_COLORS.mine
                    : REACTION_COLORS.theirs,
                  borderColor: mine.has(emoji)
                    ? 'rgba(139,92,246,0.6)'
                    : theme.colors.border.default,
                },
              ]}
            >
              <Text style={styles.emojiText} allowFontScaling={false}>{emoji}</Text>
              <Text style={[styles.countText, { color: theme.colors.text.primary }]}>
                {count}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function PhotoViewer({
  visible,
  photos,
  initialIndex,
  myUserId,
  onClose,
  onDelete,
  onReact,
  onUpdateCaption,
}: Props): React.ReactElement | null {
  const theme = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const [currentIdx, setCurrentIdx] = useState(initialIndex);
  const [showMenu, setShowMenu] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [reactions, setReactions] = useState<PhotoReaction[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const isZoomedRef = useRef(false);
  const dismissY = useRef(new Animated.Value(0)).current;

  const photo = photos[currentIdx];

  useEffect(() => {
    if (visible) {
      setCurrentIdx(initialIndex);
      isZoomedRef.current = false;
      dismissY.setValue(0);
    }
  }, [visible, initialIndex]);

  useEffect(() => {
    if (photo) {
      setCaptionDraft(photo.caption ?? '');
      setEditingCaption(false);
      // Fetch reactions for this photo
      fetchPhotoReactions(photo.id)
        .then(setReactions)
        .catch(() => setReactions([]));
    }
  }, [photo?.id]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        !isZoomedRef.current &&
        gs.dy > 15 &&
        gs.dy > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dismissY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          onClose();
        } else {
          Animated.spring(dismissY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const handleScrollEnd = useCallback((e: any) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / W);
    setCurrentIdx(idx);
    isZoomedRef.current = false;
  }, [W]);

  const handleSave = useCallback(async () => {
    if (!photo) return;
    setShowMenu(false);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Camera roll access required to save.');
        return;
      }
      const url = photo.signedUrl ?? (await getPhotoSignedUrl(photo.storage_path));
      const localUri = FileSystem.cacheDirectory + `photo-${photo.id}.jpg`;
      const { uri } = await FileSystem.downloadAsync(url, localUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      toast.success('Saved to camera roll.');
    } catch {
      toast.error('Failed to save photo.');
    }
  }, [photo]);

  const handleDelete = useCallback(() => {
    if (!photo) return;
    setShowMenu(false);
    Alert.alert('Delete photo?', 'This photo will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(photo);
          if (currentIdx >= photos.length - 1 && currentIdx > 0) {
            setCurrentIdx(currentIdx - 1);
          }
          if (photos.length <= 1) onClose();
        },
      },
    ]);
  }, [photo, currentIdx, photos.length, onDelete, onClose]);

  const handleSaveCaption = useCallback(() => {
    if (!photo) return;
    onUpdateCaption(photo.id, captionDraft);
    setEditingCaption(false);
  }, [photo, captionDraft, onUpdateCaption]);

  const isMine = photo?.uploader_id === myUserId;

  if (!visible || !photo) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.bg}>
        {/* Dismiss drag wrapper */}
        <Animated.View
          style={{ flex: 1, transform: [{ translateY: dismissY }] }}
          {...panResponder.panHandlers}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={12}>
              <X size={22} color="#fff" />
            </Pressable>
            <Text style={styles.headerCount}>
              {currentIdx + 1} / {photos.length}
            </Text>
            <Pressable
              onPress={() => setShowMenu((v) => !v)}
              style={styles.headerBtn}
              hitSlop={12}
            >
              <MoreHorizontal size={22} color="#fff" />
            </Pressable>
          </View>

          {/* Action menu */}
          {showMenu && (
            <View
              style={[
                styles.menu,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Pressable
                style={styles.menuRow}
                onPress={handleSave}
              >
                <Download size={16} color={theme.colors.text.primary} />
                <Text style={[styles.menuLabel, { color: theme.colors.text.primary }]}>
                  Save to camera roll
                </Text>
              </Pressable>
              {isMine ? (
                <Pressable style={styles.menuRow} onPress={handleDelete}>
                  <Trash2 size={16} color={theme.colors.danger} />
                  <Text style={[styles.menuLabel, { color: theme.colors.danger }]}>
                    Delete
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    setShowMenu(false);
                    toast.info("Reported. We'll review it.");
                  }}
                >
                  <Flag size={16} color={theme.colors.text.secondary} />
                  <Text
                    style={[styles.menuLabel, { color: theme.colors.text.secondary }]}
                  >
                    Report
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Photo strip */}
          <FlatList
            ref={flatListRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p) => p.id}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: W,
              offset: W * index,
              index,
            })}
            onMomentumScrollEnd={handleScrollEnd}
            renderItem={({ item }) => (
              <ZoomablePhoto
                photo={item}
                width={W}
                height={H}
                onZoomChange={(zoomed) => {
                  isZoomedRef.current = zoomed;
                }}
              />
            )}
            style={{ flex: 1 }}
          />

          {/* Footer */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.footer}>
              {/* Uploader name */}
              {photo.uploader && (
                <Text style={styles.uploaderName}>
                  {photo.uploader.display_name}
                </Text>
              )}

              {/* Caption */}
              {editingCaption ? (
                <View style={styles.captionRow}>
                  <TextInput
                    value={captionDraft}
                    onChangeText={setCaptionDraft}
                    placeholder="Add a caption…"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.captionInput}
                    multiline
                    maxLength={500}
                    autoFocus
                  />
                  <Pressable onPress={handleSaveCaption} hitSlop={12}>
                    <Check size={20} color="#8B5CF6" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={isMine ? () => setEditingCaption(true) : undefined}
                  disabled={!isMine}
                >
                  {photo.caption ? (
                    <Text style={styles.captionText}>{photo.caption}</Text>
                  ) : isMine ? (
                    <Text style={styles.captionPlaceholder}>Add a caption…</Text>
                  ) : null}
                </Pressable>
              )}

              {/* Reactions */}
              <ReactionBar
                reactions={reactions}
                myUserId={myUserId}
                onReact={(emoji) => {
                  // Optimistic update
                  const exists = reactions.some(
                    (r) => r.user_id === myUserId && r.emoji === emoji,
                  );
                  setReactions((prev) =>
                    exists
                      ? prev.filter((r) => !(r.user_id === myUserId && r.emoji === emoji))
                      : [
                          ...prev,
                          {
                            photo_id: photo.id,
                            user_id: myUserId,
                            emoji,
                            created_at: new Date().toISOString(),
                          },
                        ],
                  );
                  onReact(photo.id, emoji);
                }}
              />
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 56,
    paddingBottom: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCount: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  menu: {
    position: 'absolute',
    top: 106,
    right: 12,
    zIndex: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    minWidth: 200,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuLabel: { fontSize: 15 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 8,
  },
  uploaderName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  captionInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    minHeight: 36,
  },
  captionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  captionPlaceholder: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
  reactionBar: { gap: 8 },
  emojiPicker: {
    flexDirection: 'row',
    gap: 4,
  },
  emojiBtn: {
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  emojiText: { fontSize: 22 },
  reactionCounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  countText: { fontSize: 13, fontWeight: '600' },
});
