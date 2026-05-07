import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import type { PaperAccount } from '../types';

interface PaperModeContextType {
  isPaperMode: boolean;
  togglePaperMode: () => void;
  paperAccount: PaperAccount | null;
  refreshAccount: () => void;
  showWelcome: boolean;
  dismissWelcome: () => void;
}

const PaperModeContext = createContext<PaperModeContextType | undefined>(undefined);

function dbToAccount(row: Record<string, unknown>): PaperAccount {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    startingBalance: Number(row.starting_balance),
    currentCash: Number(row.current_cash),
    totalPremiumCollected: Number(row.total_premium_collected),
    totalRealizedPnl: Number(row.total_realized_pnl),
    tradesWon: Number(row.trades_won),
    tradesTotal: Number(row.trades_total),
    createdAt: row.created_at as string,
    resetAt: row.reset_at as string,
  };
}

export function PaperModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isPaperMode, setIsPaperMode] = useState(() => {
    try { return localStorage.getItem('ph_paper_mode') === 'true'; } catch { return false; }
  });
  const [paperAccount, setPaperAccount] = useState<PaperAccount | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const initialized = useRef(false);
  const isFreeRef = useRef(false);

  // Fetch account
  const fetchAccount = useCallback(async () => {
    if (!user) { setPaperAccount(null); return; }
    const { data } = await supabase.from('paper_accounts').select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at').eq('user_id', user.id).maybeSingle();
    if (data) setPaperAccount(dbToAccount(data as Record<string, unknown>));
  }, [user]);

  // On auth resolve: check tier first, then sync paper_mode from Supabase
  useEffect(() => {
    if (!user) {
      setIsPaperMode(false);
      isFreeRef.current = false;
      try { localStorage.removeItem('ph_paper_mode'); } catch { /* ignore */ }
      setPaperAccount(null);
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    initialized.current = true;

    supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .single()
      .then(({ data: sub }) => {
        const free = !sub?.tier || sub.tier === 'free';
        isFreeRef.current = free;

        if (free) {
          // Free users are permanently locked to paper mode
          setIsPaperMode(true);
          try { localStorage.setItem('ph_paper_mode', 'true'); } catch { /* ignore */ }
          void supabase.from('user_preferences').update({ paper_mode: true }).eq('user_id', user.id);
        } else {
          // Pro/superuser: load saved preference
          void supabase
            .from('user_preferences')
            .select('paper_mode')
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data && typeof data.paper_mode === 'boolean') {
                setIsPaperMode(data.paper_mode);
                try { localStorage.setItem('ph_paper_mode', String(data.paper_mode)); } catch { /* ignore */ }
              }
            });
        }
      });

    void fetchAccount();
  }, [user, fetchAccount]);

  const refreshAccount = useCallback(() => { void fetchAccount(); }, [fetchAccount]);

  const togglePaperMode = useCallback(async () => {
    if (!user || isFreeRef.current) return;

    if (!isPaperMode) {
      // Turning ON
      // Idempotent insert
      const { data: inserted } = await supabase
        .from('paper_accounts')
        .insert({ user_id: user.id })
        .select('id, user_id, starting_balance, current_cash, total_premium_collected, total_realized_pnl, trades_won, trades_total, created_at, reset_at')
        .maybeSingle();

      if (inserted) {
        setPaperAccount(dbToAccount(inserted as Record<string, unknown>));
        setShowWelcome(true);
      } else {
        // Already exists
        void fetchAccount();
      }

      // Clear banner dismissal so it shows fresh
      try { sessionStorage.removeItem('ph_paper_banner_dismissed'); } catch { /* ignore */ }

      setIsPaperMode(true);
      try { localStorage.setItem('ph_paper_mode', 'true'); } catch { /* ignore */ }
      await supabase.from('user_preferences').update({ paper_mode: true }).eq('user_id', user.id);
    } else {
      // Turning OFF — check for open/assigned positions
      const { data: openPos } = await supabase
        .from('paper_positions')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['open', 'assigned']);

      const count = openPos?.length ?? 0;
      if (count > 0) {
        // Emit a custom event so PaperModals can show the confirm dialog
        window.dispatchEvent(new CustomEvent('ph:paper-switch-off', { detail: { count } }));
        return;
      }

      setIsPaperMode(false);
      try { localStorage.setItem('ph_paper_mode', 'false'); } catch { /* ignore */ }
      try { sessionStorage.removeItem('ph_paper_banner_dismissed'); } catch { /* ignore */ }
      await supabase.from('user_preferences').update({ paper_mode: false }).eq('user_id', user.id);
      showToast('Switched to real trading mode', 'success');
    }
  }, [user, isPaperMode, fetchAccount, showToast]);

  // Exposed: force switch off (called from confirm modal)
  useEffect(() => {
    const handler = async () => {
      if (!user || isFreeRef.current) return;
      setIsPaperMode(false);
      try { localStorage.setItem('ph_paper_mode', 'false'); } catch { /* ignore */ }
      try { sessionStorage.removeItem('ph_paper_banner_dismissed'); } catch { /* ignore */ }
      await supabase.from('user_preferences').update({ paper_mode: false }).eq('user_id', user.id);
    };
    window.addEventListener('ph:paper-confirm-off', handler as EventListener);
    return () => window.removeEventListener('ph:paper-confirm-off', handler as EventListener);
  }, [user]);

  return (
    <PaperModeContext.Provider value={{
      isPaperMode, togglePaperMode, paperAccount, refreshAccount, showWelcome,
      dismissWelcome: () => setShowWelcome(false),
    }}>
      {children}
    </PaperModeContext.Provider>
  );
}

export function usePaperMode() {
  const ctx = useContext(PaperModeContext);
  if (!ctx) throw new Error('usePaperMode must be used inside <PaperModeProvider>');
  return ctx;
}
