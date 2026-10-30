import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { colors } from '../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={icon} color={color} size={size} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ ...tab('Inicio', 'home-outline'), headerTitle: 'Bartender Lab' }}
      />
      <Tabs.Screen name="explorar" options={tab('Explorar', 'wine-outline')} />
      <Tabs.Screen name="buscar" options={tab('Buscar', 'search-outline')} />
      <Tabs.Screen name="mi-barra" options={tab('Mi barra', 'beaker-outline')} />
      <Tabs.Screen name="mas" options={tab('Más', 'menu-outline')} />
    </Tabs>
  );
}
