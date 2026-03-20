import { useState, useEffect } from 'react';
import { usePaperMode } from '../context/PaperModeContext';
import { blackScholes, yearsToExpiry } from '../lib/blackScholes';
import type { OpenPaperPositionData } from '../types';

// ── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children, borderColor = 'rgba(245,200,66,0.25)' }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  borderColor?: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,8,19,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'rgba(10,22,40,0.98)', border: `1px solid ${borderColor}`, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: '#4a6a8a' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Welcome Modal ─────────────────────────────────────────────────────────────
export function WelcomeModal() {
  const { showWelcome, dismissWelcome } = usePaperMode();
  if (!showWelcome) return null;

  return (
    <ModalShell title="Welcome to Paper Trading" onClose={dismissWelcome}>
      <div className="rounded-xl p-4 mb-5"
        style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)' }}>
        <div className="text-4xl text-center mb-3">📄</div>
        <p className="text-sm text-center leading-relaxed" style={{ color: '#c9a227', fontFamily: 'DM Sans, sans-serif' }}>
          You have been given <strong>$100,000 in virtual cash</strong> to practice the wheel strategy.
          Trade with confidence — none of this affects your real money.
        </p>
      </div>
      <ul className="space-y-2 mb-5">
        {[
          'Sell Cash Secured Puts (CSP) and Covered Calls (CC)',
          'Practice position sizing with real market prices',
          'Track your paper P&L and win rate over time',
          'Switch back to real mode at any time',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ color: '#f5c842', flexShrink: 0 }}>✓</span>
            {item}
          </li>
        ))}
      </ul>
      <button
        onClick={dismissWelcome}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 4px 16px rgba(245,200,66,0.25)' }}
      >
        Start Paper Trading →
      </button>
    </ModalShell>
  );
}

// ── Reset Confirm Modal ───────────────────────────────────────────────────────
export function ResetConfirmModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <ModalShell title="Reset Paper Account" onClose={onClose} borderColor="rgba(255,77,109,0.25)">
      <p className="text-sm mb-5 leading-relaxed" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
        Reset your paper account to <strong style={{ color: '#e8f0fe' }}>$100,000</strong>? All paper positions and history will be permanently deleted.
        <br /><br />
        <span style={{ color: '#ff4d6d' }}>This cannot be undone.</span>
      </p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #ff4d6d, #c0392b)', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
          Reset Account
        </button>
      </div>
    </ModalShell>
  );
}

// ── Switch Off Confirm Modal ──────────────────────────────────────────────────
export function SwitchOffConfirmModal({ count, onClose }: { count: number; onClose: () => void }) {
  const handleConfirm = () => {
    window.dispatchEvent(new CustomEvent('ph:paper-confirm-off'));
    onClose();
  };

  return (
    <ModalShell title="Switch to Real Mode?" onClose={onClose}>
      <p className="text-sm mb-5 leading-relaxed" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
        You have <strong style={{ color: '#e8f0fe' }}>{count} open paper position{count !== 1 ? 's' : ''}</strong>.
        They'll be saved and waiting when you return to paper mode.
      </p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Stay in Paper Mode
        </button>
        <button onClick={handleConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif' }}>
          Switch to Real Mode
        </button>
      </div>
    </ModalShell>
  );
}

// ── Switch Off listener (global) ──────────────────────────────────────────────
export function SwitchOffListener() {
  const [switchCount, setSwitchCount] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { count: number };
      setSwitchCount(detail.count);
    };
    window.addEventListener('ph:paper-switch-off', handler);
    return () => window.removeEventListener('ph:paper-switch-off', handler);
  }, []);

  if (switchCount === null) return null;
  return <SwitchOffConfirmModal count={switchCount} onClose={() => setSwitchCount(null)} />;
}

// ── Paper Trade Modal (Screener pre-fill) ─────────────────────────────────────
interface PaperTradeModalProps {
  ticker: string;
  spotPrice: number;
  iv: number; // decimal e.g. 0.45
  onClose: () => void;
  onSubmit: (data: OpenPaperPositionData) => Promise<string | null>;
  currentCash: number;
}

