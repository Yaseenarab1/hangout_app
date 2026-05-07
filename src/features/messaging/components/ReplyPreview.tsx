import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import type { Message } from '../types';

type Props = {
  message: Pick<Message, 'id' | 'body' | 'deleted_at' | 'sender'>;
  onCancel: () => void;
};

export function ReplyPreview({ message, onCancel }: Props): React.ReactElement {
  const theme = useTheme();
  const body = message.deleted_at ? 'Original message deleted' : message.body;
  const senderName = (message.sender as any)?.display_name ?? 'Someone';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg.subtle,
          borderLeftColor: theme.colors.accent,
          borderTopColor: theme.colors.border.default,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: theme.colors.accent }]}>{senderName}</Text>
        <Text
          style={[styles.body, { color: theme.colors.text.secondary }]}
          numberOfLines={1}
        >
          {body}
        </Text>
      </View>
      <Pressable onPress={onCancel} hitSlop={8}>
        <X size={16} color={theme.colors.text.tertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  name: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  body: { fontSize: 13 },
});
