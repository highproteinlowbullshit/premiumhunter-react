import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isBanned: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  // Tracks whether a PASSWORD_RECOVERY event has fired so that a getSession()
  // resolving later on a slow connection doesn't undo the user=null guard.
  const recoveryModeRef = useRef(false);

  // Initialize preferences row for new users (ON CONFLICT DO NOTHING via ignoreDuplicates)
  const initPreferences = useCallback(async (userId: string) => {
    await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, theme: 'dark', default_sort: 'iv_rank', paper_mode: false },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );
  }, []);

  const checkBanStatus = useCallback(async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('user_profiles')
      .select('is_banned')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.is_banned === true;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (!recoveryModeRef.current) {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          const banned = await checkBanStatus(u.id);
          setIsBanned(banned);
          if (banned) await supabase.auth.signOut();
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (event === 'PASSWORD_RECOVERY') {
          recoveryModeRef.current = true;
          setUser(null);
          setIsBanned(false);
        } else {
          recoveryModeRef.current = false;
          const u = session?.user ?? null;
          setUser(u);
          if (u) {
            const banned = await checkBanStatus(u.id);
            setIsBanned(banned);
            if (banned) { await supabase.auth.signOut(); return; }
          } else {
            setIsBanned(false);
          }
        }
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          initPreferences(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [initPreferences, checkBanStatus]);

  const signOut = useCallback(async () => {
    setIsBanned(false);
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, isBanned, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