function getNearestMonthlyExpiry(): string {
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth(); // 0-indexed

  for (let attempt = 0; attempt < 12; attempt++) {
    // Find third Friday of this month
    const firstDay = new Date(year, month, 1);
    const firstFriday = ((5 - firstDay.getDay() + 7) % 7) + 1;
    const thirdFriday = new Date(year, month, firstFriday + 14);
    const dte = Math.ceil((thirdFriday.getTime() - today.getTime()) / 86_400_000);
    if (dte >= 7) {
      return thirdFriday.toISOString().split('T')[0];
    }
    month++;
    if (month > 11) { month = 0; year++; }
  }
  // Fallback: 30 days out
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

function findThirtyDeltaStrike(spot: number, expiry: string, vol: number): { strike: number; premium: number } {
  const T = yearsToExpiry(expiry);
  let bestStrike = Math.floor(spot);
  let bestDelta = Infinity;
  let bestPremium = 0;

  for (let i = 0; i < 100; i++) {
    const strike = Math.floor(spot) - i;
    if (strike <= 0) break;
    const result = blackScholes({ spotPrice: spot, strikePrice: strike, timeToExpiry: T, riskFreeRate: 0.045, volatility: vol, optionType: 'put' });
    const absDelta = Math.abs(result.delta);
    if (Math.abs(absDelta - 0.30) < Math.abs(bestDelta - 0.30)) {
      bestDelta = absDelta;
      bestStrike = strike;
      bestPremium = Math.round(result.price * 100) / 100;
    }
  }
  return { strike: bestStrike, premium: bestPremium };
}

export function PaperTradeModal({ ticker, spotPrice, iv, onClose, onSubmit, currentCash }: PaperTradeModalProps) {
  const expiry = getNearestMonthlyExpiry();
  const { strike: defaultStrike, premium: defaultPremium } = findThirtyDeltaStrike(spotPrice, expiry, iv);

  const [form, setForm] = useState({
    strike: String(defaultStrike),
    expiry,
    premium: String(defaultPremium),
    contracts: '1',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const contracts = Number(form.contracts) || 1;
  const strike = Number(form.strike) || 0;
  const premium = Number(form.premium) || 0;
  const collateral = strike * contracts * 100;
  const insufficient = collateral > currentCash;

  const handleSubmit = async () => {
    if (!form.strike || !form.expiry || !form.premium || !form.contracts) { setError('All fields required'); return; }
    if (insufficient) { setError(`Insufficient paper cash — need $${collateral.toLocaleString()}`); return; }
    setSubmitting(true);
    const err = await onSubmit({
      ticker,
      strategy: 'CSP',
      strike,
      expiry: form.expiry,
      premiumCollected: premium,
      contracts,
      underlyingPriceAtEntry: spotPrice,
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    onClose();
  };

  const inputStyle = {
    background: 'rgba(5,13,26,0.8)',
    border: '1px solid rgba(245,200,66,0.2)',
    color: '#e8f0fe',
    fontFamily: 'JetBrains Mono, monospace',
    caretColor: '#f5c842',
    outline: 'none',
  };

  return (
    <ModalShell title={`Paper Trade: ${ticker}`} onClose={onClose}>
      <div className="rounded-xl p-3 mb-4 flex items-center justify-between"
        style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)' }}>
        <span className="text-xs font-bold" style={{ color: '#f5c842', fontFamily: 'JetBrains Mono, monospace' }}>CSP · {ticker}</span>
        <span className="text-xs" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
          Spot: ${spotPrice.toFixed(2)} · IV: {(iv * 100).toFixed(0)}%
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike (~30Δ)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
              <input type="number" step="0.5" value={form.strike}
                onChange={(e) => setForm((f) => ({ ...f, strike: e.target.value }))}
                className="w-full pl-7 pr-3 py-2 rounded-xl text-sm" style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Contracts</label>
            <input type="number" min="1" value={form.contracts}
              onChange={(e) => setForm((f) => ({ ...f, contracts: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm" style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Expiry</label>
            <input type="date" value={form.expiry}
              onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm" style={{ ...inputStyle, colorScheme: 'dark' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Premium (per contract)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
              <input type="number" step="0.01" value={form.premium}
                onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
                className="w-full pl-7 pr-3 py-2 rounded-xl text-sm" style={inputStyle} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg px-3 py-2 mb-4 flex justify-between text-xs"
        style={{ background: insufficient ? 'rgba(255,77,109,0.06)' : 'rgba(245,200,66,0.06)', border: `1px solid ${insufficient ? 'rgba(255,77,109,0.2)' : 'rgba(245,200,66,0.15)'}` }}>
        <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Collateral required</span>
        <span style={{ color: insufficient ? '#ff4d6d' : '#f5c842', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
          ${collateral.toLocaleString()}
        </span>
      </div>

      {error && <p className="text-xs mb-3" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{error}</p>}

      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={submitting || insufficient}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif' }}>
          {submitting ? 'Opening...' : 'Open Paper Position'}
        </button>
      </div>
    </ModalShell>
  );
}
