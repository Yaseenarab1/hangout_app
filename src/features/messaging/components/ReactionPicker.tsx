import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

type Props = {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function ReactionPicker({ visible, onSelect, onClose }: Props): React.ReactElement | null {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();

  if (!visible) return null;

  return (
    <>
      {/* Full-screen tap-away backdrop */}
      <Pressable
        onPress={onClose}
        style={[StyleSheet.absoluteFillObject, { zIndex: 9998 }]}
      />
      {/* Emoji row — absolutely centered, NOT inside a Modal */}
      <View
        pointerEvents="box-none"
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
            zIndex: 9999,
            top: height / 2 - 30,
            left: width / 2 - 120,
          },
        ]}
      >
        {EMOJIS.map((emoji) => (
          <Text
            key={emoji}
            onPress={() => { onSelect(emoji); onClose(); }}
            style={styles.emoji}
            allowFontScaling={false}
            suppressHighlighting
          >
            {emoji}
          </Text>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    flexDirection: 'row',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  emoji: { fontSize: 28, padding: 6 },
});
