import { useEffect, useState, useCallback, useMemo } from 'react';
import { PositionTable } from '../components/PositionTable';
import { ClosedPositionTable } from '../components/ClosedPositionTable';
import { usePositions } from '../hooks/usePositions';
import { usePaperMode } from '../context/PaperModeContext';
import { PaperWheelTracker } from './PaperWheelTracker';
import { getQuote } from '../lib/finnhub';
import { useRealtimePrices } from '../hooks/useRealtimePrices';
import { WebSocketStatus } from '../components/WebSocketStatus';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { WheelPosition, WheelStrategy } from '../types';
import { useTradeChecklist } from '../hooks/useTradeChecklist';
import { TradeChecklist } from '../components/TradeChecklist';
import { MonthlyTargetTracker } from '../components/MonthlyTargetTracker';
import type { ChecklistResult } from '../lib/tradeChecklist';

export function WheelTracker() {
  const { isPaperMode } = usePaperMode();
  if (isPaperMode) return <PaperWheelTracker />;
  return <RealWheelTracker />;
}

function RealWheelTracker() {
  const [mounted, setMounted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [closingPosition, setClosingPosition] = useState<WheelPosition | null>(null);
  const [editingPosition, setEditingPosition] = useState<WheelPosition | null>(null);
  const [assigningPosition, setAssigningPosition] = useState<WheelPosition | null>(null);
  const [deletingPosition, setDeletingPosition] = useState<WheelPosition | null>(null);
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const { user } = useAuth();
  const { positions, openPositions, monthlyPnL, isLoading, addPosition, removePosition, closePosition, editPosition, assignPosition } = usePositions();

  // Build stable ticker list from open positions for WebSocket subscription
  const openTickers = useMemo(
    () => [...new Set(openPositions.map((p) => p.ticker))],
    [openPositions]
  );
  const { prices: livePrices, wsStatus } = useRealtimePrices(openTickers);

  // Fetch cash balance from portfolio_holdings (holding_type = 'cash')
  useEffect(() => {
    if (!user) return;
    supabase
      .from('portfolio_holdings')
      .select('quantity')
      .eq('user_id', user.id)
      .eq('holding_type', 'cash')
      .eq('status', 'open')
      .then(({ data }) => {
        if (data) {
          const total = data.reduce((acc: number, row: { quantity: string }) => acc + Number(row.quantity), 0);
          setCashBalance(total);
        }
      });
  }, [user]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalPremium = openPositions.reduce((acc, p) => acc + p.premiumCollected, 0);
  const openCSPs = openPositions.filter((p) => p.strategy === 'CSP');
  const openCCs = openPositions.filter((p) => p.strategy === 'CC');
  const lockedCollateral = openCSPs.reduce((acc, p) => acc + p.strike * p.contracts * 100, 0);

  // Include assigned and expired in "closed" — they're done trades with real P&L
  const closedPositions = positions.filter(
    (p) => p.status === 'closed' || p.status === 'assigned' || p.status === 'expired'
  );
  // For assigned/expired the full premium is kept (no buyback cost)
  const getPositionPnl = (p: (typeof closedPositions)[0]) =>
    p.status === 'assigned' || p.status === 'expired'
      ? p.premiumCollected
      : p.premiumCollected - p.currentPrice * p.contracts;
  const wins = closedPositions.filter((p) => getPositionPnl(p) > 0);
  const winRate = closedPositions.length > 0
    ? Math.round((wins.length / closedPositions.length) * 100)
    : null;
  const totalRealizedPnl = closedPositions.reduce((acc, p) => acc + getPositionPnl(p), 0);

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(16px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-20" style={{ background: 'linear-gradient(90deg, rgba(0,229,196,0.3), transparent)' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
              The Wheel
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold"
                style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe', letterSpacing: '-0.02em' }}>
                Wheel Tracker
              </h1>
              <p className="text-sm mt-1" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
                <span style={{ color: '#00c6f5', fontWeight: 600 }}>{openCSPs.length} CSP{openCSPs.length !== 1 ? 's' : ''}</span>
                <span style={{ color: '#6a8aaa' }}> · </span>
                <span style={{ color: '#00e5c4', fontWeight: 600 }}>{openCCs.length} CC{openCCs.length !== 1 ? 's' : ''}</span>
                <span style={{ color: '#6a8aaa' }}> · </span>
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
                color: '#050d1a',
                fontFamily: 'DM Sans, sans-serif',
                boxShadow: '0 4px 16px rgba(0,229,196,0.2)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Add Position
            </button>
          </div>
        </div>

        {/* P&L Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.1s' }}>
          {[
            { label: 'Open Positions', value: openPositions.length.toString(), color: '#00e5c4' },
            { label: 'Total Premium', value: `$${totalPremium.toLocaleString()}`, color: '#00c6f5' },
            { label: 'Avg Monthly P&L', value: closedPositions.length > 0 ? `${monthlyPnL >= 0 ? '+' : ''}$${monthlyPnL.toFixed(0)}` : '—', color: monthlyPnL >= 0 ? '#00d68f' : '#ff4d6d' },
            { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—', color: '#f5c842' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', backdropFilter: 'blur(12px)' }}>
              <p className="text-xs mb-2 tracking-wide" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Monthly Income Target */}
        <MonthlyTargetTracker />

        {/* Positions Table */}
        <div className="rounded-2xl p-5 sm:p-6"
          style={{
            background: 'rgba(13,27,53,0.6)',
            border: '1px solid rgba(0,229,196,0.1)',
            backdropFilter: 'blur(12px)',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.5s ease 0.2s',
          }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
              Open Positions
            </h2>
            <WebSocketStatus status={wsStatus} />
          </div>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            <PositionTable
              positions={openPositions}
              livePrices={livePrices}
              onRemove={setDeletingPosition}
              onClose={setClosingPosition}
              onEdit={setEditingPosition}
              onAssign={setAssigningPosition}
            />
          )}
        </div>

        {/* Closed Positions Card */}
        <div className="rounded-2xl p-5 sm:p-6 mt-6"
          style={{
            background: 'rgba(13,27,53,0.6)',
            border: '1px solid rgba(0,229,196,0.1)',
            backdropFilter: 'blur(12px)',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.5s ease 0.3s',
          }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                Closed Positions
              </h2>
              {closedPositions.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: totalRealizedPnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
                  {totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(0)} realized · {closedPositions.length} trade{closedPositions.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            <ClosedPositionTable
              positions={closedPositions}
              onEdit={setEditingPosition}
              onRemove={setDeletingPosition}
            />
          )}
        </div>
      </div>

      {/* Add Position Modal */}
      {showAddModal && (
        <AddPositionModal
          cashBalance={cashBalance}
          lockedCollateral={lockedCollateral}
          openPositions={openPositions}
          onClose={() => setShowAddModal(false)}
          onAdd={(data) => {
            addPosition(data);
            setShowAddModal(false);
          }}
        />
      )}

      {/* Close Position Modal */}
      {closingPosition && (
        <ClosePositionModal
          position={closingPosition}
          onClose={() => setClosingPosition(null)}
          onConfirm={(closingPrice) => {
            closePosition(closingPosition.id, closingPrice);
            setClosingPosition(null);
          }}
        />
      )}

      {/* Edit Position Modal */}
      {editingPosition && (
        <EditPositionModal
          position={editingPosition}
          onClose={() => setEditingPosition(null)}
          onSave={(data) => {
            editPosition(editingPosition.id, data);
            setEditingPosition(null);
          }}
        />
      )}

      {/* Delete Position Modal */}
      {deletingPosition && (
        <DeletePositionModal
          position={deletingPosition}
          onClose={() => setDeletingPosition(null)}
          onConfirm={(shouldReverseCash) => {
            removePosition(
              deletingPosition.id,
              shouldReverseCash ? deletingPosition.premiumCollected : undefined,
            );
            setDeletingPosition(null);
          }}
        />
      )}

      {/* Assign Position Modal */}
      {assigningPosition && (
        <AssignPositionModal
          position={assigningPosition}
          onClose={() => setAssigningPosition(null)}
          onConfirm={() => {
            assignPosition(assigningPosition.id, {
              strategy: assigningPosition.strategy,
              ticker: assigningPosition.ticker,
              strike: assigningPosition.strike,
              contracts: assigningPosition.contracts,
              premiumCollected: assigningPosition.premiumCollected,
            });
            setAssigningPosition(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <div className="space-y-2 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl h-14 animate-pulse"
          style={{ background: 'rgba(0,229,196,0.04)', animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared modal shell
// ─────────────────────────────────────────────────────────────────────────────
function ModalShell({ title, subtitle, onClose, children, wide = false }: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(2, 8, 19, 0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="min-h-full flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-md'} rounded-2xl p-6`}
        style={{
          background: 'rgba(10, 22, 40, 0.98)',
          border: '1px solid rgba(0,229,196,0.2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>{title}</h2>
            <p className="text-xs mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{subtitle}</p>
          </div>
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Close Position Modal
// ─────────────────────────────────────────────────────────────────────────────
function ClosePositionModal({ position, onClose, onConfirm }: {
  position: WheelPosition;
  onClose: () => void;
  onConfirm: (closingPrice: number) => void;
}) {
  const [closingPrice, setClosingPrice] = useState('');
  const [error, setError] = useState('');

  const perContractPremium = position.premiumCollected / position.contracts;
  const closingPriceNum = Number(closingPrice);
  const previewPnl = closingPrice && !isNaN(closingPriceNum)
    ? position.premiumCollected - closingPriceNum * position.contracts
    : null;

  const inputStyle = {
    background: 'rgba(5, 13, 26, 0.8)',
    border: error ? '1px solid rgba(255,77,109,0.4)' : '1px solid rgba(0,229,196,0.15)',
    color: '#e8f0fe',
    fontFamily: 'JetBrains Mono, monospace',
    caretColor: '#00e5c4',
    outline: 'none',
  };

  const handleConfirm = () => {
    if (!closingPrice || isNaN(closingPriceNum) || closingPriceNum < 0) {
      setError('Enter a valid closing price');
      return;
    }
    onConfirm(closingPriceNum);
  };

  return (
    <ModalShell
      title="Close Position"
      subtitle={`${position.ticker} ${position.strategy} · $${position.strike} strike`}
      onClose={onClose}
    >
      {/* Position summary */}
      <div className="rounded-xl p-4 mb-5"
        style={{ background: 'rgba(0,229,196,0.05)', border: '1px solid rgba(0,229,196,0.12)' }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Premium</p>
            <p className="text-sm font-semibold" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
              ${perContractPremium.toFixed(2)}
            </p>
            <p className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>per contract</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Contracts</p>
            <p className="text-sm font-semibold" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
              {position.contracts}x
            </p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>DTE</p>
            <p className="text-sm font-semibold" style={{ color: position.daysToExpiry <= 7 ? '#ff4d6d' : '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
              {position.daysToExpiry}d
            </p>
          </div>
        </div>
      </div>

      {/* Closing price input */}
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Closing Price <span style={{ color: '#2e4a6a' }}>(buy-back price per contract)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            autoFocus
            value={closingPrice}
            onChange={(e) => { setClosingPrice(e.target.value); setError(''); }}
            placeholder={`e.g. ${(perContractPremium * 0.25).toFixed(2)}`}
            className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm"
            style={inputStyle}
          />
        </div>
        {error && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{error}</p>}
      </div>

      {/* P&L preview */}
      {previewPnl !== null && (
        <div className="rounded-lg px-4 py-3 mb-5 flex items-center justify-between"
          style={{
            background: previewPnl >= 0 ? 'rgba(0,214,143,0.06)' : 'rgba(255,77,109,0.06)',
            border: `1px solid ${previewPnl >= 0 ? 'rgba(0,214,143,0.15)' : 'rgba(255,77,109,0.15)'}`,
          }}>
          <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Realized P&L</span>
          <span className="text-base font-bold"
            style={{ color: previewPnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
            {previewPnl >= 0 ? '+' : ''}${previewPnl.toFixed(2)}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button type="button" onClick={handleConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
            color: '#050d1a',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: '0 4px 16px rgba(0,229,196,0.2)',
          }}>
          Close Position
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Position Modal
// ─────────────────────────────────────────────────────────────────────────────
function EditPositionModal({ position, onClose, onSave }: {
  position: WheelPosition;
  onClose: () => void;
  onSave: (data: { strike: number; expiry: string; premiumCollected: number; contracts: number }) => void;
}) {
  const perContractPremium = position.premiumCollected / position.contracts;
  const [form, setForm] = useState({
    strike: String(position.strike),
    expiry: position.expiry,
    premium: String(perContractPremium),
    contracts: String(position.contracts),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputStyle = (field: string) => ({
    background: 'rgba(5, 13, 26, 0.8)',
    border: errors[field] ? '1px solid rgba(255,77,109,0.4)' : '1px solid rgba(0,229,196,0.15)',
    color: '#e8f0fe',
    fontFamily: 'JetBrains Mono, monospace',
    caretColor: '#00e5c4',
    outline: 'none',
  });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.strike || isNaN(Number(form.strike))) e.strike = 'Invalid price';
    if (!form.expiry) e.expiry = 'Required';
    if (!form.premium || isNaN(Number(form.premium))) e.premium = 'Invalid amount';
    if (!form.contracts || isNaN(Number(form.contracts)) || Number(form.contracts) < 1) e.contracts = 'Invalid';
    return e;
  };

  const handleSave = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({
      strike: Number(form.strike),
      expiry: form.expiry,
      premiumCollected: Number(form.premium),
      contracts: Number(form.contracts),
    });
  };

  return (
    <ModalShell
      title="Edit Position"
      subtitle={`${position.ticker} ${position.strategy}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Strike + Contracts */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
              <input
                type="number" step="0.50" value={form.strike}
                onChange={(e) => setForm((f) => ({ ...f, strike: e.target.value }))}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm"
                style={inputStyle('strike')}
              />
            </div>
            {errors.strike && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.strike}</p>}
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Contracts</label>
            <input
              type="number" min="1" value={form.contracts}
              onChange={(e) => setForm((f) => ({ ...f, contracts: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={inputStyle('contracts')}
            />
            {errors.contracts && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.contracts}</p>}
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Expiration Date</label>
          <input
            type="date" value={form.expiry}
            onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={{ ...inputStyle('expiry'), colorScheme: 'dark' }}
          />
          {errors.expiry && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.expiry}</p>}
        </div>

        {/* Premium */}
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Premium Collected <span style={{ color: '#2e4a6a' }}>(per contract)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
            <input
              type="number" step="1" value={form.premium}
              onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
              className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm"
              style={inputStyle('premium')}
            />
          </div>
          {errors.premium && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.premium}</p>}
          {form.premium && form.contracts && (
            <p className="text-xs mt-1" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
              Total: ${(Number(form.premium) * Number(form.contracts)).toFixed(0)}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
              color: '#050d1a',
              fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 4px 16px rgba(0,229,196,0.2)',
            }}>
            Save Changes
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assign Position Modal
// ─────────────────────────────────────────────────────────────────────────────
function AssignPositionModal({ position, onClose, onConfirm }: {
  position: WheelPosition;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isCSP = position.strategy === 'CSP';
  const sharesQty = position.contracts * 100;
  const premiumPerShare = (position.premiumCollected / position.contracts) / 100;
  const effectiveBasis = Math.max(0, position.strike - premiumPerShare);
  const totalCashFlow = isCSP
    ? position.strike * sharesQty  // cash paid for shares
    : position.strike * sharesQty; // cash received for shares

  return (
    <ModalShell
      title="Mark as Assigned"
      subtitle={`${position.ticker} ${position.strategy} · $${position.strike} strike · ${position.contracts}x`}
      onClose={onClose}
    >
      {/* Assignment summary */}
      <div className="rounded-xl p-4 mb-4"
        style={{ background: 'rgba(245,200,66,0.06)', border: '1px solid rgba(245,200,66,0.2)' }}>
        <p className="text-xs font-semibold mb-3 tracking-widest uppercase"
          style={{ color: '#f5c842', fontFamily: 'DM Sans, sans-serif' }}>
          {isCSP ? 'Put Assigned — Shares Purchased' : 'Call Assigned — Shares Called Away'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Shares</p>
            <p className="text-sm font-bold" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
              {isCSP ? '+' : '−'}{sharesQty} {position.ticker}
            </p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              {isCSP ? 'Cash Out' : 'Cash In'}
            </p>
            <p className="text-sm font-bold" style={{ color: isCSP ? '#ff4d6d' : '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
              {isCSP ? '−' : '+'}${totalCashFlow.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Premium Kept</p>
            <p className="text-sm font-bold" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
              +${position.premiumCollected.toFixed(0)}
            </p>
          </div>
          {isCSP && (
            <div>
              <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Effective Basis</p>
              <p className="text-sm font-bold" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                ${effectiveBasis.toFixed(2)}/share
              </p>
            </div>
          )}
        </div>
      </div>

      {/* What will happen */}
      <div className="rounded-lg px-4 py-3 mb-5"
        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {isCSP ? (
          <p className="text-xs leading-relaxed" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ color: '#9ab4d4' }}>{sharesQty} shares</span> of {position.ticker} will be added to your Portfolio holdings at an effective cost basis of <span style={{ color: '#00e5c4' }}>${effectiveBasis.toFixed(2)}/share</span> (strike minus premium received).
          </p>
        ) : (
          <p className="text-xs leading-relaxed" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
            This position will be marked as assigned. Go to <span style={{ color: '#9ab4d4' }}>Portfolio → Holdings</span> and close your {position.ticker} shares at <span style={{ color: '#00e5c4' }}>${position.strike}/share</span> to record the sale.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #f5c842, #f59e0b)',
            color: '#1a1200',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: '0 4px 16px rgba(245,200,66,0.2)',
          }}>
          Confirm Assignment
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Position Modal
// ─────────────────────────────────────────────────────────────────────────────
function DeletePositionModal({ position, onClose, onConfirm }: {
  position: WheelPosition;
  onClose: () => void;
  onConfirm: (shouldReverseCash: boolean) => void;
}) {
  const [reverseCash, setReverseCash] = useState(true);

  return (
    <ModalShell
      title="Delete Position"
      subtitle={`${position.ticker} ${position.strategy} · $${position.strike} strike · ${position.contracts}x`}
      onClose={onClose}
    >
      {/* Position summary */}
      <div className="rounded-xl p-4 mb-4"
        style={{ background: 'rgba(255,77,109,0.05)', border: '1px solid rgba(255,77,109,0.15)' }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Premium</p>
            <p className="text-sm font-bold" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
              ${position.premiumCollected.toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Contracts</p>
            <p className="text-sm font-bold" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
              {position.contracts}x
            </p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Opened</p>
            <p className="text-sm font-bold" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
              {position.openedAt}
            </p>
          </div>
        </div>
      </div>

      {/* Cash reversal toggle */}
      <div className="rounded-xl p-4 mb-5"
        style={{ background: 'rgba(0,229,196,0.04)', border: '1px solid rgba(0,229,196,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <input
            type="checkbox"
            id="reverse-cash"
            checked={reverseCash}
            onChange={(e) => setReverseCash(e.target.checked)}
            style={{ accentColor: '#00e5c4', width: 14, height: 14, marginTop: 2, flexShrink: 0 }}
          />
          <label htmlFor="reverse-cash" style={{ cursor: 'pointer' }}>
            <p style={{ color: '#e8f0fe', fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, marginBottom: 3 }}>
              Reverse cash credit in Portfolio
            </p>
            <p style={{ color: '#6a8fb0', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
              When this position was opened, <span style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>${position.premiumCollected.toFixed(0)}</span> was credited to your cash balance. Uncheck to keep the cash as-is.
            </p>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button type="button" onClick={() => onConfirm(reverseCash)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #ff4d6d, #e03354)',
            color: '#fff',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: '0 4px 16px rgba(255,77,109,0.2)',
          }}>
          Delete Position
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Submit button for Add Position Modal
// ─────────────────────────────────────────────────────────────────────────────
function SubmitButton({ result }: { result: ChecklistResult | null }) {
  const status = result?.overallStatus;
  const canProceed = result?.canProceed ?? true;

  if (!result || status === 'clear') {
    return (
      <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #00e5c4, #00b4d8)', color: '#050d1a', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 4px 16px rgba(0,229,196,0.2)' }}>
        Add Position
      </button>
    );
  }
  if (status === 'warnings') {
    return (
      <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
        style={{ background: 'transparent', border: '1px solid rgba(245,200,66,0.4)', color: '#f5c842', fontFamily: 'DM Sans, sans-serif' }}>
        Add Position Anyway
        <span className="block text-[10px] font-normal opacity-70">{result.warnCount + result.failCount} warning(s)</span>
      </button>
    );
  }
  // blocked
  return (
    <button type="submit" disabled={!canProceed} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
      style={{ background: canProceed ? 'transparent' : 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.3)', color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', cursor: canProceed ? 'pointer' : 'not-allowed', opacity: canProceed ? 1 : 0.7 }}
      title={canProceed ? undefined : 'Fix critical issues above to enable this trade'}>
      {canProceed ? 'Add Position Anyway' : 'Blocked — Resolve Issues'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Position Modal (unchanged from before)
// ─────────────────────────────────────────────────────────────────────────────
interface AddPositionModalProps {
  cashBalance: number | null;
  lockedCollateral: number;
  onClose: () => void;
  openPositions: Array<{ ticker: string; strategy: string; strike: number; contracts: number }>;
  onAdd: (data: {
    ticker: string;
    strategy: WheelStrategy;
    strike: number;
    expiry: string;
    premiumCollected: number;
    contracts: number;
    checklistSnapshot?: object;
  }) => void;
}

function AddPositionModal({ cashBalance, lockedCollateral, openPositions, onClose, onAdd }: AddPositionModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    ticker: '',
    strategy: 'CSP' as WheelStrategy,
    strike: '',
    expiry: '',
    premium: '',
    contracts: '1',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [spotPrice, setSpotPrice] = useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [sharesHeld, setSharesHeld] = useState<number | null>(null);
  const [fetchingShares, setFetchingShares] = useState(false);

  const contracts = Number(form.contracts) || 1;
  const strike = Number(form.strike) || 0;
  const collateral = form.strategy === 'CSP' && strike > 0 ? strike * contracts * 100 : 0;
  const freeCash = cashBalance !== null ? Math.max(0, cashBalance - lockedCollateral) : null;

  // Checklist integration
  const premiumPerShare = Number(form.premium) / 100;
  const freeCashForChecklist = cashBalance !== null ? Math.max(0, cashBalance - lockedCollateral) : 0;

  const { result: checklistResult, isRunning, overriddenChecks, toggleOverride, resetOverrides, supplemental, prefsFetched } =
    useTradeChecklist(
      {
        ticker: form.ticker,
        strategy: form.strategy,
        strike: Number(form.strike) || 0,
        expiry: form.expiry,
        contracts: contracts,
        premium: premiumPerShare,
        currentPrice: spotPrice ?? 0,
        buyingPower: freeCashForChecklist,
        sectorExposure: new Map(),
        sharesHeld: sharesHeld ?? 0,
      },
      openPositions,
    );

  const saveAccountBalance = useCallback(async (amount: number) => {
    if (!user) return;
    await supabase
      .from('user_preferences')
      .upsert(
        { user_id: user.id, account_balance: amount },
        { onConflict: 'user_id' }
      );
  }, [user]);

  useEffect(() => {
    resetOverrides();
  }, [form.ticker, resetOverrides]);
  const insufficient = form.strategy === 'CSP' && collateral > 0 && freeCash !== null && collateral > freeCash;

  const fetchSpot = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setFetchingPrice(true);
    try {
      const q = await getQuote(ticker.toUpperCase());
      const price = q.c > 0 ? q.c : q.pc;
      if (price > 0) {
        setSpotPrice(price);
        // Pre-fill strike at ~95% of spot only if the field is still empty
        if (!form.strike) setForm((f) => ({ ...f, strike: String(Math.floor(price * 0.95)) }));
      }
    } catch { /* ignore */ }
    setFetchingPrice(false);
  }, [form.strike]);

  const fetchShares = useCallback(async (ticker: string) => {
    if (!ticker || !user) return;
    setFetchingShares(true);
    try {
      const { data } = await supabase
        .from('portfolio_holdings')
        .select('quantity')
        .eq('user_id', user.id)
        .eq('ticker', ticker.toUpperCase())
        .eq('holding_type', 'shares')
        .eq('status', 'open');
      const total = (data ?? []).reduce((acc: number, row: { quantity: string }) => acc + Number(row.quantity), 0);
      setSharesHeld(total > 0 ? total : 0);
    } catch { /* ignore */ }
    setFetchingShares(false);
  }, [user]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.ticker) e.ticker = 'Required';
    if (!form.strike || isNaN(Number(form.strike))) e.strike = 'Invalid price';
    if (!form.expiry) e.expiry = 'Required';
    if (!form.premium || isNaN(Number(form.premium))) e.premium = 'Invalid amount';
    if (!form.contracts || isNaN(Number(form.contracts))) e.contracts = 'Invalid';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onAdd({
      ticker: form.ticker,
      strategy: form.strategy,
      strike: Number(form.strike),
      expiry: form.expiry,
      premiumCollected: Number(form.premium),
      contracts: Number(form.contracts),
      checklistSnapshot: checklistResult ?? undefined,
    });
    // Fire-and-forget analytics (no await, no error surfacing to user)
    if (checklistResult) {
      void supabase.from('checklist_analytics').insert({
        ticker: form.ticker.toUpperCase(),
        strategy: form.strategy,
        checks_passed: checklistResult.passCount,
        checks_warned: checklistResult.warnCount,
        checks_failed: checklistResult.failCount,
        checks_overridden: overriddenChecks.size,
        submitted_anyway: checklistResult.overallStatus !== 'clear',
      });
    }
  };

  const inputStyle = (field: string) => ({
    background: 'rgba(5, 13, 26, 0.8)',
    border: errors[field] ? '1px solid rgba(255,77,109,0.4)' : '1px solid rgba(0,229,196,0.15)',
    color: '#e8f0fe',
    fontFamily: 'JetBrains Mono, monospace',
    caretColor: '#00e5c4',
    outline: 'none',
  });

  return (
    <ModalShell title="Add Position" subtitle="Log a new wheel trade" onClose={onClose} wide>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: form */}
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 min-w-0">
        {/* Ticker + Strategy */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Ticker</label>
            <input
              value={form.ticker}
              onChange={(e) => { setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() })); setSpotPrice(null); setSharesHeld(null); }}
              onBlur={(e) => { void fetchSpot(e.target.value); void fetchShares(e.target.value); }}
              placeholder=""
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={inputStyle('ticker')}
            />
            {fetchingPrice && <p className="text-xs mt-1" style={{ color: '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}>Fetching price…</p>}
            {spotPrice != null && !fetchingPrice && (
              <p className="text-xs mt-1" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
                Live: ${spotPrice.toFixed(2)}
              </p>
            )}
            {errors.ticker && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.ticker}</p>}
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strategy</label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl"
              style={{ background: 'rgba(5,13,26,0.8)', border: '1px solid rgba(0,229,196,0.15)' }}>
              {(['CSP', 'CC'] as WheelStrategy[]).map((s) => (
                <button
                  key={s} type="button"
                  onClick={() => { setForm((f) => ({ ...f, strategy: s })); if (s === 'CC' && form.ticker) void fetchShares(form.ticker); }}
                  className="py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={{
                    background: form.strategy === s ? (s === 'CSP' ? 'rgba(0,198,245,0.15)' : 'rgba(0,229,196,0.15)') : 'transparent',
                    color: form.strategy === s ? (s === 'CSP' ? '#00c6f5' : '#00e5c4') : '#4a6a8a',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Strike + Contracts */}
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
              <input
                value={form.strike}
                onChange={(e) => setForm((f) => ({ ...f, strike: e.target.value }))}
                placeholder="" type="number" step="0.50"
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm"
                style={inputStyle('strike')}
              />
            </div>
            {errors.strike && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.strike}</p>}
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Contracts</label>
            <input
              value={form.contracts}
              onChange={(e) => setForm((f) => ({ ...f, contracts: e.target.value }))}
              placeholder="1" type="number" min="1"
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={inputStyle('contracts')}
            />
          </div>
        </div>

        {/* CC capacity panel */}
        {form.strategy === 'CC' && form.ticker && (
          <div className="rounded-lg px-4 py-3 text-xs"
            style={{
              background: 'rgba(0,229,196,0.05)',
              border: '1px solid rgba(0,229,196,0.15)',
            }}>
            {fetchingShares ? (
              <p style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Checking share holdings…</p>
            ) : sharesHeld !== null ? (() => {
              const committedContracts = openPositions
                .filter((p) => p.strategy === 'CC' && p.ticker === form.ticker.toUpperCase())
                .reduce((acc, p) => acc + p.contracts, 0);
              const maxTotal = Math.floor(sharesHeld / 100);
              const available = Math.max(0, maxTotal - committedContracts);
              return (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{form.ticker} shares held</span>
                    <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{sharesHeld.toLocaleString()}</span>
                  </div>
                  {committedContracts > 0 && (
                    <div className="flex justify-between items-center mb-1">
                      <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Used by open CCs</span>
                      <span style={{ color: '#ff9f43', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>−{committedContracts} contract{committedContracts !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 2 }}>
                    <span style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>Available to sell</span>
                    <span style={{
                      color: sharesHeld === 0 ? '#ff4d6d' : contracts > available ? '#ff4d6d' : '#00e5c4',
                      fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                    }}>
                      {available}
                      {contracts > available && available > 0 && (
                        <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 10 }}>(exceeds available)</span>
                      )}
                      {available === 0 && sharesHeld > 0 && committedContracts > 0 && (
                        <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 10 }}>(all shares committed)</span>
                      )}
                      {sharesHeld === 0 && (
                        <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 10 }}>(no shares held)</span>
                      )}
                    </span>
                  </div>
                </>
              );
            })() : (
              <p style={{ color: '#2a4060', fontFamily: 'DM Sans, sans-serif' }}>
                Enter ticker to check share holdings
              </p>
            )}
          </div>
        )}

        {/* CSP Collateral required */}
        {form.strategy === 'CSP' && collateral > 0 && (
          <div className="rounded-lg px-4 py-3 text-xs"
            style={{
              background: insufficient ? 'rgba(255,77,109,0.06)' : 'rgba(0,229,196,0.05)',
              border: `1px solid ${insufficient ? 'rgba(255,77,109,0.2)' : 'rgba(0,229,196,0.15)'}`,
            }}>
            <div className="flex justify-between items-center mb-1.5">
              <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                Collateral required
                <span style={{ color: '#2a4060', marginLeft: 4 }}>({contracts} × ${strike} × 100)</span>
              </span>
              <span style={{ color: insufficient ? '#ff4d6d' : '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                ${collateral.toLocaleString()}
              </span>
            </div>
            {cashBalance !== null && (
              <>
                <div className="flex justify-between items-center mb-1">
                  <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Cash balance</span>
                  <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    ${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {lockedCollateral > 0 && (
                  <div className="flex justify-between items-center mb-1">
                    <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>CSP obligation</span>
                    <span style={{ color: '#ff8ca8', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      −${lockedCollateral.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 2 }}>
                  <span style={{ color: insufficient ? '#ff4d6d' : '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
                    Free cash
                  </span>
                  <span style={{ color: insufficient ? '#ff4d6d' : '#00d68f', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                    ${(freeCash ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {insufficient && <span style={{ marginLeft: 6, fontWeight: 400, fontSize: 10 }}>(insufficient)</span>}
                  </span>
                </div>
              </>
            )}
            {cashBalance === null && (
              <p style={{ color: '#2a4060', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
                Add a Cash holding in Portfolio to see balance here
              </p>
            )}
          </div>
        )}

        {/* Expiry */}
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Expiration Date</label>
          <input
            value={form.expiry}
            onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
            type="date"
            className="w-full px-3 py-2.5 rounded-xl text-sm"
            style={{ ...inputStyle('expiry'), colorScheme: 'dark' }}
          />
          {errors.expiry && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.expiry}</p>}
        </div>

        {/* Premium */}
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Premium Collected <span style={{ color: '#2e4a6a' }}>(per contract)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
            <input
              value={form.premium}
              onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
              placeholder="145.00" type="number" step="1"
              className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm"
              style={inputStyle('premium')}
            />
          </div>
          {errors.premium && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.premium}</p>}
          {form.premium && form.contracts && (
            <p className="text-xs mt-1" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
              Total: ${(Number(form.premium) * Number(form.contracts)).toFixed(0)}
            </p>
          )}
        </div>

          {/* Checklist on mobile */}
          <div className="lg:hidden">
            <TradeChecklist
              result={checklistResult}
              overriddenChecks={overriddenChecks}
              onToggleOverride={toggleOverride}
              isLoading={isRunning}
              strategy={form.strategy}
            />
          </div>

          {/* Account balance prompt */}
          {prefsFetched && supplemental.accountBalance === 0 && (
            <div className="rounded-lg px-3 py-2.5 text-xs flex items-center gap-2"
              style={{ background: 'rgba(0,198,245,0.06)', border: '1px solid rgba(0,198,245,0.12)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="#00c6f5" strokeWidth="1.2" />
                <path d="M6 5v4M6 4v-.5" stroke="#00c6f5" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span style={{ color: '#4a8ab0', fontFamily: 'DM Sans, sans-serif' }}>
                Set account size for position-sizing checks:
              </span>
              <input
                type="number"
                placeholder="100000"
                className="px-2 py-0.5 rounded text-xs ml-1"
                style={{ background: 'rgba(0,198,245,0.08)', border: '1px solid rgba(0,198,245,0.2)', color: '#00c6f5', fontFamily: 'JetBrains Mono, monospace', width: 90, outline: 'none' }}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0) void saveAccountBalance(v);
                }}
              />
            </div>
          )}

          {/* Submit row */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
              Cancel
            </button>
            <SubmitButton result={checklistResult} />
          </div>
        </form>

        {/* Right: checklist on desktop */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <TradeChecklist
            result={checklistResult}
            overriddenChecks={overriddenChecks}
            onToggleOverride={toggleOverride}
            isLoading={isRunning}
            strategy={form.strategy}
          />
        </div>
      </div>
    </ModalShell>
  );
}
