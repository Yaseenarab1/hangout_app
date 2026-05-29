import React, { useState, useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import {
  Home,
  CalendarCheck,
  MessageCircle,
  User,
  Plus,
  Camera,
  Receipt,
  Compass,
  UtensilsCrossed,
  CalendarPlus,
} from 'lucide-react-native';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInUp,
  FadeOutDown,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

type FabAction = {
  key: string;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
};

function CreateTabButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

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

  const actions: FabAction[] = [
    {
      key: 'post',
      icon: <Camera size={20} color={theme.colors.accent} />,
      label: 'New post',
      onPress: () => { setOpen(false); router.push('/post/new'); },
    },
    {
      key: 'bill',
      icon: <Receipt size={20} color={theme.colors.accent} />,
      label: 'Split a bill',
      onPress: () => { setOpen(false); router.push('/bill/new'); },
    },
    {
      key: 'activity',
      icon: <Compass size={20} color={theme.colors.accent} />,
      label: 'What to do?',
      onPress: () => { setOpen(false); router.push('/hangout/new-activity'); },
    },
    {
      key: 'food',
      icon: <UtensilsCrossed size={20} color={theme.colors.accent} />,
      label: 'Where to eat?',
      onPress: () => { setOpen(false); router.push('/hangout/new-food'); },
    },
    {
      key: 'hangout',
      icon: <CalendarPlus size={20} color={theme.colors.accent} />,
      label: 'Plan a hangout',
      onPress: () => { setOpen(false); router.push('/hangout/new'); },
    },
  ];

  return (
    <>
      {/* Action sheet modal */}
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.actionsContainer, { bottom: insets.bottom + 92 }]}>
          {actions.map((action, index) => (
            <Animated.View
              key={action.key}
              entering={FadeInUp.delay(index * 55).springify().damping(20).stiffness(320)}
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

      {/* Center + pill */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel={open ? 'Close menu' : 'Quick actions'}
        accessibilityRole="button"
      >
        <View
          style={[
            styles.centerBtn,
            { marginBottom: Platform.OS === 'ios' ? 6 : 0 },
          ]}
        >
          <Animated.View style={iconRotateStyle}>
            <Plus size={24} color="#fff" strokeWidth={2.5} />
          </Animated.View>
        </View>
      </Pressable>
    </>
  );
}

export default function TabsLayout(): React.ReactElement {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.bg.canvas,
          borderTopColor: theme.colors.border.default,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="hangouts"
        options={{
          title: 'Hangouts',
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => <CreateTabButton />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen name="friends" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="find-time" options={{ href: null }} />
    </Tabs>
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
  centerBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.38,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
});
