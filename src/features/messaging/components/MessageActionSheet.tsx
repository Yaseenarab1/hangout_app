import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Copy, Reply, Trash2, Flag } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/hooks/useTheme';
import { toast } from '@/stores/ui.store';
import type { Message } from '../types';

type Props = {
  visible: boolean;
  message: Message | null;
  isMine: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string) => void;
};

export function MessageActionSheet({
  visible,
  message,
  isMine,
  onClose,
  onReply,
  onDelete,
  onReact,
}: Props): React.ReactElement {
  const theme = useTheme();

  if (!message) return <></>;

  const actions = [
    {
      icon: <Reply size={18} color={theme.colors.text.primary} />,
      label: 'Reply',
      onPress: () => {
        onReply(message);
        onClose();
      },
    },
    {
      icon: <Copy size={18} color={theme.colors.text.primary} />,
      label: 'Copy',
      onPress: async () => {
        await Clipboard.setStringAsync(message.body);
        toast.success('Copied');
        onClose();
      },
    },
    ...(isMine
      ? [
          {
            icon: <Trash2 size={18} color={theme.colors.danger} />,
            label: 'Delete',
            destructive: true,
            onPress: () => {
              onClose();
              Alert.alert(
                'Delete message?',
                'This will show "Message deleted" for everyone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => onDelete(message.id),
                  },
                ],
              );
            },
          },
        ]
      : [
          {
            icon: <Flag size={18} color={theme.colors.text.secondary} />,
            label: 'Report',
            onPress: () => {
              toast.info("Reported. We'll review it.");
              onClose();
            },
          },
        ]),
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          {/* Reaction row */}
          <Pressable
            style={[styles.reactRow, { borderBottomColor: theme.colors.border.default }]}
            onPress={() => {
              onReact(message.id);
              onClose();
            }}
          >
            {['❤️', '😂', '😮', '😢', '👍', '🔥'].map((e) => (
              <Text key={e} style={styles.emoji}>{e}</Text>
            ))}
          </Pressable>

          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.colors.border.default },
                pressed && { opacity: 0.6 },
              ]}
            >
              {action.icon}
              <Text
                style={[
                  styles.label,
                  {
                    color: action.destructive
                      ? theme.colors.danger
                      : theme.colors.text.primary,
                  },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  reactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emoji: { fontSize: 26 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 15 },
});
