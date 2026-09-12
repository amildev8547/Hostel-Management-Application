import React, { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NativeSplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/services/AuthContext';
import apiClient from './src/services/api';
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

async function prepareInitialDashboard(signal: AbortSignal) {
  const now = new Date();
  const initialRequests = await Promise.allSettled([
    apiClient.get('/dashboard', { params: { month: now.getMonth() + 1, year: now.getFullYear() }, signal }),
    apiClient.get('/branches', { signal }),
    apiClient.get('/admissions', { params: { status: 'PENDING' }, signal }),
    apiClient.get('/tenants', { params: { status: 'ACTIVE' }, signal }),
    apiClient.get('/payments', { params: { paymentType: 'RENT', month: now.getMonth() + 1, year: now.getFullYear() }, signal }),
  ]);

  const cacheKeys = [
    ['dashboardMetrics', now.getMonth(), now.getFullYear()],
    ['branchesList', ''],
    ['admissionsList', '', 'PENDING'],
    ['tenantsList', '', 'ACTIVE'],
    ['allPaymentsSummary', undefined, now.getMonth(), now.getFullYear()],
  ];
  initialRequests.forEach((result, index) => {
    if (result.status === 'fulfilled') queryClient.setQueryData(cacheKeys[index], result.value.data);
  });

  const branchResult = initialRequests[1];
  if (branchResult.status === 'fulfilled') {
    const branches = (branchResult.value.data || []).slice(0, 10);
    const branchRequests = await Promise.allSettled(
      branches.flatMap((branch: any) => [
        apiClient.get(`/branches/${branch.id}/dashboard`, { signal }),
        apiClient.get('/rooms', { params: { branchId: branch.id }, signal }),
      ]),
    );
    branchRequests.forEach((result, index) => {
      if (result.status !== 'fulfilled') return;
      const branch = branches[Math.floor(index / 2)];
      queryClient.setQueryData(index % 2 === 0 ? ['branchDashboard', branch.id] : ['branchRooms', branch.id], result.value.data);
    });
  }
}

export default function App() {
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
      <SafeAreaProvider>
        <AppSplashScreen onFinish={finishSplash} prepareApp={prepareInitialDashboard} />
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
