import React, { createContext, useState, useEffect, useContext } from 'react';
import apiClient, { setupResponseInterceptor } from './api';
import * as storage from './storage';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Setup auto-logout on API 401
  useEffect(() => {
    setupResponseInterceptor(() => {
      setUserState(null);
    });
  }, []);

  // Auto-login check
  useEffect(() => {
    async function loadStoredSession() {
      try {
        const storedToken = await storage.getToken();
        const storedUser = await storage.getUser();

        if (storedToken && storedUser) {
          setUserState(storedUser);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, user: loggedUser } = response.data;

      await storage.setToken(token);
      await storage.setUser(loggedUser);
      setUserState(loggedUser);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Authentication failed';
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await storage.clearSession();
      setUserState(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
