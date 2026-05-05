import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';

export type ReviewItem = {
  id: string;
  label: string;
  emoji?: string;
  subtitle?: string;
};

export type SelectionReviewSheetProps = {
  visible: boolean;
  onClose: () => void;
  items: ReviewItem[];
  min?: number;
  max?: number;
  onRemove: (id: string) => void;
  itemLabel?: string;
};

export function SelectionReviewSheet({
  visible,
  onClose,
  items,
  min,
  max,
  onRemove,
  itemLabel = 'options',
}: SelectionReviewSheetProps): React.ReactElement {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.bg.canvas }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text
              style={[theme.typography.h3, { color: theme.colors.text.primary }]}
            >
              Your {itemLabel}
            </Text>
            <Text
              style={[
                theme.typography.bodySmall,
                { color: theme.colors.text.tertiary, marginTop: 2 },
              ]}
            >
              {items.length} selected
              {max ? ` of ${max}` : ''}
              {min && items.length < min
                ? `  •  add ${min - items.length} more`
                : ''}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} color={theme.colors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: theme.colors.bg.subtle,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.text.tertiary, textAlign: 'center' },
                ]}
              >
                Nothing selected yet.{'\n'}Tap "Add more" to start.
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.itemRow,
                  {
                    backgroundColor: theme.colors.bg.surface,
                    borderColor: theme.colors.border.default,
                  },
                ]}
              >
                {item.emoji ? (
                  <Text style={{ fontSize: 22, marginRight: 12 }}>{item.emoji}</Text>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      theme.typography.body,
                      { color: theme.colors.text.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  {item.subtitle ? (
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: theme.colors.text.tertiary, marginTop: 2 },
                      ]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => onRemove(item.id)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.removeButton,
                    {
                      backgroundColor: theme.colors.bg.subtle,
                      borderColor: theme.colors.border.default,
                    },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <X size={18} color={theme.colors.text.secondary} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Add more"
            leadingIcon={<Plus size={16} color="#FFFFFF" />}
            onPress={onClose}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
});
