import React, { createContext, useContext } from 'react';

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

const singleOwnerUser: User = {
  id: 'single-owner',
  email: 'owner@hostelhub.com',
  name: 'Amil Dev',
  role: 'OWNER',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const login = async () => {
    return;
  };

  const logout = async () => {
    return;
  };

  return (
    <AuthContext.Provider
      value={{
        user: singleOwnerUser,
        isAuthenticated: true,
        isLoading: false,
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
