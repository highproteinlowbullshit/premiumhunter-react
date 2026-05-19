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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // If PASSWORD_RECOVERY already fired before this promise resolved, skip
      // setting the user — we don't want to undo the user=null guard.
      if (!recoveryModeRef.current) {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        // PASSWORD_RECOVERY is a temporary session for resetting the password only.
        // Don't treat it as a full sign-in — keep the app in the unauthenticated state
        // so the user lands on (and stays on) the reset-password page.
        if (event === 'PASSWORD_RECOVERY') {
          recoveryModeRef.current = true;
          setUser(null);
        } else {
          recoveryModeRef.current = false;
          setUser(session?.user ?? null);
        }
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          initPreferences(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [initPreferences]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
