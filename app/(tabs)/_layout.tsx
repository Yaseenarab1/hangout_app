import React from 'react';
import { Tabs, router } from 'expo-router';
import { Home, CalendarCheck, MessageCircle, User, Plus } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

function CreateTabButton() {
  return (
    <Pressable
      onPress={() => router.push('/hangout/new')}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel="Plan a hangout"
      accessibilityRole="button"
    >
      <View
        style={{
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
          marginBottom: Platform.OS === 'ios' ? 6 : 0,
        }}
      >
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </View>
    </Pressable>
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
          // prevent system-applied gray overlays on both platforms
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
      {/* Friends is reachable from Profile tab — hidden from tab bar */}
      <Tabs.Screen name="friends" options={{ href: null }} />
      {/* Explore is reachable from hangout screens — hidden from tab bar for now */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      {/* Find Time is reachable from inside a hangout (When to meet card) — hidden from tab bar */}
      <Tabs.Screen name="find-time" options={{ href: null }} />
    </Tabs>
  );
}
