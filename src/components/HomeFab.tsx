import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Plus, X, Receipt, Compass, UtensilsCrossed, CalendarPlus, Camera } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

type FabAction = {
  key: string;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
};

export function HomeFab({ visible = true }: { visible?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const scale = useSharedValue(1);
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  useEffect(() => {
    if (open) {
      scale.value = withSpring(1, { damping: 15, stiffness: 350 });
      return;
    }
    scale.value = visible
      ? withSpring(1, { damping: 15, stiffness: 350 })
      : withTiming(0, { duration: 180 });
  }, [visible, open]);

  const actions: FabAction[] = [
    {
      key: 'post',
      icon: <Camera size={20} color={theme.colors.accent} />,
      label: 'New post',
      onPress: () => {
        setOpen(false);
        router.push('/post/new');
      },
    },
    {
      key: 'bill',
      icon: <Receipt size={20} color={theme.colors.accent} />,
      label: 'Split a bill',
      onPress: () => {
        setOpen(false);
        router.push('/bill/new');
      },
    },
    {
      key: 'activity',
      icon: <Compass size={20} color={theme.colors.accent} />,
      label: 'What to do?',
      onPress: () => {
        setOpen(false);
        router.push('/hangout/new-activity');
      },
    },
    {
      key: 'food',
      icon: <UtensilsCrossed size={20} color={theme.colors.accent} />,
      label: 'Where to eat?',
      onPress: () => {
        setOpen(false);
        router.push('/hangout/new-food');
      },
    },
    {
      key: 'hangout',
      icon: <CalendarPlus size={20} color={theme.colors.accent} />,
      label: 'Plan a hangout',
      onPress: () => {
        setOpen(false);
        router.push('/hangout/new');
      },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={[styles.actionsContainer, { bottom: insets.bottom + 90 }]}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionRow,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderColor: theme.colors.border.default,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: theme.colors.accentSubtle }]}>
                {action.icon}
              </View>
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.text.primary }]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* FAB button */}
      <Animated.View style={[styles.fabWrap, { bottom: insets.bottom + 24 }, fabAnimStyle]}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.colors.accent,
              shadowColor: '#000',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityLabel={open ? 'Close menu' : 'Quick actions'}
          accessibilityRole="button"
        >
          {open ? (
            <X size={24} color="#fff" />
          ) : (
            <Plus size={24} color="#fff" />
          )}
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionsContainer: {
    position: 'absolute',
    right: 20,
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
