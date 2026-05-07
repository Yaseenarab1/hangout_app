import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const DEFAULT_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

type Props = {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function ReactionPicker({ visible, onSelect, onClose }: Props): React.ReactElement {
  const theme = useTheme();

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
          {DEFAULT_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => {
                onSelect(emoji);
                onClose();
              }}
              style={({ pressed }) => [styles.emojiBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    flexDirection: 'row',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  emojiBtn: { padding: 6 },
  emoji: { fontSize: 26, fontFamily: undefined },
});
