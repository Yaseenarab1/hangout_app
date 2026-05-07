import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Avatar } from '@/components/ui';
import type { Message } from '../types';

type Props = {
  message: Message;
  isMine: boolean;
  showHeader: boolean; // first message in a sender group
  onLongPress: (message: Message) => void;
  onRetry?: (message: Message) => void;
  onPressReply?: (message: Message) => void;
};

export function MessageBubble({
  message,
  isMine,
  showHeader,
  onLongPress,
  onRetry,
  onPressReply,
}: Props): React.ReactElement {
  const theme = useTheme();
  const isDeleted = !!message.deleted_at;

  const bubbleBg = isMine
    ? theme.colors.accent
    : theme.colors.bg.surface;
  const bubbleText = isMine
    ? '#FFFFFF'
    : theme.colors.text.primary;
  const bubbleBorder = isMine
    ? 'transparent'
    : theme.colors.border.default;

  // Group reactions by emoji
  const reactionGroups = (message.reactions ?? []).reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      {/* Avatar — only for others, only on group header */}
      {!isMine && (
        <View style={styles.avatarSlot}>
          {showHeader ? (
            <Avatar
              uri={(message.sender as any)?.avatar_url ?? null}
              name={(message.sender as any)?.display_name ?? '?'}
              size="sm"
            />
          ) : null}
        </View>
      )}

      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {/* Sender name — only for others, only on group header */}
        {!isMine && showHeader && (
          <Text style={[styles.senderName, { color: theme.colors.accent }]}>
            {(message.sender as any)?.display_name ?? 'Someone'}
          </Text>
        )}

        {/* Reply preview */}
        {message.reply_to && (
          <Pressable
            onPress={() => message.reply_to && onPressReply?.(message.reply_to as Message)}
            style={[
              styles.replyBlock,
              { backgroundColor: isMine ? 'rgba(255,255,255,0.2)' : theme.colors.bg.subtle },
            ]}
          >
            <Text
              style={[styles.replyName, { color: isMine ? 'rgba(255,255,255,0.8)' : theme.colors.accent }]}
            >
              {(message.reply_to.sender as any)?.display_name ?? 'Someone'}
            </Text>
            <Text
              style={[styles.replyBody, { color: isMine ? 'rgba(255,255,255,0.7)' : theme.colors.text.secondary }]}
              numberOfLines={1}
            >
              {message.reply_to.deleted_at ? 'Message deleted' : message.reply_to.body}
            </Text>
          </Pressable>
        )}

        {/* Body */}
        <Pressable onLongPress={() => !message.pending && !isDeleted && onLongPress(message)}>
          <View
            style={[
              styles.bodyContainer,
              {
                backgroundColor: bubbleBg,
                borderColor: bubbleBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.body,
                {
                  color: isDeleted
                    ? (isMine ? 'rgba(255,255,255,0.5)' : theme.colors.text.tertiary)
                    : bubbleText,
                  fontStyle: isDeleted ? 'italic' : 'normal',
                },
              ]}
            >
              {isDeleted ? 'Message deleted' : message.body}
            </Text>
            <View style={styles.meta}>
              <Text style={[styles.time, { color: isMine ? 'rgba(255,255,255,0.6)' : theme.colors.text.tertiary }]}>
                {new Date(message.created_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              {message.edited_at && !isDeleted && (
                <Text style={[styles.edited, { color: isMine ? 'rgba(255,255,255,0.5)' : theme.colors.text.tertiary }]}>
                  {' '}· edited
                </Text>
              )}
            </View>
          </View>
        </Pressable>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <View style={[styles.reactions, isMine ? styles.reactionsMine : styles.reactionsTheirs]}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <View
                key={emoji}
                style={[styles.reactionChip, { backgroundColor: theme.colors.bg.subtle, borderColor: theme.colors.border.default }]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {count > 1 && (
                  <Text style={[styles.reactionCount, { color: theme.colors.text.secondary }]}>
                    {count}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Failed indicator */}
        {message.failed && (
          <Pressable onPress={() => onRetry?.(message)} style={styles.failedRow}>
            <AlertCircle size={14} color={theme.colors.danger} />
            <Text style={[styles.failedText, { color: theme.colors.danger }]}>
              Failed · tap to retry
            </Text>
            <RefreshCw size={14} color={theme.colors.danger} />
          </Pressable>
        )}

        {/* Pending indicator */}
        {message.pending && (
          <Text style={[styles.pending, { color: isMine ? 'rgba(255,255,255,0.5)' : theme.colors.text.tertiary }]}>
            Sending…
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  avatarSlot: { width: 32, marginRight: 6, justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%' },
  bubbleMine: { alignItems: 'flex-end' },
  bubbleTheirs: { alignItems: 'flex-start' },
  senderName: { fontSize: 12, fontWeight: '600', marginBottom: 3, marginLeft: 4 },
  replyBlock: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(139,92,246,0.5)',
  },
  replyName: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  replyBody: { fontSize: 12 },
  bodyContainer: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
  },
  body: { fontSize: 15, lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  time: { fontSize: 10 },
  edited: { fontSize: 10 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionsMine: { justifyContent: 'flex-end' },
  reactionsTheirs: { justifyContent: 'flex-start' },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 2,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 12, fontWeight: '600' },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  failedText: { fontSize: 11 },
  pending: { fontSize: 10, marginTop: 2 },
});
