import React from 'react';
import { Tabs } from 'expo-router';
import { Home, CalendarCheck, MessageCircle, User } from 'lucide-react-native';
import { Platform, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

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
