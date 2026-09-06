import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseProvider, supabase } from './supabaseApi';

interface User { id: string; email: string; name: string; role: string }
interface AuthContextType {
  user: User | null;
  loading: boolean;
  usesSupabase: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordSetup: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const singleOwnerUser: User = { id: 'single-owner', email: 'owner@hostelhub.com', name: 'Amil Dev', role: 'OWNER' };

function sessionUser(session: any): User | null {
  if (!session?.user?.email) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.email.split('@')[0], role: 'OWNER' };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(isSupabaseProvider ? null : singleOwnerUser);
  const [loading, setLoading] = useState(isSupabaseProvider);

  useEffect(() => {
    if (!isSupabaseProvider) return;
    supabase.auth.getSession().then(({ data }) => { setUser(sessionUser(data.session)); setLoading(false); });
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => { setUser(sessionUser(session)); setLoading(false); });
    return () => { authSubscription.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user, loading, usesSupabase: isSupabaseProvider,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
    },
    sendPasswordSetup: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: 'https://amildev8547.github.io/Hostel-Management-Application/auth-callback.html',
      });
      if (error) throw error;
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    signOut: async () => { if (isSupabaseProvider) await supabase.auth.signOut(); },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
