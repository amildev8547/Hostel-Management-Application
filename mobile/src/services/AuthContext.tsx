import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import apiClient, { setSessionExpiredHandler } from './api';
import { clearSession, getRefreshToken, getUser, setSession, setUser } from './storage';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'HOSTEL_ADMIN';
  status: string;
  mustChangePassword: boolean;
  organization: { id: string; name: string; status: string; plan: string } | null;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const removeLocalSession = useCallback(async () => {
    await clearSession();
    queryClient.clear();
    setCurrentUser(null);
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(() => { void removeLocalSession(); });
    return () => setSessionExpiredHandler(null);
  }, [removeLocalSession]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          const savedUser = await getUser();
          if (savedUser) await clearSession();
          return;
        }
        const response = await apiClient.post('/auth/refresh', { refreshToken, platform: Platform.OS });
        await setSession(response.data.accessToken, response.data.refreshToken, response.data.user);
        if (active) setCurrentUser(response.data.user);
      } catch {
        await clearSession();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
      platform: Platform.OS,
      deviceName: Platform.OS === 'web' ? 'Web browser' : 'Mobile app',
    });
    await setSession(response.data.accessToken, response.data.refreshToken, response.data.user);
    queryClient.clear();
    setCurrentUser(response.data.user);
    return response.data.user as AuthUser;
  }, [queryClient]);

  const logout = useCallback(async () => {
    try { await apiClient.post('/auth/logout'); } catch { /* Local logout must always work. */ }
    await removeLocalSession();
  }, [removeLocalSession]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
    if (user) {
      const updated = { ...user, mustChangePassword: false };
      await setUser(updated);
      setCurrentUser(updated);
    }
  }, [user]);

  const updateUser = useCallback(async (nextUser: AuthUser) => {
    await setUser(nextUser);
    setCurrentUser(nextUser);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, changePassword, updateUser }),
    [user, isLoading, login, logout, changePassword, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
