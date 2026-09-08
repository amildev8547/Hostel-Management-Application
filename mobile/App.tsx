import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as NativeSplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/services/AuthContext';
import AppNavigator from './src/navigation';
import { theme } from './src/theme';
import AppSplashScreen from './src/components/AppSplashScreen';

// Keep the native launch surface visible until the designed React splash is
// ready, avoiding a white frame between the two screens.
NativeSplashScreen.preventAutoHideAsync().catch(() => undefined);

// Initialize TanStack React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => NativeSplashScreen.hide());
    return () => cancelAnimationFrame(frame);
  }, []);

  if (showSplash) {
    return (
      <SafeAreaProvider>
        <AppSplashScreen onFinish={finishSplash} />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <AppNavigator />
            <StatusBar style="dark" />
          </AuthProvider>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
