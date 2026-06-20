import type { MeResponse } from '@eventrahq/contracts';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient } from '../api/client.js';
import { getSupabase } from '../api/supabase.js';

interface AuthContextValue {
  session: Session | null; me: MeResponse | null; loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<boolean>;
  resetPassword(email: string): Promise<void>; signOut(): Promise<void>; refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(): Promise<void> {
    try { setMe(await apiClient.me()); } catch { setMe(null); }
  }

  useEffect(() => {
    const supabase = getSupabase();
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await refresh();
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setTimeout(() => void refresh(), 0); else setMe(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<void> {
    const result = await getSupabase().auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    setSession(result.data.session);
    await refresh();
  }
  async function signUp(name: string, email: string, password: string): Promise<boolean> {
    const result = await getSupabase().auth.signUp({
      email, password, options: { data: { name }, emailRedirectTo: `${window.location.origin}/dashboard` }
    });
    if (result.error) throw result.error;
    return Boolean(result.data.session);
  }
  async function resetPassword(email: string): Promise<void> {
    const result = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` });
    if (result.error) throw result.error;
  }
  async function signOut(): Promise<void> { await getSupabase().auth.signOut(); setMe(null); }
  const value = useMemo(() => ({ session, me, loading, signIn, signUp, resetPassword, signOut, refresh }), [session, me, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
