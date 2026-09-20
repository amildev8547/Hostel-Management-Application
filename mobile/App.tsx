import React, { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NativeSplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      staleTime: 15000,
      gcTime: 5 * 60 * 1000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Keep live data reasonably fresh without repeatedly animating or interrupting
      // navigation. Visible refresh indicators are reserved for pull-to-refresh.
      refetchInterval: 60000,
      refetchIntervalInBackground: false,
    },
  },
});

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    const onAppStateChange = (status: AppStateStatus) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
      if (status === 'active') void queryClient.refetchQueries({ type: 'active' });
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => NativeSplashScreen.hide());
    return () => cancelAnimationFrame(frame);
  }, []);

  if (showSplash) {
    return (
      <>
        <AppSplashScreen onFinish={finishSplash} prepareApp={prepareSession} />
        <StatusBar style="dark" />
      </>
    );
  }

  return <><AppNavigator /><StatusBar style="dark" /></>;
}

const prepareSession = async () => undefined;

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
