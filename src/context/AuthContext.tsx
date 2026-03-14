import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ThemeMode } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  // Load saved theme from Supabase user_preferences
  const loadPreferences = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_preferences')
      .select('theme')
      .eq('user_id', userId)
      .single();
    if (data?.theme === 'light' || data?.theme === 'dark') {
      setThemeState(data.theme);
    }
  }, []);

  // Initialize preferences row for new users (ON CONFLICT DO NOTHING via ignoreDuplicates)
  const initPreferences = useCallback(async (userId: string) => {
    await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, theme: 'dark', default_sort: 'iv_rank' },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) loadPreferences(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          initPreferences(session.user.id);
          loadPreferences(session.user.id);
        }
        if (event === 'SIGNED_OUT') {
          setThemeState('dark');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadPreferences, initPreferences]);

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    if (user) {
      await supabase
        .from('user_preferences')
        .update({ theme: newTheme, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, theme, setTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
