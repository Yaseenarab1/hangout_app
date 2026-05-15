import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useMyProfile } from '@/features/profile';
import { useComments, useCreateComment, useDeleteComment } from '../hooks/useComments';
import type { FeedPostComment } from '../types';

interface Props {
  postId: string;
  postAuthorId: string;
}

export function CommentsSheet({ postId, postAuthorId }: Props): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const myProfile = useMyProfile();
  const [body, setBody] = useState('');
  const inputRef = useRef<TextInput>(null);

  const { data: comments = [], isLoading } = useComments(postId);
  const createComment = useCreateComment(postId);
  const deleteComment = useDeleteComment(postId);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody('');
    await createComment.mutateAsync(trimmed);
  }

  function canDelete(comment: FeedPostComment) {
    return comment.user_id === user?.id || postAuthorId === user?.id;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Handle */}
        <View
          style={[styles.handle, { backgroundColor: theme.colors.border.strong }]}
        />
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.text.primary, textAlign: 'center', marginBottom: 12 },
          ]}
        >
          Comments
        </Text>

        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CommentRow
              comment={item}
              canDelete={canDelete(item)}
              onDelete={() => deleteComment.mutate(item.id)}
              theme={theme}
            />
          )}
          ListEmptyComponent={
            isLoading ? null : (
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.text.secondary, textAlign: 'center', marginTop: 40 },
                ]}
              >
                No comments yet. Be the first!
              </Text>
            )
          }
          contentContainerStyle={{ paddingBottom: 12 }}
        />
      </View>

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            borderTopColor: theme.colors.border.default,
            backgroundColor: theme.colors.bg.canvas,
          },
        ]}
      >
        <Avatar
          id={user?.id ?? ''}
          displayName={myProfile.data?.display_name}
          uri={myProfile.data?.avatar_url}
          size="xs"
        />
        <TextInput
          ref={inputRef}
          value={body}
          onChangeText={setBody}
          placeholder="Add a comment…"
          placeholderTextColor={theme.colors.text.tertiary}
          maxLength={500}
          style={[
            theme.typography.body,
            styles.input,
            {
              color: theme.colors.text.primary,
              backgroundColor: theme.colors.bg.subtle,
              borderRadius: 20,
            },
          ]}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={handleSend}
          disabled={!body.trim() || createComment.isPending}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          hitSlop={12}
        >
          <Send size={20} color={body.trim() ? theme.colors.accent : theme.colors.text.tertiary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
  theme,
}: {
  comment: FeedPostComment;
  canDelete: boolean;
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const author = comment.author;
  return (
    <View style={styles.commentRow}>
      <Avatar
        id={comment.user_id}
        displayName={author?.display_name}
        uri={author?.avatar_url}
        size="xs"
      />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={[theme.typography.bodySmallMedium, { color: theme.colors.text.primary }]}>
          {author?.display_name ?? 'Unknown'}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary }]}>
          {comment.body}
        </Text>
      </View>
      {canDelete && (
        <Pressable onPress={onDelete} hitSlop={12}>
          <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
            Delete
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 0,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
});
