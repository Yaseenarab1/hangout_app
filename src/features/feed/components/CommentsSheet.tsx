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
import { router } from 'expo-router';
import { Avatar } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useMyProfile } from '@/features/profile';
import { useComments, useCreateComment, useDeleteComment } from '../hooks/useComments';
import { useReactToComment } from '../hooks/useReactToPost';
import { ReactionPicker } from './ReactionPicker';
import { REACTIONS, type FeedPostComment, type ReactionType } from '../types';

interface Props {
  postId: string;
  postAuthorId: string;
}

export function CommentsSheet({ postId, postAuthorId }: Props): React.ReactElement {
  const theme = useTheme();
  const { user } = useSession();
  const myProfile = useMyProfile();
  const [body, setBody] = useState('');
  const [pickerForComment, setPickerForComment] = useState<string | null>(null);

  const { data: comments = [], isLoading } = useComments(postId);
  const createComment = useCreateComment(postId);
  const deleteComment = useDeleteComment(postId);
  const reactToComment = useReactToComment(postId);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody('');
    await createComment.mutateAsync(trimmed);
  }

  function canDelete(comment: FeedPostComment) {
    return comment.user_id === user?.id || postAuthorId === user?.id;
  }

  function handleCommentReact(commentId: string, type: ReactionType, current: ReactionType | null) {
    setPickerForComment(null);
    reactToComment.mutate({ commentId, reactionType: type, currentReaction: current });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Dismiss picker on tap outside */}
      {pickerForComment && (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => setPickerForComment(null)}
        />
      )}

      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <View style={[styles.handle, { backgroundColor: theme.colors.border.strong }]} />
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
              onLongPress={() => setPickerForComment(item.id)}
              isPickerOpen={pickerForComment === item.id}
              onReact={(type) => handleCommentReact(item.id, type, item.viewer_reaction ?? null)}
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
  onLongPress,
  isPickerOpen,
  onReact,
  theme,
}: {
  comment: FeedPostComment;
  canDelete: boolean;
  onDelete: () => void;
  onLongPress: () => void;
  isPickerOpen: boolean;
  onReact: (type: ReactionType) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const author = comment.author;
  const myReaction = comment.viewer_reaction ?? null;
  const reactions = comment.reactions ?? [];

  return (
    <View>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        style={styles.commentRow}
      >
        <Pressable onPress={() => router.push(`/profile/${comment.user_id}`)} hitSlop={8}>
          <Avatar
            id={comment.user_id}
            displayName={author?.display_name}
            uri={author?.avatar_url}
            size="xs"
          />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text
            style={[theme.typography.bodySmallMedium, { color: theme.colors.text.primary }]}
            onPress={() => router.push(`/profile/${comment.user_id}`)}
          >
            {author?.display_name ?? 'Unknown'}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.text.primary }]}>
            {comment.body}
          </Text>

          {/* Reaction counts on comment */}
          {reactions.length > 0 && (
            <View style={styles.commentReactions}>
              {reactions.slice(0, 4).map((r) => {
                const def = REACTIONS.find((x) => x.type === r.type);
                return (
                  <Pressable
                    key={r.type}
                    onPress={() => onReact(r.type)}
                    style={[
                      styles.reactionChip,
                      myReaction === r.type && { backgroundColor: 'rgba(139,92,246,0.15)' },
                    ]}
                  >
                    <Text style={styles.chipEmoji}>{def?.emoji}</Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.text.secondary, marginLeft: 2 }]}>
                      {r.count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {canDelete && (
          <Pressable onPress={onDelete} hitSlop={12}>
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
              Delete
            </Text>
          </Pressable>
        )}
      </Pressable>

      {isPickerOpen && (
        <View style={styles.commentPickerRow}>
          <ReactionPicker currentReaction={myReaction} onSelect={onReact} />
        </View>
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
  },
  commentReactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipEmoji: {
    fontSize: 13,
  },
  commentPickerRow: {
    paddingLeft: 44,
    paddingBottom: 8,
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
