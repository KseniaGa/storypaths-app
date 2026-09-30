import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { PersistenceNotice } from '@/components/persistence-notice';
import { BrowserStorageGate } from '@/components/browser-storage-gate';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PersistenceNotice />
      <BrowserStorageGate>
      <Stack screenOptions={{ headerShown: Platform.OS !== 'web' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      </BrowserStorageGate>
      <StatusBar style="auto" />
    </ThemeProvider>
  </GestureHandlerRootView>
);
}
