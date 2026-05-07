import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { ReplyPreview } from './ReplyPreview';
import type { Message } from '../types';

const MAX_CHARS = 4000;

type Props = {
  onSend: (body: string, replyToMessageId?: string) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  disabled?: boolean;
};

export function MessageComposer({
  onSend,
  replyTo,
  onCancelReply,
  disabled = false,
}: Props): React.ReactElement {
  const theme = useTheme();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const canSend = text.trim().length > 0 && text.length <= MAX_CHARS && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim(), replyTo?.id);
    setText('');
    onCancelReply();
  };

  return (
    <View style={[styles.wrapper, { borderTopColor: theme.colors.border.default }]}>
      {replyTo && (
        <ReplyPreview message={replyTo} onCancel={onCancelReply} />
      )}
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.bg.subtle,
              color: theme.colors.text.primary,
              borderColor: theme.colors.border.default,
            },
          ]}
          placeholder="Message…"
          placeholderTextColor={theme.colors.text.tertiary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_CHARS}
          returnKeyType="default"
          blurOnSubmit={false}
          editable={!disabled}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={[
            styles.sendBtn,
            { backgroundColor: canSend ? theme.colors.accent : theme.colors.bg.muted },
          ]}
        >
          <Send size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
