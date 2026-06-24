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

function getLoginErrorMessage(error: any): string {
  const data = error.response?.data;

  if (Array.isArray(data?.details) && data.details.length > 0) {
    return data.details.map((d: { message: string }) => d.message).join('\n');
  }
  if (data?.error) {
    return data.error;
  }
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. The server may be waking up after inactivity — please try again in a moment.';
  }
  if (!error.response) {
    return 'Could not reach the server. Please check your internet connection and try again.';
  }
  return 'Authentication failed. Please try again.';
}

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
      throw new Error(getLoginErrorMessage(error));
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
