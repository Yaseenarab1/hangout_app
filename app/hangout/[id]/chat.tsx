import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ArrowDown } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useMessages,
  useSendMessage,
  useReactToMessage,
  useUpdateReadState,
  MessageBubble,
  MessageComposer,
  MessageActionSheet,
  ReactionPicker,
  DateSeparator,
} from '@/features/messaging';
import { softDeleteMessage } from '@/features/messaging/services/messages.service';
import { messagesKey } from '@/features/messaging/hooks/useMessages';
import { unreadCountKey } from '@/features/messaging/hooks/useUnreadCount';
import { EmptyState } from '@/components/ui';
import { MessageCircle } from 'lucide-react-native';
import type { Message } from '@/features/messaging';

// How far from bottom before we show the "scroll down" FAB
const SCROLL_THRESHOLD = 200;

type ListItem =
  | { type: 'message'; message: Message; showHeader: boolean }
  | { type: 'date'; date: Date; key: string };

function buildListItems(messages: Message[]): ListItem[] {
  const items: ListItem[] = [];
  // messages arrive oldest→newest; FlatList is inverted so we reverse for display
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const prev = messages[i - 1];

    const showSep =
      !prev ||
      new Date(msg.created_at).toDateString() !==
        new Date(prev.created_at).toDateString();

    if (showSep) {
      items.push({
        type: 'date',
        date: new Date(msg.created_at),
        key: `sep-${msg.created_at}`,
      });
    }

    const sameGroup =
      prev &&
      prev.sender_id === msg.sender_id &&
      !showSep &&
      new Date(msg.created_at).getTime() -
        new Date(prev.created_at).getTime() <
        2 * 60 * 1000;

    items.push({ type: 'message', message: msg, showHeader: !sameGroup });
  }
  return items;
}

export default function ChatScreen(): React.ReactElement {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hangoutId = id ?? '';
  const { user } = useSession();
  const qc = useQueryClient();

  const { messages, isLoading, isError, fetchOlder, hasOlder, isFetchingOlder } =
    useMessages(hangoutId);
  const sendMessage = useSendMessage();
  const reactTo = useReactToMessage(hangoutId);
  const updateReadState = useUpdateReadState(hangoutId);

  const listRef = useRef<FlatList>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  // Action sheet state
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);

  // Reply state
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const listItems = buildListItems(messages);
  // Inverted list: reverse so newest is at index 0
  const invertedItems = [...listItems].reverse();

  // Mark read when screen is focused and we have messages
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (latest) {
      updateReadState.mutate(latest.id);
      qc.invalidateQueries({ queryKey: unreadCountKey(hangoutId) });
    }
  }, [messages.length, hangoutId]);

  // Track new messages while not near bottom
  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevCountRef.current && !isNearBottom) {
      setNewCount((c) => c + (messages.length - prevCountRef.current));
    } else if (isNearBottom) {
      setNewCount(0);
    }
    prevCountRef.current = messages.length;
  }, [messages.length, isNearBottom]);

  const handleSend = (body: string, replyToMessageId?: string) => {
    sendMessage.mutate({ hangoutId, body, replyToMessageId, replyToMessage: replyTo ?? undefined });
    if (isNearBottom) {
      setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
    }
  };

  const handleRetry = (msg: Message) => {
    // Remove failed optimistic, resend
    qc.setQueryData<any>(messagesKey(hangoutId), (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p: Message[]) => p.filter((m) => m.id !== msg.id)),
      };
    });
    sendMessage.mutate({ hangoutId, body: msg.body, replyToMessageId: msg.reply_to_message_id ?? undefined });
  };

  const handleDelete = useCallback(
    async (messageId: string) => {
      await softDeleteMessage(messageId);
      qc.invalidateQueries({ queryKey: messagesKey(hangoutId) });
    },
    [hangoutId, qc],
  );

  const scrollToBottom = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewCount(0);
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'date') {
      return <DateSeparator date={item.date} />;
    }
    return (
      <MessageBubble
        message={item.message}
        isMine={item.message.sender_id === user?.id}
        showHeader={item.showHeader}
        onLongPress={(msg) => setActionMessage(msg)}
        onRetry={handleRetry}
        onPressReply={(msg) => setReplyTo(msg)}
      />
    );
  };

  const handleOpenReaction = (messageId: string) => {
    setReactionTargetId(messageId);
    setShowReactionPicker(true);
  };

  const handleSelectReaction = (emoji: string) => {
    if (!reactionTargetId) return;
    const msg = messages.find((m) => m.id === reactionTargetId);
    const hasReacted = (msg?.reactions ?? []).some(
      (r) => r.user_id === user?.id && r.emoji === emoji,
    );
    reactTo.mutate({ messageId: reactionTargetId, emoji, hasReacted });
  };

  return (
    <Screen header={{ title: 'Chat', showBack: true }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Message list */}
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : isError ? (
            <View style={styles.center}>
              <Text style={{ color: theme.colors.text.secondary }}>
                Couldn't load messages. Pull to refresh.
              </Text>
            </View>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<MessageCircle size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />}
              title="Say hi to the group"
              body="You're the first one here. Send a message!"
            />
          ) : (
            <FlatList
              ref={listRef}
              data={invertedItems}
              keyExtractor={(item) =>
                item.type === 'date' ? item.key : item.message.id
              }
              renderItem={renderItem}
              inverted
              contentContainerStyle={styles.list}
              onEndReached={() => hasOlder && fetchOlder()}
              onEndReachedThreshold={0.3}
              onScroll={(e) => {
                const offset = e.nativeEvent.contentOffset.y;
                setIsNearBottom(offset < SCROLL_THRESHOLD);
              }}
              scrollEventThrottle={100}
              ListFooterComponent={
                isFetchingOlder ? (
                  <ActivityIndicator
                    style={{ paddingVertical: 16 }}
                    color={theme.colors.accent}
                  />
                ) : null
              }
            />
          )}

          {/* Scroll-to-bottom FAB */}
          {!isNearBottom && (
            <Pressable
              onPress={scrollToBottom}
              style={[styles.fab, { backgroundColor: theme.colors.accent }]}
            >
              <ArrowDown size={18} color="#FFFFFF" />
              {newCount > 0 && (
                <Text style={styles.fabCount}>
                  {newCount > 99 ? '99+' : newCount} new
                </Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Composer */}
        <MessageComposer
          onSend={handleSend}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          disabled={sendMessage.isPending && !messages.some((m) => m.pending)}
        />
      </KeyboardAvoidingView>

      {/* Long-press action sheet */}
      <MessageActionSheet
        visible={!!actionMessage}
        message={actionMessage}
        isMine={actionMessage?.sender_id === user?.id}
        onClose={() => setActionMessage(null)}
        onReply={(msg) => {
          setReplyTo(msg);
          setActionMessage(null);
        }}
        onDelete={handleDelete}
        onReact={(msgId) => {
          setActionMessage(null);
          handleOpenReaction(msgId);
        }}
      />

      {/* Emoji picker */}
      <ReactionPicker
        visible={showReactionPicker}
        onSelect={handleSelectReaction}
        onClose={() => {
          setShowReactionPicker(false);
          setReactionTargetId(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabCount: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
