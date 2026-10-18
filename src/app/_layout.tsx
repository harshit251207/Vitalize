import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Platform, ToastAndroid } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { useAutoBpSync } from '@/hooks/use-auto-bp-sync';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const showAutoBpSyncError = useCallback((message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    }
  }, []);
  useAutoBpSync({
    uid: user,
    syncOnAppActive: true,
    onSyncError: showAutoBpSyncError,
  });
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to tabs if authenticated and in auth group
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments, router]);

  return (
    <ThemeProvider value={DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="vitals-entry" options={{ presentation: 'modal' }} />
        <Stack.Screen name="vitals-history" options={{ presentation: 'card' }} />
        <Stack.Screen name="bp-analytics" options={{ presentation: 'card' }} />
        <Stack.Screen name="rep-counter" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="report-upload" options={{ presentation: 'modal' }} />
        <Stack.Screen name="emergency-contacts" options={{ presentation: 'modal' }} />
        <Stack.Screen name="chat" options={{ presentation: 'card' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
