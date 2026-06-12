import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Camera, Image as ImageIcon, Globe, Users, Lock, Plus, X, ChevronLeft, ChevronRight, Video } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useCreatePost } from '@/features/feed';
import type { PostVisibility } from '@/features/feed';

const { width: SCREEN_W } = Dimensions.get('window');
const THUMB_SIZE = 80;
const MAX_PHOTOS = 4;

type Step = 'pick' | 'compose';

export default function NewPostScreen(): React.ReactElement {
  const theme = useTheme();
  const params = useLocalSearchParams<{ hangoutId?: string }>();
  const createPost = useCreatePost();

  const [step, setStep] = useState<Step>('pick');
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('friends');
  const [keepForever, setKeepForever] = useState(false);

  async function pickFrom(source: 'camera' | 'library', type: 'photo' | 'video' = 'photo') {
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            quality: 0.9,
            mediaTypes: type === 'video' ? 'videos' : 'images',
            videoMaxDuration: 60,
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.9,
            mediaTypes: type === 'video' ? 'videos' : 'images',
            allowsMultipleSelection: type === 'photo',
            selectionLimit: type === 'photo' ? MAX_PHOTOS : 1,
            videoMaxDuration: 60,
          });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0]!;
    const uris = type === 'video'
      ? [asset.uri]
      : result.assets.map((a) => a.uri).slice(0, MAX_PHOTOS);

    setLocalUris(uris);
    setMediaType(type);
    setVideoDuration(type === 'video' ? (asset.duration ?? undefined) : undefined);
    setPreviewIndex(0);
    if (params.hangoutId) setVisibility('hangout');
    setStep('compose');
  }

  async function addMore() {
    if (mediaType === 'video') return;
    const remaining = MAX_PHOTOS - localUris.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.9,
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets?.length) return;
    const newUris = result.assets.map((a) => a.uri);
    setLocalUris((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));
  }

  function removePhoto(index: number) {
    const next = localUris.filter((_, i) => i !== index);
    if (next.length === 0) {
      setStep('pick');
    } else {
      setLocalUris(next);
      setPreviewIndex(Math.min(previewIndex, next.length - 1));
    }
  }

  function movePhoto(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= localUris.length) return;
    const next = [...localUris];
    [next[from], next[to]] = [next[to]!, next[from]!];
    setLocalUris(next);
    setPreviewIndex(to);
  }

  async function share() {
    if (!localUris.length) return;
    await createPost.mutateAsync({
      localUris,
      mediaType,
      durationMs: videoDuration ? Math.round(videoDuration) : undefined,
      caption: caption.trim() || undefined,
      visibility,
      hangoutId: params.hangoutId,
      expiresAt: keepForever ? null : undefined,
    });
    router.back();
  }

  // ── Pick step ──────────────────────────────────────────────────────────────

  if (step === 'pick') {
    return (
      <Screen header={{ title: 'New post', showBack: true }}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text.secondary, marginBottom: 24 },
          ]}
        >
          Share a photo or video
        </Text>
        <View style={styles.options}>
          <OptionCard
            icon={<Camera size={28} color={theme.colors.accent} />}
            title="Take a photo"
            subtitle="Use your camera"
            onPress={() => pickFrom('camera', 'photo')}
            theme={theme}
          />
          <OptionCard
            icon={<ImageIcon size={28} color={theme.colors.accent} />}
            title="Choose photos"
            subtitle={`Pick up to ${MAX_PHOTOS} photos`}
            onPress={() => pickFrom('library', 'photo')}
            theme={theme}
          />
          <OptionCard
            icon={<Video size={28} color={theme.colors.accent} />}
            title="Record a video"
            subtitle="Up to 60 seconds"
            onPress={() => pickFrom('camera', 'video')}
            theme={theme}
          />
          <OptionCard
            icon={<Video size={28} color={theme.colors.accent} />}
            title="Choose a video"
            subtitle="From your library"
            onPress={() => pickFrom('library', 'video')}
            theme={theme}
          />
        </View>
      </Screen>
    );
  }

  // ── Compose step ───────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        header={{
          title: 'New post',
          showBack: true,
          right: (
            <Pressable
              onPress={share}
              disabled={createPost.isPending}
              hitSlop={12}
              style={{ padding: 8 }}
            >
              {createPost.isPending ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <Text style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}>
                  Share
                </Text>
              )}
            </Pressable>
          ),
        }}
        scroll
      >
        {/* ── Photo / video preview ── */}
        {mediaType === 'video' ? (
          <VideoPreview uri={localUris[0]!} style={[styles.preview, { borderRadius: theme.radii.md }]} />
        ) : (
          <Image
            source={{ uri: localUris[previewIndex]! }}
            style={[styles.preview, { borderRadius: theme.radii.md }]}
            resizeMode="cover"
          />
        )}

        {/* ── Thumbnail strip (photos only) ── */}
        {mediaType === 'photo' && <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
          contentContainerStyle={styles.thumbStrip}
        >
          {localUris.map((uri, i) => (
            <View key={i} style={styles.thumbWrapper}>
              <Pressable onPress={() => setPreviewIndex(i)}>
                <Image
                  source={{ uri }}
                  style={[
                    styles.thumb,
                    i === previewIndex && {
                      borderWidth: 2,
                      borderColor: theme.colors.accent,
                    },
                  ]}
                  resizeMode="cover"
                />
              </Pressable>
              <Pressable
                onPress={() => removePhoto(i)}
                style={[styles.removeBtn, { backgroundColor: theme.colors.bg.canvas }]}
              >
                <X size={10} color={theme.colors.text.primary} />
              </Pressable>
              {/* Reorder arrows — only on selected thumb, only when multiple photos */}
              {i === previewIndex && localUris.length > 1 && (
                <View style={styles.reorderRow}>
                  <Pressable
                    onPress={() => movePhoto(i, -1)}
                    disabled={i === 0}
                    style={[styles.reorderBtn, { opacity: i === 0 ? 0.3 : 1 }]}
                  >
                    <ChevronLeft size={12} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => movePhoto(i, 1)}
                    disabled={i === localUris.length - 1}
                    style={[styles.reorderBtn, { opacity: i === localUris.length - 1 ? 0.3 : 1 }]}
                  >
                    <ChevronRight size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          {/* Add more button */}
          {localUris.length < MAX_PHOTOS && (
            <Pressable
              onPress={addMore}
              style={[
                styles.addMoreBtn,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Plus size={20} color={theme.colors.accent} />
              <Text style={[theme.typography.caption, { color: theme.colors.accent, marginTop: 2 }]}>
                Add
              </Text>
            </Pressable>
          )}
        </ScrollView>}

        {/* ── Caption ── */}
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Write a caption… (optional)"
          placeholderTextColor={theme.colors.text.tertiary}
          multiline
          maxLength={2200}
          style={[
            theme.typography.body,
            styles.captionInput,
            {
              color: theme.colors.text.primary,
              borderColor: theme.colors.border.default,
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radii.md,
            },
          ]}
        />

        {/* ── Visibility ── */}
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.secondary, marginTop: 20, marginBottom: 8 },
          ]}
        >
          Who can see this?
        </Text>
        <View style={styles.visibilityRow}>
          {VISIBILITY_OPTIONS.filter((v) =>
            params.hangoutId ? true : v.value !== 'hangout',
          ).map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setVisibility(opt.value as PostVisibility)}
              style={({ pressed }) => [
                styles.visChip,
                {
                  backgroundColor:
                    visibility === opt.value ? theme.colors.accent : theme.colors.bg.surface,
                  borderColor:
                    visibility === opt.value ? theme.colors.accent : theme.colors.border.default,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {opt.icon(visibility === opt.value)}
              <Text
                style={[
                  theme.typography.caption,
                  {
                    color: visibility === opt.value ? '#FFFFFF' : theme.colors.text.primary,
                    marginLeft: 4,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Keep forever toggle ── */}
        <View style={[styles.expiryRow, { borderTopColor: theme.colors.border.default }]}>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
              Keep on profile
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
              {keepForever ? 'Stays on your profile forever' : 'Disappears in 24 hours'}
            </Text>
          </View>
          <Switch value={keepForever} onValueChange={setKeepForever} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const VISIBILITY_OPTIONS = [
  {
    value: 'friends',
    label: 'Friends',
    icon: (active: boolean) => <Users size={13} color={active ? '#FFFFFF' : '#8B5CF6'} />,
  },
  {
    value: 'public',
    label: 'Everyone',
    icon: (active: boolean) => <Globe size={13} color={active ? '#FFFFFF' : '#8B5CF6'} />,
  },
  {
    value: 'hangout',
    label: 'Hangout only',
    icon: (active: boolean) => <Lock size={13} color={active ? '#FFFFFF' : '#8B5CF6'} />,
  },
];

function VideoPreview({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function OptionCard({
  icon,
  title,
  subtitle,
  onPress,
  theme,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.cardIcon}>{icon}</View>
      <View style={styles.cardText}>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
          {title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  cardIcon: { width: 44, alignItems: 'center' },
  cardText: { flex: 1, gap: 2 },
  preview: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 12,
  },
  thumbStrip: {
    gap: 8,
    paddingRight: 4,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  reorderRow: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  reorderBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  visChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 20,
    gap: 4,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
