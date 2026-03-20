import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaperMode } from '../context/PaperModeContext';
import { PaperPortfolio } from './PaperPortfolio';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { usePortfolio, type HoldingWithPrice } from '../hooks/usePortfolio';
import { usePositions } from '../hooks/usePositions';
import { LeapsTableCells, LeapsMobileValues } from '../components/LeapsTableCells';
import { LeapsCalculator } from '../components/LeapsCalculator';
import { blackScholes, yearsToExpiry, estimateVolatility } from '../lib/blackScholes';
import { getQuote } from '../lib/finnhub';
import type { PortfolioSnapshot, HoldingType } from '../types';
import { useRealtimePrices } from '../hooks/useRealtimePrices';
import { WebSocketStatus } from '../components/WebSocketStatus';

type Currency = 'USD' | 'SGD';
const SGD_FALLBACK_RATE = 1.275; // fallback if Finnhub fetch fails

type RangeKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All';

const RANGES: RangeKey[] = ['1W', '1M', '3M', '6M', '1Y', 'All'];

function filterSnapshotsByRange(snapshots: PortfolioSnapshot[], range: RangeKey): PortfolioSnapshot[] {
  if (range === 'All') return snapshots;
  const now = Date.now();
  const msMap: Record<RangeKey, number> = {
    '1W': 7 * 86400000,
    '1M': 30 * 86400000,
    '3M': 90 * 86400000,
    '6M': 180 * 86400000,
    '1Y': 365 * 86400000,
    All: 0,
  };
  const cutoff = now - msMap[range];
  return snapshots.filter((s) => new Date(s.snapshotDate).getTime() >= cutoff);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(val: number): string {
  if (Math.abs(val) >= 1000) {
    return `$${(val / 1000).toFixed(1)}k`;
  }
  return `$${val.toFixed(0)}`;
}

function formatDollars(val: number): string {
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return val < 0 ? `-$${formatted}` : `$${formatted}`;
}

function holdingTypeLabel(type: HoldingType): string {
  switch (type) {
    case 'shares': return 'Shares';
    case 'leaps_call': return 'LEAPS Call';
    case 'leaps_put': return 'LEAPS Put';
    case 'other': return 'Other';
    case 'cash': return 'Cash';
  }
}

function holdingTypeBadgeColor(type: HoldingType): string {
  switch (type) {
    case 'shares': return '#00e5c4';
    case 'leaps_call': return '#00c6f5';
    case 'leaps_put': return '#f5c842';
    case 'other': return '#4a6a8a';
    case 'cash': return '#22d68f';
  }
}

function getDte(expiry: string): number {
  return Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000));
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  value: number;
  name: string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload.find((p) => p.name === 'portfolioValue')?.value ?? 0;
  const cost = payload.find((p) => p.name === 'costBasis')?.value ?? 0;
  const pnl = value - cost;
  return (
    <div
      style={{
        background: 'rgba(13,27,53,0.95)',
        border: '1px solid rgba(0,229,196,0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      <div style={{ color: '#9ab4d4', fontSize: 11, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#9ab4d4', fontSize: 12 }}>Value:</span>
          <span style={{ color: '#e8f0fe', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
            {formatDollars(value)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#9ab4d4', fontSize: 12 }}>Cost:</span>
          <span style={{ color: '#e8f0fe', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
            {formatDollars(cost)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#9ab4d4', fontSize: 12 }}>P&L:</span>
          <span
            style={{
              color: pnl >= 0 ? '#00d68f' : '#ff4d6d',
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {pnl >= 0 ? '+' : ''}{formatDollars(pnl)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Add Holding Modal ──────────────────────────────────────────────────────────

interface AddHoldingModalProps {
  onClose: () => void;
  onSubmit: (data: {
    ticker: string;
    holdingType: HoldingType;
    quantity: number;
    avgCost: number;
    openedAt: string;
    expiry?: string;
    strike?: number;
    notes?: string;
  }) => void;
  livePrices: Map<string, number | null>;
}

function AddHoldingModal({ onClose, onSubmit, livePrices }: AddHoldingModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [ticker, setTicker] = useState('');
  const [holdingType, setHoldingType] = useState<HoldingType>('shares');
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [openedAt, setOpenedAt] = useState(today);
  const [expiry, setExpiry] = useState('');
  const [strike, setStrike] = useState('');
  const [notes, setNotes] = useState('');

  const isCash = holdingType === 'cash';
  const isLeaps = holdingType === 'leaps_call' || holdingType === 'leaps_put';

  const qty = parseFloat(quantity) || 0;
  const cost = isCash ? 1 : (parseFloat(avgCost) || 0);
  const livePrice = !isCash ? (livePrices.get(ticker.toUpperCase()) ?? null) : null;
  const estMV = !isCash && livePrice != null ? livePrice * qty : null;
  const estPnl = estMV != null ? estMV - cost * qty : null;

  // BS estimate for LEAPS
  const strikeNum = parseFloat(strike) || 0;
  const leapsBSPrice: number | null = (() => {
    if (!isLeaps || !livePrice || !strikeNum || !expiry) return null;
    const T = yearsToExpiry(expiry);
    if (T <= 0) return null;
    const vol = estimateVolatility(ticker.toUpperCase());
    const result = blackScholes({
      spotPrice: livePrice,
      strikePrice: strikeNum,
      timeToExpiry: T,
      riskFreeRate: 0.045,
      volatility: vol,
      optionType: holdingType === 'leaps_call' ? 'call' : 'put',
    });
    return result.price;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCash) {
      if (qty <= 0) return;
      onSubmit({ ticker: 'CASH', holdingType: 'cash', quantity: qty, avgCost: 1, openedAt, notes: notes.trim() || undefined });
      return;
    }
    if (!ticker.trim() || qty <= 0 || cost <= 0) return;
    onSubmit({
      ticker: ticker.toUpperCase(),
      holdingType,
      quantity: qty,
      avgCost: cost,
      openedAt,
      expiry: isLeaps && expiry ? expiry : undefined,
      strike: isLeaps && strike ? parseFloat(strike) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,229,196,0.04)',
    border: '1px solid rgba(0,229,196,0.12)',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#e8f0fe',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 14,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#9ab4d4',
    fontSize: 12,
    fontFamily: 'DM Sans, sans-serif',
    marginBottom: 4,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'rgba(13,27,53,0.98)',
          border: '1px solid rgba(0,229,196,0.12)',
          borderRadius: 12,
          padding: '24px',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, margin: 0 }}>
            Add Holding
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Holding Type</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={holdingType}
              onChange={(e) => setHoldingType(e.target.value as HoldingType)}
            >
              <option value="shares">Shares</option>
              <option value="leaps_call">LEAPS Call</option>
              <option value="leaps_put">LEAPS Put</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>

          {!isCash && (
            <div>
              <label style={labelStyle}>Ticker</label>
              <input
                style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'Syne, sans-serif', letterSpacing: '0.05em' }}
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                required
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isCash ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{isCash ? 'Cash Amount ($)' : 'Quantity'}</label>
              <input
                style={inputStyle}
                type="number"
                step={isCash ? '0.01' : '0.001'}
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isCash ? '50000.00' : '100'}
                required
              />
            </div>
            {!isCash && (
              <div>
                <label style={labelStyle}>Avg Cost ($)</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  min="0"
                  value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  placeholder="150.00"
                  required
                />
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Date Opened</label>
            <input
              style={inputStyle}
              type="date"
              value={openedAt}
              onChange={(e) => setOpenedAt(e.target.value)}
              required
            />
          </div>

          {isLeaps && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Strike ($)</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  min="0"
                  value={strike}
                  onChange={(e) => setStrike(e.target.value)}
                  placeholder="150.00"
                />
              </div>
              <div>
                <label style={labelStyle}>Expiry</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input
              style={inputStyle}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note..."
            />
          </div>

          {/* Preview row */}
          {isCash && qty > 0 && (
            <div style={{ background: 'rgba(34,214,143,0.06)', border: '1px solid rgba(34,214,143,0.15)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                Cash balance:{' '}
                <span style={{ color: '#22d68f', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                  ${qty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            </div>
          )}

          {!isCash && qty > 0 && cost > 0 && (
            <div
              style={{
                background: 'rgba(0,229,196,0.04)',
                border: '1px solid rgba(0,229,196,0.08)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                  Est. Market Value:{' '}
                  <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                    {estMV != null ? formatDollars(estMV) : 'N/A'}
                  </span>
                </span>
                <span style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                  Unrealized P&L:{' '}
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      color: estPnl == null ? '#9ab4d4' : estPnl >= 0 ? '#00d68f' : '#ff4d6d',
                    }}
                  >
                    {estPnl != null ? `${estPnl >= 0 ? '+' : ''}${formatDollars(estPnl)}` : 'N/A'}
                  </span>
                </span>
              </div>
              {isLeaps && leapsBSPrice != null && (
                <div style={{ borderTop: '1px solid rgba(0,229,196,0.08)', paddingTop: 6 }}>
                  <span style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                    Est. option value (Black-Scholes):{' '}
                    <span style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      ~${leapsBSPrice.toFixed(2)}/share
                    </span>
                    <span style={{ color: '#4a6a8a', fontSize: 11, marginLeft: 6 }}>
                      (~${(leapsBSPrice * 100).toFixed(0)}/contract) · Default vol estimate
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            style={{
              background: '#00e5c4',
              color: '#0d1b35',
              border: 'none',
              borderRadius: 8,
              padding: '10px 0',
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            Add Holding
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Edit Holding Modal ─────────────────────────────────────────────────────────

interface EditHoldingModalProps {
  holding: HoldingWithPrice;
  onClose: () => void;
  onSubmit: (id: string, data: {
    ticker: string;
    holdingType: HoldingType;
    quantity: number;
    avgCost: number;
    openedAt: string;
    expiry?: string;
    strike?: number;
    notes?: string;
  }) => void;
}

function EditHoldingModal({ holding, onClose, onSubmit }: EditHoldingModalProps) {
  const [ticker, setTicker] = useState(holding.ticker.toUpperCase());
  const [holdingType, setHoldingType] = useState<HoldingType>(holding.holdingType);
  const [quantity, setQuantity] = useState(String(holding.quantity));
  const [avgCost, setAvgCost] = useState(String(holding.avgCost));
  const [openedAt, setOpenedAt] = useState(holding.openedAt);
  const [expiry, setExpiry] = useState(holding.expiry ?? '');
  const [strike, setStrike] = useState(holding.strike != null ? String(holding.strike) : '');
  const [notes, setNotes] = useState(holding.notes ?? '');

  const isCash = holdingType === 'cash';
  const isLeaps = holdingType === 'leaps_call' || holdingType === 'leaps_put';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!qty) return;
    if (isCash) {
      onSubmit(holding.id, { ticker: 'CASH', holdingType: 'cash', quantity: qty, avgCost: 1, openedAt, notes: notes.trim() || undefined });
      return;
    }
    const cost = parseFloat(avgCost);
    if (!cost) return;
    onSubmit(holding.id, {
      ticker: ticker.trim().toUpperCase(),
      holdingType,
      quantity: qty,
      avgCost: cost,
      openedAt,
      expiry: isLeaps && expiry ? expiry : undefined,
      strike: isLeaps && strike ? parseFloat(strike) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(0,229,196,0.15)',
    borderRadius: 6,
    color: '#e8f0fe',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 13,
    padding: '8px 12px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: '#4a6a8a',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'rgba(13,27,53,0.98)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, margin: 0 }}>
              Edit Holding
            </h2>
            <p style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 13, margin: '4px 0 0' }}>
              {holding.ticker}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Holding Type</label>
            <select value={holdingType} onChange={(e) => setHoldingType(e.target.value as HoldingType)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="shares">Shares</option>
              <option value="leaps_call">LEAPS Call</option>
              <option value="leaps_put">LEAPS Put</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>

          {!isCash && (
            <div>
              <label style={labelStyle}>Ticker</label>
              <input
                type="text"
                required
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                style={{ ...inputStyle, textTransform: 'uppercase' }}
                placeholder="e.g. AAPL"
                maxLength={10}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isCash ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{isCash ? 'Cash Amount ($)' : 'Quantity'}</label>
              <input type="number" step={isCash ? '0.01' : '0.001'} min={isCash ? '0.01' : '0.001'} required value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} placeholder={isCash ? 'e.g. 50000' : 'e.g. 100'} />
            </div>
            {!isCash && (
              <div>
                <label style={labelStyle}>Avg Cost ($)</label>
                <input type="number" step="0.01" min="0.01" required value={avgCost} onChange={(e) => setAvgCost(e.target.value)} style={inputStyle} placeholder="e.g. 45.00" />
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Date Opened</label>
            <input type="date" required value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} style={inputStyle} />
          </div>

          {isLeaps && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Strike ($)</label>
                <input type="number" step="0.5" min="0" value={strike} onChange={(e) => setStrike(e.target.value)} style={inputStyle} placeholder="e.g. 50" />
              </div>
              <div>
                <label style={labelStyle}>Expiry</label>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="e.g. core position" />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 600, padding: '10px 0', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" style={{ flex: 2, background: '#00e5c4', border: 'none', borderRadius: 8, color: '#0d1b35', fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 700, padding: '10px 0', cursor: 'pointer' }}>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Close Holding Modal ────────────────────────────────────────────────────────

interface CloseHoldingModalProps {
  holding: HoldingWithPrice;
  onClose: () => void;
  onSubmit: (id: string, closingPrice: number) => void;
}

function CloseHoldingModal({ holding, onClose, onSubmit }: CloseHoldingModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [closingPrice, setClosingPrice] = useState(
    holding.currentPrice != null ? String(holding.currentPrice.toFixed(2)) : ''
  );
  const [closeDate, setCloseDate] = useState(today);

  const price = parseFloat(closingPrice) || 0;
  const pnl = (price - holding.avgCost) * holding.quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (price <= 0) return;
    onSubmit(holding.id, price);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,229,196,0.04)',
    border: '1px solid rgba(0,229,196,0.12)',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#e8f0fe',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 14,
    outline: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'rgba(13,27,53,0.98)',
          border: '1px solid rgba(0,229,196,0.12)',
          borderRadius: 12,
          padding: '24px',
          width: '100%',
          maxWidth: 400,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, margin: 0 }}>
            Close Position
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(0,229,196,0.04)', borderRadius: 8 }}>
          <div style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>
            Closing
          </div>
          <div style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700 }}>
            {holding.ticker}
          </div>
          <div style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
            {holding.quantity} × avg {formatDollars(holding.avgCost)}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', marginBottom: 4 }}>
              Closing Price ($)
            </label>
            <input
              style={inputStyle}
              type="number"
              step="0.01"
              min="0"
              value={closingPrice}
              onChange={(e) => setClosingPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', marginBottom: 4 }}>
              Date Closed
            </label>
            <input
              style={inputStyle}
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </div>

          {price > 0 && (
            <div
              style={{
                background: pnl >= 0 ? 'rgba(0,214,143,0.06)' : 'rgba(255,77,109,0.06)',
                border: `1px solid ${pnl >= 0 ? 'rgba(0,214,143,0.15)' : 'rgba(255,77,109,0.15)'}`,
                borderRadius: 8,
                padding: '10px 14px',
              }}
            >
              <div style={{ color: '#9ab4d4', fontSize: 12, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>
                Realized P&L
              </div>
              <div
                style={{
                  color: pnl >= 0 ? '#00d68f' : '#ff4d6d',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {pnl >= 0 ? '+' : ''}{formatDollars(pnl)}
              </div>
            </div>
          )}

          <button
            type="submit"
            style={{
              background: 'rgba(255,77,109,0.15)',
              color: '#ff4d6d',
              border: '1px solid rgba(255,77,109,0.25)',
              borderRadius: 8,
              padding: '10px 0',
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Close Position
          </button>
        </form>
      </div>
    </div>
  );
}

// ── CSP Coverage Panel ─────────────────────────────────────────────────────────

interface CspCoveragePanelProps {
  totalCash: number;
  cspObligation: number;
  cspUsedPct: number;
  totalCSPContracts: number;
  isLoading: boolean;
}

function CspCoveragePanel({ totalCash, cspObligation, cspUsedPct, totalCSPContracts, isLoading }: CspCoveragePanelProps) {
  const isUncovered = !isFinite(cspUsedPct) || cspUsedPct > 100;
  const isTight = cspUsedPct > 80 && cspUsedPct <= 100;
  const isHealthy = cspUsedPct <= 80;

  const statusColor = isUncovered ? '#ff4d6d' : isTight ? '#f5c842' : '#00d68f';
  const barColor = isUncovered ? '#ff4d6d' : isTight ? '#f5c842' : '#00d68f';
  const barPct = isFinite(cspUsedPct) ? Math.min(cspUsedPct, 100) : 100;

  const statusLabel = isUncovered
    ? 'On Margin — Not Cash Secured'
    : isTight
    ? 'Nearly Fully Allocated'
    : isHealthy
    ? 'Fully Cash Secured'
    : '';

  const statusIcon = isUncovered ? '✗' : isTight ? '⚠' : '✓';

  return (
    <div
      style={{
        background: 'rgba(13,27,53,0.6)',
        border: `1px solid ${isUncovered ? 'rgba(255,77,109,0.2)' : isTight ? 'rgba(245,200,66,0.2)' : 'rgba(0,214,143,0.15)'}`,
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            CSP Cash Coverage
          </span>
          {!isLoading && (
            <span
              style={{
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}40`,
                color: statusColor,
                borderRadius: 4,
                padding: '1px 7px',
                fontSize: 11,
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: 700,
              }}
            >
              {statusIcon} {statusLabel}
            </span>
          )}
        </div>
        {!isLoading && totalCSPContracts > 0 && (
          <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>
            {totalCSPContracts} open contract{totalCSPContracts !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Loading...</div>
      ) : (
        <>
          {/* Numbers row */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 3 }}>Cash Available</div>
              <div style={{ color: '#22d68f', fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700 }}>
                {totalCash > 0 ? formatDollars(totalCash) : <span style={{ color: '#4a6a8a' }}>No cash holdings</span>}
              </div>
            </div>
            <div>
              <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 3 }}>CSP Obligation</div>
              <div style={{ color: isUncovered ? '#ff4d6d' : '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700 }}>
                {cspObligation > 0 ? formatDollars(cspObligation) : <span style={{ color: '#4a6a8a' }}>No open CSPs</span>}
              </div>
              {cspObligation > 0 && (
                <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 1 }}>
                  strike × contracts × 100
                </div>
              )}
            </div>
            {totalCash > 0 && cspObligation > 0 && (
              <div>
                <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 3 }}>Cash Used</div>
                <div style={{ color: statusColor, fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700 }}>
                  {isFinite(cspUsedPct) ? `${cspUsedPct.toFixed(1)}%` : '∞'}
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {totalCash > 0 && (
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${barPct}%`,
                    background: barColor,
                    borderRadius: 3,
                    transition: 'width 0.4s ease',
                    boxShadow: `0 0 8px ${barColor}60`,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>$0</span>
                <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>{formatDollars(totalCash)}</span>
              </div>
            </div>
          )}

          {/* No cash warning */}
          {totalCash === 0 && cspObligation > 0 && (
            <div
              style={{
                background: 'rgba(255,77,109,0.06)',
                border: '1px solid rgba(255,77,109,0.15)',
                borderRadius: 6,
                padding: '8px 12px',
                marginTop: 4,
                color: '#ff4d6d',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 12,
              }}
            >
              Add a Cash holding to track whether your CSPs are fully cash-secured.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Portfolio Page ────────────────────────────────────────────────────────

export function Portfolio() {
  const { isPaperMode } = usePaperMode();
  if (isPaperMode) return <PaperPortfolio />;
  return <RealPortfolio />;
}

function RealPortfolio() {
  const navigate = useNavigate();
  const {
    holdingsWithPrice,
    snapshots,
    isLoading,
    addHolding,
    closeHolding,
    editHolding,
    totalCost,
    unrealizedPnl,
    realizedPnl,
    optionsPremium,
  } = usePortfolio();
  const { openPositions } = usePositions();

  const [range, setRange] = useState<RangeKey>('3M');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [sgdRate, setSgdRate] = useState<number>(SGD_FALLBACK_RATE);
  const [rateLoading, setRateLoading] = useState(false);
  const sgdRateFetched = useRef(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [closingHolding, setClosingHolding] = useState<HoldingWithPrice | null>(null);
  const [editingHolding, setEditingHolding] = useState<HoldingWithPrice | null>(null);
  const [leapsCalcHolding, setLeapsCalcHolding] = useState<HoldingWithPrice | null>(null);

  // Collect unique non-cash tickers for WebSocket subscription
  const holdingTickers = useMemo(
    () => [...new Set(
      holdingsWithPrice
        .filter((h) => h.holdingType !== 'cash')
        .map((h) => h.ticker.toUpperCase())
    )],
    [holdingsWithPrice]
  );
  const { prices: wsPrices, wsStatus } = useRealtimePrices(holdingTickers);

  // Merge REST prices with WebSocket prices (WS takes precedence)
  const livePriceMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const h of holdingsWithPrice) {
      map.set(h.ticker.toUpperCase(), h.currentPrice ?? null);
    }
    // Override with fresher WebSocket prices
    wsPrices.forEach((price, ticker) => map.set(ticker, price));
    return map;
  }, [holdingsWithPrice, wsPrices]);

  // Live total value using WebSocket prices where available
  const liveTotalValue = useMemo(() => {
    return holdingsWithPrice.reduce((acc, h) => {
      if (h.holdingType === 'cash') return acc + h.quantity;
      const livePrice = wsPrices.get(h.ticker.toUpperCase()) ?? h.currentPrice ?? 0;
      return acc + livePrice * h.quantity;
    }, 0);
  }, [holdingsWithPrice, wsPrices]);

  // Live unrealized P&L using WebSocket prices where available
  const liveUnrealizedPnl = useMemo(() => {
    return holdingsWithPrice.reduce((acc, h) => {
      if (h.holdingType === 'cash') return acc;
      const livePrice = wsPrices.get(h.ticker.toUpperCase()) ?? h.currentPrice ?? 0;
      const costBasis = (h.avgCost ?? 0) * h.quantity;
      return acc + (livePrice * h.quantity - costBasis);
    }, 0);
  }, [holdingsWithPrice, wsPrices]);

  const filteredSnapshots = filterSnapshotsByRange(snapshots, range);

  const chartData = filteredSnapshots.map((s) => ({
    date: formatDate(s.snapshotDate),
    portfolioValue: s.totalValue,
    costBasis: s.totalCost,
  }));

  const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  const wheelTotal = openPositions.reduce(
    (acc, p) => acc + p.premiumCollected,
    0
  );

  // ── CSP Cash Coverage ────────────────────────────────────────────────────────
  const totalCashBalance = holdingsWithPrice
    .filter((h) => h.holdingType === 'cash')
    .reduce((acc, h) => acc + h.quantity, 0);

  const openCSPs = openPositions.filter((p) => p.strategy === 'CSP');
  const totalCSPContracts = openCSPs.reduce((acc, p) => acc + p.contracts, 0);
  const cspObligation = openCSPs.reduce((acc, p) => acc + p.strike * p.contracts * 100, 0);
  const showCspPanel = totalCashBalance > 0 || openCSPs.length > 0;
  const cspUsedPct = totalCashBalance > 0 ? Math.min((cspObligation / totalCashBalance) * 100, 999) : (cspObligation > 0 ? Infinity : 0);

  const handleAddHolding = async (data: Parameters<typeof addHolding>[0]) => {
    await addHolding(data);
    setShowAddModal(false);
  };

  const handleCloseHolding = async (id: string, price: number) => {
    await closeHolding(id, price);
    setClosingHolding(null);
  };

  const handleEditHolding = async (id: string, data: Parameters<typeof editHolding>[1]) => {
    await editHolding(id, data);
    setEditingHolding(null);
  };

  // ── Currency toggle ──────────────────────────────────────────────────────────
  const handleCurrencyToggle = async (next: Currency) => {
    if (next === currency) return;
    if (next === 'SGD' && !sgdRateFetched.current) {
      setRateLoading(true);
      try {
        const quote = await getQuote('OANDA:USD_SGD');
        if (quote.c > 0) setSgdRate(quote.c);
      } catch {
        // fall back to constant — already set
      } finally {
        sgdRateFetched.current = true;
        setRateLoading(false);
      }
    }
    setCurrency(next);
  };

  const convert = (usd: number) => currency === 'SGD' ? usd * sgdRate : usd;
  const fmtCard = (usd: number) => {
    const val = convert(usd);
    const prefix = currency === 'SGD' ? 'S$' : '$';
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
  };

  // ── Stat cards ──────────────────────────────────────────────────────────────

  const currencyTag = rateLoading ? '…' : `(${currency})`;
  const statCards = [
    {
      label: 'Total Portfolio Value',
      currency: currencyTag,
      value: fmtCard(liveTotalValue),
      accent: '#00e5c4',
      sub: null,
    },
    {
      label: 'Total Cost Basis',
      currency: currencyTag,
      value: fmtCard(totalCost),
      accent: '#9ab4d4',
      sub: null,
    },
    {
      label: 'Unrealized P&L',
      currency: currencyTag,
      value: fmtCard(liveUnrealizedPnl),
      accent: liveUnrealizedPnl >= 0 ? '#00d68f' : '#ff4d6d',
      sub: `${unrealizedPnlPct >= 0 ? '+' : ''}${unrealizedPnlPct.toFixed(2)}%`,
      subColor: liveUnrealizedPnl >= 0 ? '#00d68f' : '#ff4d6d',
    },
    {
      label: 'Realized P&L',
      currency: currencyTag,
      value: fmtCard(realizedPnl),
      accent: realizedPnl >= 0 ? '#00d68f' : '#ff4d6d',
      sub: null,
    },
    {
      label: 'Options Premium Collected',
      currency: currencyTag,
      value: fmtCard(optionsPremium),
      accent: '#00c6f5',
      sub: null,
    },
  ];

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1
                style={{
                  color: '#e8f0fe',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 26,
                  fontWeight: 700,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Portfolio
              </h1>
              <WebSocketStatus status={wsStatus} />
            </div>
            <p style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', fontSize: 14, margin: '4px 0 0' }}>
              Track your holdings and performance over time
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
              color: '#050d1a',
              border: 'none',
              fontFamily: 'DM Sans, sans-serif',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 4px 16px rgba(0,229,196,0.2)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Add Holding
          </button>
        </div>

        {/* Section A — Stat Cards */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10 }}>
          <div
            style={{
              display: 'flex',
              background: 'rgba(13,27,53,0.6)',
              border: '1px solid rgba(0,229,196,0.08)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            {(['USD', 'SGD'] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => handleCurrencyToggle(c)}
                style={{
                  background: currency === c ? 'rgba(0,229,196,0.12)' : 'transparent',
                  border: currency === c ? '1px solid rgba(0,229,196,0.25)' : '1px solid transparent',
                  borderRadius: 5,
                  color: currency === c ? '#00e5c4' : '#4a6a8a',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  transition: 'all 0.15s ease',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            marginBottom: 28,
            paddingBottom: 4,
          }}
        >
          {statCards.map((card) => (
            <div
              key={card.label}
              style={{
                background: 'rgba(13,27,53,0.6)',
                border: '1px solid rgba(0,229,196,0.08)',
                borderRadius: 12,
                padding: '16px 20px',
                minWidth: 170,
                flex: '1 1 170px',
              }}
            >
              <div
                style={{
                  color: '#4a6a8a',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 2,
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  color: '#2e4a6a',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  marginBottom: 6,
                }}
              >
                {card.currency}
              </div>
              <div
                style={{
                  color: card.accent,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                {isLoading ? '—' : card.value}
              </div>
              {card.sub && (
                <div
                  style={{
                    color: card.subColor ?? '#9ab4d4',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {card.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Section B — CSP Cash Coverage */}
        {showCspPanel && (
          <CspCoveragePanel
            totalCash={totalCashBalance}
            cspObligation={cspObligation}
            cspUsedPct={cspUsedPct}
            totalCSPContracts={totalCSPContracts}
            isLoading={isLoading}
          />
        )}

        {/* Section C — P&L Chart */}
        <div
          style={{
            background: 'rgba(13,27,53,0.6)',
            border: '1px solid rgba(0,229,196,0.08)',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <h2
              style={{
                color: '#4a6a8a',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Portfolio Value History
            </h2>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    background: range === r ? 'rgba(0,229,196,0.12)' : 'transparent',
                    border: `1px solid ${range === r ? 'rgba(0,229,196,0.25)' : 'rgba(0,229,196,0.08)'}`,
                    borderRadius: 6,
                    color: range === r ? '#00e5c4' : '#4a6a8a',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {chartData.length === 0 ? (
            <div
              style={{
                height: 220,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4a6a8a',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              No history yet — portfolio value snapshots are saved each time you visit this page
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5c4" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#00e5c4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,196,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#4a6a8a', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#4a6a8a', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCurrency}
                  width={56}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,229,196,0.1)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="costBasis"
                  name="costBasis"
                  stroke="#4a6a8a"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="portfolioValue"
                  name="portfolioValue"
                  stroke="#00e5c4"
                  strokeWidth={2}
                  fill="url(#portfolioGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Section C — Holdings Table */}
        <div
          style={{
            background: 'rgba(13,27,53,0.6)',
            border: '1px solid rgba(0,229,196,0.08)',
            borderRadius: 12,
            marginBottom: 24,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: holdingsWithPrice.length > 0 ? '1px solid rgba(0,229,196,0.06)' : 'none',
            }}
          >
            <h2
              style={{
                color: '#4a6a8a',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Holdings{' '}
              {holdingsWithPrice.length > 0 && (
                <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontWeight: 400 }}>
                  ({holdingsWithPrice.length})
                </span>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 14 }}>
              Loading holdings...
            </div>
          ) : holdingsWithPrice.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 14, marginBottom: 16 }}>
                No open holdings yet
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  background: 'rgba(0,229,196,0.1)',
                  border: '1px solid rgba(0,229,196,0.2)',
                  borderRadius: 8,
                  color: '#00e5c4',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '10px 20px',
                  cursor: 'pointer',
                }}
              >
                Add Your First Holding
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,229,196,0.06)' }}>
                      {['Ticker', 'Type', 'Qty', 'Avg Cost', 'Current Price', 'Market Value', 'Unrealized P&L', 'P&L%', 'Expiry', 'Actions'].map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: '10px 14px',
                            textAlign: col === 'Actions' ? 'center' : 'left',
                            color: '#4a6a8a',
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdingsWithPrice.map((h) => {
                      const pnlColor = h.unrealizedPnl == null ? '#9ab4d4' : h.unrealizedPnl >= 0 ? '#00d68f' : '#ff4d6d';
                      const dte = h.expiry ? getDte(h.expiry) : null;
                      return (
                        <tr
                          key={h.id}
                          className="stock-row-hover"
                          style={{ borderBottom: '1px solid rgba(0,229,196,0.04)' }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                              {h.ticker}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                background: `${holdingTypeBadgeColor(h.holdingType)}18`,
                                border: `1px solid ${holdingTypeBadgeColor(h.holdingType)}30`,
                                color: holdingTypeBadgeColor(h.holdingType),
                                borderRadius: 4,
                                padding: '2px 8px',
                                fontSize: 11,
                                fontFamily: 'DM Sans, sans-serif',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {holdingTypeLabel(h.holdingType)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                            {h.holdingType === 'cash' ? formatDollars(h.quantity) : h.quantity.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                            {h.holdingType === 'cash' ? '—' : formatDollars(h.avgCost)}
                          </td>
                          {(h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') && h.strike != null && h.expiry ? (
                            <LeapsTableCells
                              ticker={h.ticker}
                              optionType={h.holdingType === 'leaps_call' ? 'call' : 'put'}
                              strike={h.strike}
                              expiry={h.expiry}
                              quantity={h.quantity}
                              avgCost={h.avgCost}
                            />
                          ) : h.holdingType === 'cash' ? (
                            <>
                              <td style={{ padding: '12px 14px', color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>—</td>
                              <td style={{ padding: '12px 14px', color: '#22d68f', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700 }}>
                                {formatDollars(h.quantity)}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>—</td>
                              <td style={{ padding: '12px 14px', color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>—</td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '12px 14px', color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                                {h.currentPrice != null ? formatDollars(h.currentPrice) : '—'}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                                {h.marketValue != null ? formatDollars(h.marketValue) : '—'}
                              </td>
                              <td style={{ padding: '12px 14px', color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                                {h.unrealizedPnl != null ? `${h.unrealizedPnl >= 0 ? '+' : ''}${formatDollars(h.unrealizedPnl)}` : '—'}
                              </td>
                              <td style={{ padding: '12px 14px', color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                                {h.unrealizedPnlPct != null ? `${h.unrealizedPnlPct >= 0 ? '+' : ''}${h.unrealizedPnlPct.toFixed(2)}%` : '—'}
                              </td>
                            </>
                          )}
                          <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                            {h.expiry && dte != null ? (
                              <span style={{ color: dte < 30 ? '#ff4d6d' : '#9ab4d4' }}>
                                {new Date(h.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                                <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.8 }}>({dte}d)</span>
                              </span>
                            ) : (
                              <span style={{ color: '#4a6a8a' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                              {(h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') && h.strike != null && h.expiry && (
                                <button
                                  onClick={() => setLeapsCalcHolding(h)}
                                  style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 5, color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  title="Open LEAPS Calculator"
                                >
                                  ⊞ Calc
                                </button>
                              )}
                              {h.holdingType !== 'cash' && (
                                <button
                                  onClick={() => navigate(`/stock/${h.ticker}`)}
                                  style={{ background: 'rgba(0,198,245,0.08)', border: '1px solid rgba(0,198,245,0.15)', borderRadius: 5, color: '#00c6f5', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  View
                                </button>
                              )}
                              <button
                                onClick={() => setEditingHolding(h)}
                                style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 5, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setClosingHolding(h)}
                                style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.15)', borderRadius: 5, color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}
                              >
                                Close
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden" style={{ padding: '4px 0' }}>
                {holdingsWithPrice.map((h) => {
                  const pnlColor = h.unrealizedPnl == null ? '#9ab4d4' : h.unrealizedPnl >= 0 ? '#00d68f' : '#ff4d6d';
                  const dte = h.expiry ? getDte(h.expiry) : null;
                  return (
                    <div
                      key={h.id}
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid rgba(0,229,196,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700 }}>
                            {h.ticker}
                          </span>
                          <span
                            style={{
                              background: `${holdingTypeBadgeColor(h.holdingType)}18`,
                              border: `1px solid ${holdingTypeBadgeColor(h.holdingType)}30`,
                              color: holdingTypeBadgeColor(h.holdingType),
                              borderRadius: 4,
                              padding: '1px 6px',
                              fontSize: 10,
                              fontFamily: 'DM Sans, sans-serif',
                              fontWeight: 600,
                            }}
                          >
                            {holdingTypeLabel(h.holdingType)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {(h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') && h.strike != null && h.expiry && (
                            <button
                              onClick={() => setLeapsCalcHolding(h)}
                              style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 5, color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}
                            >
                              Calc
                            </button>
                          )}
                          {h.holdingType !== 'cash' && (
                            <button
                              onClick={() => navigate(`/stock/${h.ticker}`)}
                              style={{ background: 'rgba(0,198,245,0.08)', border: '1px solid rgba(0,198,245,0.15)', borderRadius: 5, color: '#00c6f5', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => setEditingHolding(h)}
                            style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 5, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setClosingHolding(h)}
                            style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.15)', borderRadius: 5, color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      {h.holdingType === 'cash' ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>Balance</div>
                          <div style={{ color: '#22d68f', fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700 }}>
                            {formatDollars(h.quantity)}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <div style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>Qty / Avg Cost</div>
                            <div style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                              {h.quantity.toLocaleString()} @ {formatDollars(h.avgCost)}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>Expiry</div>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                              {h.expiry && dte != null ? (
                                <span style={{ color: dte < 30 ? '#ff4d6d' : '#9ab4d4' }}>
                                  {new Date(h.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                                </span>
                              ) : (
                                <span style={{ color: '#4a6a8a' }}>—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* LEAPS: BS-computed values */}
                      {(h.holdingType === 'leaps_call' || h.holdingType === 'leaps_put') && h.strike != null && h.expiry ? (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,229,196,0.06)' }}>
                          <LeapsMobileValues
                            ticker={h.ticker}
                            optionType={h.holdingType === 'leaps_call' ? 'call' : 'put'}
                            strike={h.strike}
                            expiry={h.expiry}
                            quantity={h.quantity}
                            avgCost={h.avgCost}
                          />
                        </div>
                      ) : (
                        /* Non-LEAPS: show standard market value + P&L */
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                          <div>
                            <div style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>Market Value</div>
                            <div style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                              {h.marketValue != null ? formatDollars(h.marketValue) : '—'}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>Unrealized P&L</div>
                            <div style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                              {h.unrealizedPnl != null
                                ? `${h.unrealizedPnl >= 0 ? '+' : ''}${formatDollars(h.unrealizedPnl)}`
                                : '—'}
                              {h.unrealizedPnlPct != null && (
                                <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>
                                  ({h.unrealizedPnlPct >= 0 ? '+' : ''}{h.unrealizedPnlPct.toFixed(2)}%)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Section D — Wheel Positions (read-only) */}
        <div
          style={{
            background: 'rgba(13,27,53,0.6)',
            border: '1px solid rgba(0,229,196,0.08)',
            borderRadius: 12,
            marginBottom: 24,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: openPositions.length > 0 ? '1px solid rgba(0,229,196,0.06)' : 'none',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <h2
                style={{
                  color: '#4a6a8a',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                Wheel Positions{' '}
                {openPositions.length > 0 && (
                  <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontWeight: 400 }}>
                    ({openPositions.length})
                  </span>
                )}
              </h2>
              <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginTop: 2 }}>
                Manage in Wheel Tracker
              </div>
            </div>
            <button
              onClick={() => navigate('/wheel')}
              style={{
                background: 'rgba(0,229,196,0.06)',
                border: '1px solid rgba(0,229,196,0.12)',
                borderRadius: 6,
                color: '#00e5c4',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 12px',
                cursor: 'pointer',
              }}
            >
              Open Tracker →
            </button>
          </div>

          {openPositions.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 14 }}>
              No open wheel positions
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,229,196,0.06)' }}>
                      {['Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'DTE'].map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: '10px 14px',
                            textAlign: 'left',
                            color: '#4a6a8a',
                            fontFamily: 'DM Sans, sans-serif',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openPositions.map((p) => (
                      <tr key={p.id} className="stock-row-hover" style={{ borderBottom: '1px solid rgba(0,229,196,0.04)' }}>
                        <td style={{ padding: '12px 14px', color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700 }}>
                          {p.ticker}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              background: p.strategy === 'CSP' ? 'rgba(0,229,196,0.1)' : 'rgba(0,198,245,0.1)',
                              border: `1px solid ${p.strategy === 'CSP' ? 'rgba(0,229,196,0.2)' : 'rgba(0,198,245,0.2)'}`,
                              color: p.strategy === 'CSP' ? '#00e5c4' : '#00c6f5',
                              borderRadius: 4,
                              padding: '2px 7px',
                              fontSize: 11,
                              fontFamily: 'DM Sans, sans-serif',
                              fontWeight: 600,
                            }}
                          >
                            {p.strategy}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                          ${p.strike.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                          {new Date(p.expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#00d68f', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                          {formatDollars(p.premiumCollected)}
                        </td>
                        <td style={{ padding: '12px 14px', color: p.daysToExpiry < 7 ? '#ff4d6d' : p.daysToExpiry < 21 ? '#f5c842' : '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                          {p.daysToExpiry}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Wheel subtotal */}
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid rgba(0,229,196,0.06)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>
                  Total Open Premium:
                </span>
                <span style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700 }}>
                  {formatDollars(wheelTotal)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddHoldingModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddHolding}
          livePrices={livePriceMap}
        />
      )}

      {editingHolding && (
        <EditHoldingModal
          holding={editingHolding}
          onClose={() => setEditingHolding(null)}
          onSubmit={handleEditHolding}
        />
      )}

      {closingHolding && (
        <CloseHoldingModal
          holding={closingHolding}
          onClose={() => setClosingHolding(null)}
          onSubmit={handleCloseHolding}
        />
      )}

      <LeapsCalculator
        isOpen={leapsCalcHolding != null}
        onClose={() => setLeapsCalcHolding(null)}
        initialTicker={leapsCalcHolding?.ticker}
        initialOptionType={leapsCalcHolding?.holdingType === 'leaps_put' ? 'put' : 'call'}
        initialStrike={leapsCalcHolding?.strike}
        initialExpiry={leapsCalcHolding?.expiry}
        initialContracts={leapsCalcHolding?.quantity}
        initialCostBasis={leapsCalcHolding?.avgCost}
      />
    </div>
  );
}
