import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Users, MessageCircle, Calendar, User } from 'lucide-react-native';
import { Platform } from 'react-native';
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
          fontWeight: '500',
        },
        tabBarStyle: {
          backgroundColor: theme.colors.bg.canvas,
          borderTopColor: theme.colors.border.default,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingTop: 6,
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
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} strokeWidth={1.5} />,
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
        name="find-time"
        options={{
          title: 'Find Time',
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size} strokeWidth={1.5} />
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
    </Tabs>
  );
}
