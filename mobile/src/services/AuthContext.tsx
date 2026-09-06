import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { isSupabaseProvider, supabase } from './supabaseApi';

interface User { id: string; email: string; name: string; role: string }
interface AuthContextType {
  user: User | null;
  loading: boolean;
  usesSupabase: boolean;
  sendLoginLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const singleOwnerUser: User = { id: 'single-owner', email: 'owner@hostelhub.com', name: 'Amil Dev', role: 'OWNER' };
const AUTH_CALLBACK_URL = 'https://amildev8547.github.io/Hostel-Management-Application/auth-callback.html';

function sessionUser(session: any): User | null {
  if (!session?.user?.email) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.email.split('@')[0], role: 'OWNER' };
}

async function consumeAuthLink(url: string) {
  const normalized = url.replace('#', '?');
  const params = new URL(normalized).searchParams;
  const accessToken = params.get('access_token'); const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(isSupabaseProvider ? null : singleOwnerUser);
  const [loading, setLoading] = useState(isSupabaseProvider);

  useEffect(() => {
    if (!isSupabaseProvider) return;
    supabase.auth.getSession().then(({ data }) => { setUser(sessionUser(data.session)); setLoading(false); });
    Linking.getInitialURL().then((url) => { if (url) return consumeAuthLink(url); });
    const linkSubscription = Linking.addEventListener('url', ({ url }) => consumeAuthLink(url));
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => { setUser(sessionUser(session)); setLoading(false); });
    return () => { linkSubscription.remove(); authSubscription.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user, loading, usesSupabase: isSupabaseProvider,
    sendLoginLink: async (email) => {
      const returnTo = Linking.createURL('auth/callback');
      const emailRedirectTo = `${AUTH_CALLBACK_URL}?returnTo=${encodeURIComponent(returnTo)}`;
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo } });
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
