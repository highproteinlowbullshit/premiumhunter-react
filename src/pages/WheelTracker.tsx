import { useEffect, useState } from 'react';
import { PositionTable } from '../components/PositionTable';
import { usePositions } from '../hooks/usePositions';
import type { WheelStrategy } from '../types';

export function WheelTracker() {
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { openPositions, monthlyPnL, addPosition, removePosition } = usePositions();

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalPremium = openPositions.reduce((acc, p) => acc + p.premiumCollected, 0);

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
              <p className="text-sm mt-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                {openPositions.length} open positions · March 2026
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
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
            { label: 'Monthly P&L', value: `${monthlyPnL >= 0 ? '+' : ''}$${monthlyPnL.toFixed(0)}`, color: monthlyPnL >= 0 ? '#00d68f' : '#ff4d6d' },
            { label: 'Win Rate', value: '87%', color: '#f5c842' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', backdropFilter: 'blur(12px)' }}>
              <p className="text-xs mb-2 tracking-wide" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>{value}</p>
            </div>
          ))}
        </div>

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
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse-glow" style={{ background: '#00e5c4' }} />
              <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Live</span>
            </div>
          </div>
          <PositionTable positions={openPositions} onRemove={removePosition} />
        </div>
      </div>

      {/* Add Position Modal */}
      {showModal && (
        <AddPositionModal
          onClose={() => setShowModal(false)}
          onAdd={(data) => {
            addPosition(data);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

// ——————————————————————————————————
// Add Position Modal
// ——————————————————————————————————
interface AddPositionModalProps {
  onClose: () => void;
  onAdd: (data: {
    ticker: string;
    strategy: WheelStrategy;
    strike: number;
    expiry: string;
    premiumCollected: number;
    contracts: number;
  }) => void;
}

function AddPositionModal({ onClose, onAdd }: AddPositionModalProps) {
  const [form, setForm] = useState({
    ticker: '',
    strategy: 'CSP' as WheelStrategy,
    strike: '',
    expiry: '',
    premium: '',
    contracts: '1',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 8, 19, 0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'rgba(10, 22, 40, 0.98)',
          border: '1px solid rgba(0,229,196,0.2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}>
        {/* Modal header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
              Add Position
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              Log a new wheel trade
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: '#4a6a8a' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ticker + Strategy */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Ticker</label>
              <input
                value={form.ticker}
                onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                placeholder="GME"
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={inputStyle('ticker')}
              />
              {errors.ticker && <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{errors.ticker}</p>}
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strategy</label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl"
                style={{ background: 'rgba(5,13,26,0.8)', border: '1px solid rgba(0,229,196,0.15)' }}>
                {(['CSP', 'CC'] as WheelStrategy[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, strategy: s }))}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
                <input
                  value={form.strike}
                  onChange={(e) => setForm((f) => ({ ...f, strike: e.target.value }))}
                  placeholder="25.00"
                  type="number"
                  step="0.50"
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
                placeholder="1"
                type="number"
                min="1"
                className="w-full px-3 py-2.5 rounded-xl text-sm"
                style={inputStyle('contracts')}
              />
            </div>
          </div>

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
                placeholder="145.00"
                type="number"
                step="1"
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

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
                color: '#050d1a',
                fontFamily: 'DM Sans, sans-serif',
                boxShadow: '0 4px 16px rgba(0,229,196,0.2)',
              }}
            >
              Add Position
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
