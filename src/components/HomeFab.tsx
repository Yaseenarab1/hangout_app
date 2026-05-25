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
  FadeInUp,
  FadeOutDown,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Plus, Receipt, Compass, UtensilsCrossed, CalendarPlus, Camera } from 'lucide-react-native';
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

  // FAB visibility (scale + opacity)
  const fabScale = useSharedValue(1);
  const fabOpacity = useSharedValue(1);
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
    opacity: fabOpacity.value,
  }));

  // Plus icon rotation: 0° closed → 45° open (morphs to X)
  const rotation = useSharedValue(0);
  const iconRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  useEffect(() => {
    rotation.value = withTiming(open ? 45 : 0, {
      duration: 220,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    });
  }, [open]);

  useEffect(() => {
    if (open) {
      fabScale.value = withSpring(1, { damping: 15, stiffness: 350 });
      fabOpacity.value = withTiming(1, { duration: 120 });
      return;
    }
    if (visible) {
      fabScale.value = withSpring(1, { damping: 15, stiffness: 350 });
      fabOpacity.value = withTiming(1, { duration: 120 });
    } else {
      fabScale.value = withTiming(0.7, { duration: 180 });
      fabOpacity.value = withTiming(0, { duration: 180 });
    }
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

        {/* Staggered action rows */}
        <View style={[styles.actionsContainer, { bottom: insets.bottom + 92 }]}>
          {actions.map((action, index) => (
            <Animated.View
              key={action.key}
              entering={FadeInUp.delay(index * 55)
                .springify()
                .damping(20)
                .stiffness(320)}
              exiting={FadeOutDown.duration(120)}
            >
              <Pressable
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.actionRow,
                  {
                    backgroundColor: theme.colors.bg.surface,
                    borderColor: theme.colors.border.default,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
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
            </Animated.View>
          ))}
        </View>
      </Modal>

      {/* FAB button */}
      <Animated.View style={[styles.fabWrap, { bottom: insets.bottom + 24 }, fabAnimStyle]}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          onPressIn={() => {
            fabScale.value = withTiming(0.92, { duration: 100, easing: Easing.out(Easing.cubic) });
          }}
          onPressOut={() => {
            fabScale.value = withSpring(1, { damping: 14, stiffness: 380 });
          }}
          style={[
            styles.fab,
            {
              backgroundColor: theme.colors.accent,
              shadowColor: theme.colors.accent,
            },
          ]}
          accessibilityLabel={open ? 'Close menu' : 'Quick actions'}
          accessibilityRole="button"
        >
          <Animated.View style={iconRotateStyle}>
            <Plus size={26} color="#fff" strokeWidth={2.5} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  actionsContainer: {
    position: 'absolute',
    right: 20,
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
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
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
