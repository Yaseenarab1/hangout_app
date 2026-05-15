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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Globe, Users, Lock } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { Button, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useCreatePost } from '@/features/feed';
import type { PostVisibility } from '@/features/feed';

type Step = 'pick' | 'compose';

export default function NewPostScreen(): React.ReactElement {
  const theme = useTheme();
  const params = useLocalSearchParams<{ hangoutId?: string }>();
  const createPost = useCreatePost();

  const [step, setStep] = useState<Step>('pick');
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('friends');
  const [keepForever, setKeepForever] = useState(false);

  async function pick(source: 'camera' | 'library') {
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.9, mediaTypes: 'images' })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: 'images' });

    if (result.canceled || !result.assets?.[0]) return;
    setLocalUri(result.assets[0]!.uri);
    if (params.hangoutId) setVisibility('hangout');
    setStep('compose');
  }

  async function share() {
    if (!localUri) return;
    await createPost.mutateAsync({
      localUri,
      caption: caption.trim() || undefined,
      visibility,
      hangoutId: params.hangoutId,
      expiresAt: keepForever ? null : undefined, // undefined = default 24h
    });
    router.back();
  }

  if (step === 'pick') {
    return (
      <Screen header={{ title: 'New post', showBack: true }}>
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.text.secondary, marginBottom: 32 },
          ]}
        >
          Choose a photo to share
        </Text>
        <View style={styles.options}>
          <OptionCard
            icon={<Camera size={28} color={theme.colors.accent} />}
            title="Take a photo"
            subtitle="Use your camera"
            onPress={() => pick('camera')}
            theme={theme}
          />
          <OptionCard
            icon={<ImageIcon size={28} color={theme.colors.accent} />}
            title="Choose from library"
            subtitle="Pick an existing photo"
            onPress={() => pick('library')}
            theme={theme}
          />
        </View>
      </Screen>
    );
  }

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
                <Text
                  style={[theme.typography.bodyMedium, { color: theme.colors.accent }]}
                >
                  Share
                </Text>
              )}
            </Pressable>
          ),
        }}
        scroll
      >
        {/* Preview */}
        <Image
          source={{ uri: localUri! }}
          style={[styles.preview, { borderRadius: theme.radii.md }]}
          resizeMode="cover"
        />

        {/* Caption */}
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

        {/* Visibility */}
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.text.secondary, marginTop: 24, marginBottom: 8 },
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
                    visibility === opt.value
                      ? theme.colors.accent
                      : theme.colors.bg.surface,
                  borderColor:
                    visibility === opt.value
                      ? theme.colors.accent
                      : theme.colors.border.default,
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

        {/* Expiry */}
        <View style={styles.expiryRow}>
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
    icon: (active: boolean) => (
      <Users size={13} color={active ? '#FFFFFF' : '#8B5CF6'} />
    ),
  },
  {
    value: 'public',
    label: 'Everyone',
    icon: (active: boolean) => (
      <Globe size={13} color={active ? '#FFFFFF' : '#8B5CF6'} />
    ),
  },
  {
    value: 'hangout',
    label: 'Hangout only',
    icon: (active: boolean) => (
      <Lock size={13} color={active ? '#FFFFFF' : '#8B5CF6'} />
    ),
  },
];

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
    marginBottom: 16,
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
    marginBottom: 24,
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
