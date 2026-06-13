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
import { ArrowDown, MessageCircle } from 'lucide-react-native';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/features/auth';
import { useQueryClient } from '@tanstack/react-query';
import {
  MessageBubble,
  MessageComposer,
  MessageActionSheet,
  ReactionPicker,
  DateSeparator,
} from '@/features/messaging';
import type { Message } from '@/features/messaging';
import { useConvMessages, useSendConvMessage, convMessagesKey } from '@/features/conversations';
import {
  softDeleteConvMessage,
  updateConvLastRead,
} from '@/features/conversations/services/conversations.service';
import type { ConvMessage } from '@/features/conversations';

const SCROLL_THRESHOLD = 200;

// Bridge ConvMessage → Message shape so we can reuse MessageBubble/ActionSheet
function bridgeMessage(m: ConvMessage): Message {
  return {
    id: m.id,
    hangout_id: m.conversation_id,
    sender_id: m.sender_id,
    body: m.body,
    reply_to_message_id: m.reply_to_id,
    reply_to: m.reply_to
      ? {
          id: m.reply_to.id,
          body: m.reply_to.body,
          deleted_at: m.reply_to.deleted_at,
          sender: m.reply_to.sender,
        }
      : undefined,
    edited_at: m.edited_at,
    deleted_at: m.deleted_at,
    created_at: m.created_at,
    sender: m.sender,
    reactions: [],
    pending: m.pending,
    failed: m.failed,
  };
}

type ListItem =
  | { type: 'message'; message: ConvMessage; showHeader: boolean }
  | { type: 'date'; date: Date; key: string };

function buildListItems(messages: ConvMessage[]): ListItem[] {
  const items: ListItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const prev = messages[i - 1];

    const showSep =
      !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();

    if (showSep) {
      items.push({ type: 'date', date: new Date(msg.created_at), key: `sep-${msg.created_at}` });
    }

    const sameGroup =
      prev &&
      prev.sender_id === msg.sender_id &&
      !showSep &&
      new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 2 * 60 * 1000;

    items.push({ type: 'message', message: msg, showHeader: !sameGroup });
  }
  return items;
}

export default function ConversationScreen(): React.ReactElement {
  const theme = useTheme();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const convId = id ?? '';
  const { user } = useSession();
  const qc = useQueryClient();

  const { messages, isLoading, isError, fetchOlder, hasOlder, isFetchingOlder } =
    useConvMessages(convId);
  const sendMsg = useSendConvMessage();

  const listRef = useRef<FlatList>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ConvMessage | null>(null);

  const listItems = buildListItems(messages);
  const invertedItems = [...listItems].reverse();

  // Mark read on focus
  useEffect(() => {
    if (messages.length > 0) {
      updateConvLastRead(convId).catch(() => undefined);
    }
  }, [messages.length, convId]);

  // Track new messages while scrolled up
  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevCountRef.current && !isNearBottom) {
      setNewCount((c) => c + (messages.length - prevCountRef.current));
    } else if (isNearBottom) {
      setNewCount(0);
    }
    prevCountRef.current = messages.length;
  }, [messages.length, isNearBottom]);

  const handleSend = (body: string, replyToId?: string) => {
    sendMsg.mutate({ convId, body, replyToId, replyToMessage: replyTo ?? undefined });
    setReplyTo(null);
    if (isNearBottom) {
      setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
    }
  };

  const handleRetry = (bridged: Message) => {
    qc.setQueryData<any>(convMessagesKey(convId), (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p: ConvMessage[]) => p.filter((m) => m.id !== bridged.id)),
      };
    });
    sendMsg.mutate({ convId, body: bridged.body });
  };

  const handleDelete = useCallback(
    async (messageId: string) => {
      await softDeleteConvMessage(messageId);
      qc.invalidateQueries({ queryKey: convMessagesKey(convId) });
    },
    [convId, qc],
  );

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'date') return <DateSeparator date={item.date} />;
    const bridged = bridgeMessage(item.message);
    return (
      <MessageBubble
        message={bridged}
        isMine={item.message.sender_id === user?.id}
        showHeader={item.showHeader}
        onLongPress={(msg) => setActionMessage(msg)}
        onRetry={handleRetry}
        onPressReply={(msg) => {
          const orig = messages.find((m) => m.id === msg.id);
          if (orig) setReplyTo(orig);
        }}
      />
    );
  };

  return (
    <Screen
      header={{ title: title ?? 'Chat', showBack: true }}
      contentPadding={0}
      avoidKeyboard={false}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : isError ? (
            <View style={styles.center}>
              <Text style={{ color: theme.colors.text.secondary }}>Couldn't load messages.</Text>
            </View>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={
                <MessageCircle size={42} color={theme.colors.text.tertiary} strokeWidth={1.5} />
              }
              title="Start the conversation"
              body="Say something!"
            />
          ) : (
            <FlatList
              ref={listRef}
              data={invertedItems}
              keyExtractor={(item) => (item.type === 'date' ? item.key : item.message.id)}
              renderItem={renderItem}
              inverted
              contentContainerStyle={styles.list}
              onEndReached={() => hasOlder && fetchOlder()}
              onEndReachedThreshold={0.3}
              onScroll={(e) => {
                setIsNearBottom(e.nativeEvent.contentOffset.y < SCROLL_THRESHOLD);
              }}
              scrollEventThrottle={100}
              ListFooterComponent={
                isFetchingOlder ? (
                  <ActivityIndicator style={{ paddingVertical: 16 }} color={theme.colors.accent} />
                ) : null
              }
            />
          )}

          {!isNearBottom && (
            <Pressable
              onPress={() => {
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
                setNewCount(0);
              }}
              style={[styles.fab, { backgroundColor: theme.colors.accent }]}
            >
              <ArrowDown size={18} color="#FFFFFF" />
              {newCount > 0 && (
                <Text style={styles.fabCount}>{newCount > 99 ? '99+' : newCount} new</Text>
              )}
            </Pressable>
          )}
        </View>

        <MessageComposer
          onSend={(body, replyToId) => handleSend(body, replyToId)}
          replyTo={replyTo ? bridgeMessage(replyTo) : null}
          onCancelReply={() => setReplyTo(null)}
          disabled={sendMsg.isPending && !messages.some((m) => m.pending)}
        />
      </KeyboardAvoidingView>

      <MessageActionSheet
        visible={!!actionMessage}
        message={actionMessage}
        isMine={actionMessage?.sender_id === user?.id}
        onClose={() => setActionMessage(null)}
        onReply={(msg) => {
          const orig = messages.find((m) => m.id === msg.id);
          if (orig) setReplyTo(orig);
          setActionMessage(null);
        }}
        onDelete={handleDelete}
        onReact={(msgId) => {
          setActionMessage(null);
          setReactionTargetId(msgId);
          setShowReactionPicker(true);
        }}
      />

      <ReactionPicker
        visible={showReactionPicker}
        onSelect={() => {
          // Reactions not wired for conv messages yet — close picker
        }}
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
