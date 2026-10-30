import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClientProvider } from '../src/client-context';
import { colors } from '../src/theme';
import { SyncProvider } from '../src/sync-context';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Queries read the local database: they must run offline and never retry.
        defaultOptions: { queries: { networkMode: 'always', retry: false, staleTime: Infinity } },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ClientProvider>
          <SyncProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '700' },
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="receta/[id]" options={{ title: 'Receta' }} />
              <Stack.Screen
                name="preparar/[id]"
                options={{ headerShown: false, presentation: 'fullScreenModal' }}
              />
              <Stack.Screen name="tecnicas/index" options={{ title: 'Escuela de técnicas' }} />
              <Stack.Screen name="tecnicas/[id]" options={{ title: 'Técnica' }} />
              <Stack.Screen name="favoritos" options={{ title: 'Favoritos' }} />
              <Stack.Screen name="compras/index" options={{ title: 'Listas de compras' }} />
              <Stack.Screen name="compras/[id]" options={{ title: 'Lista de compras' }} />
              <Stack.Screen
                name="ingredientes"
                options={{ title: 'Elegir ingrediente', presentation: 'modal' }}
              />
              <Stack.Screen name="descargas" options={{ title: 'Descargas offline' }} />
              <Stack.Screen name="configuracion" options={{ title: 'Configuración' }} />
            </Stack>
          </SyncProvider>
        </ClientProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
