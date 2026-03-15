import { useState, useEffect, useCallback } from 'react';
import { getQuote } from '../lib/finnhub';
import { getIVData } from '../lib/polygon';
import {
  blackScholes,
  yearsToExpiry,
  estimateVolatility,
  getMoneynessLevel,
  MONEYNESS_COLORS,
  type BlackScholesResult,
} from '../lib/blackScholes';

export interface LeapsCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  // Optional prefill from portfolio row
  initialTicker?: string;
  initialOptionType?: 'call' | 'put';
  initialStrike?: number;
  initialExpiry?: string;
  initialContracts?: number;
  initialCostBasis?: number; // per contract (per-share basis)
}

interface SensitivityRow {
  priceDeltaPct: number;
  underlyingPrice: number;
  optionValue: number;
  totalValue: number;
  pnl: number | null;
}

type IVSourceLabel = 'Live HV30' | 'Default estimate' | 'Manual';

export function LeapsCalculator({
  isOpen,
  onClose,
  initialTicker = '',
  initialOptionType = 'call',
  initialStrike,
  initialExpiry,
  initialContracts = 1,
  initialCostBasis,
}: LeapsCalculatorProps) {
  const today = new Date().toISOString().split('T')[0];
  const oneYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];

  // ── Inputs ──────────────────────────────────────────────────────────────────
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [optionType, setOptionType] = useState<'call' | 'put'>(initialOptionType);
  const [strike, setStrike] = useState(initialStrike != null ? String(initialStrike) : '');
  const [expiry, setExpiry] = useState(initialExpiry ?? oneYear);
  const [ivPct, setIvPct] = useState('45');         // displayed as %
  const [rfr, setRfr] = useState('4.5');             // displayed as %
  const [contracts, setContracts] = useState(String(initialContracts));
  const [costBasis, setCostBasis] = useState(initialCostBasis != null ? String(initialCostBasis) : '');

  // ── Live data state ──────────────────────────────────────────────────────────
  const [spotPrice, setSpotPrice] = useState<number | null>(null);
  const [spotLoading, setSpotLoading] = useState(false);
  const [ivSourceLabel, setIvSourceLabel] = useState<IVSourceLabel>('Default estimate');
  const [ivManuallyEdited, setIvManuallyEdited] = useState(false);

  // Sync prefill when props change (re-opened with new position)
  useEffect(() => {
    if (isOpen) {
      setTicker(initialTicker.toUpperCase());
      setOptionType(initialOptionType);
      setStrike(initialStrike != null ? String(initialStrike) : '');
      setExpiry(initialExpiry ?? oneYear);
      setContracts(String(initialContracts));
      setCostBasis(initialCostBasis != null ? String(initialCostBasis) : '');
      setIvManuallyEdited(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTicker, initialOptionType, initialStrike, initialExpiry, initialContracts, initialCostBasis]);

  // Fetch spot + IV when ticker changes (or calculator opens)
  const fetchMarketData = useCallback(async (sym: string) => {
    if (!sym) return;
    setSpotLoading(true);
    const [quoteRes, ivRes] = await Promise.allSettled([
      getQuote(sym),
      getIVData(sym),
    ]);

    if (quoteRes.status === 'fulfilled') {
      const q = quoteRes.value;
      const price = q.c > 0 ? q.c : (q.pc > 0 ? q.pc : null);
      setSpotPrice(price);
    }

    if (!ivManuallyEdited) {
      if (ivRes.status === 'fulfilled' && ivRes.value.currentHV > 0) {
        setIvPct(ivRes.value.currentHV.toFixed(0));
        setIvSourceLabel('Live HV30');
      } else {
        const defaultVol = estimateVolatility(sym);
        setIvPct((defaultVol * 100).toFixed(0));
        setIvSourceLabel('Default estimate');
      }
    }
    setSpotLoading(false);
  }, [ivManuallyEdited]);

  // Fetch on ticker blur
  const handleTickerBlur = () => {
    if (ticker) void fetchMarketData(ticker);
  };

  // Also fetch when calculator opens with a pre-filled ticker
  useEffect(() => {
    if (isOpen && initialTicker) {
      void fetchMarketData(initialTicker.toUpperCase());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTicker]);

  // ── Derived calculation ──────────────────────────────────────────────────────
  const S = spotPrice ?? 0;
  const K = parseFloat(strike) || 0;
  const T = yearsToExpiry(expiry);
  const iv = (parseFloat(ivPct) || 0) / 100;
  const r = (parseFloat(rfr) || 0) / 100;
  const numContracts = parseInt(contracts) || 1;
  const basis = parseFloat(costBasis) || null;

  const canCompute = S > 0 && K > 0 && T > 0 && iv > 0;
  let result: BlackScholesResult | null = null;
  if (canCompute) {
    result = blackScholes({ spotPrice: S, strikePrice: K, timeToExpiry: T, riskFreeRate: r, volatility: iv, optionType });
  }

  const totalPositionValue = result ? result.price * numContracts * 100 : null;
  const costBasisTotal = basis ? basis * numContracts * 100 : null;
  const pnl = totalPositionValue != null && costBasisTotal != null ? totalPositionValue - costBasisTotal : null;
  const pnlPct = pnl != null && costBasisTotal != null && costBasisTotal > 0 ? (pnl / costBasisTotal) * 100 : null;

  const breakEven = result
    ? optionType === 'call' ? K + result.price : K - result.price
    : null;

  const moneynessLevel = result ? getMoneynessLevel(result.moneyness, optionType) : null;
  const moneynessColor = moneynessLevel ? MONEYNESS_COLORS[moneynessLevel] : '#4a6a8a';

  // ── Sensitivity table ────────────────────────────────────────────────────────
  const SENSITIVITY_PCTS = [-20, -10, -5, 0, 5, 10, 20];
  const sensitivityRows: SensitivityRow[] = canCompute && result
    ? SENSITIVITY_PCTS.map((pct) => {
        const adjSpot = S * (1 + pct / 100);
        const adjResult = blackScholes({ spotPrice: adjSpot, strikePrice: K, timeToExpiry: T, riskFreeRate: r, volatility: iv, optionType });
        const totalVal = adjResult.price * numContracts * 100;
        const rowPnl = costBasisTotal != null ? totalVal - costBasisTotal : null;
        return { priceDeltaPct: pct, underlyingPrice: adjSpot, optionValue: adjResult.price, totalValue: totalVal, pnl: rowPnl };
      })
    : [];

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(0,229,196,0.15)',
    borderRadius: 6,
    color: '#e8f0fe',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 13,
    padding: '7px 10px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: '#4a6a8a',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 4,
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 201,
          width: '100%',
          maxWidth: 520,
          background: 'rgba(9,18,40,0.98)',
          borderLeft: '1px solid rgba(0,229,196,0.12)',
          overflowY: 'auto',
          padding: '24px 24px 40px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, margin: 0 }}>
              LEAPS Calculator
            </h2>
            <p style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, margin: '4px 0 0' }}>
              Black-Scholes theoretical valuation
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#9ab4d4', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '6px 10px' }}
          >
            ×
          </button>
        </div>

        {/* ── Inputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {/* Ticker */}
          <div>
            <label style={labelStyle}>Ticker</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onBlur={handleTickerBlur}
                placeholder="e.g. NVDA"
                maxLength={10}
                style={{ ...inputStyle, textTransform: 'uppercase', flex: 1 }}
              />
              {spotLoading && (
                <div style={{ display: 'flex', alignItems: 'center', color: '#4a6a8a', fontSize: 11, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                  Fetching…
                </div>
              )}
              {spotPrice != null && !spotLoading && (
                <div style={{ display: 'flex', alignItems: 'center', color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  ${spotPrice.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Option type toggle */}
          <div>
            <label style={labelStyle}>Option Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['call', 'put'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOptionType(t)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 6,
                    border: `1px solid ${optionType === t ? (t === 'call' ? 'rgba(0,229,196,0.4)' : 'rgba(245,200,66,0.4)') : 'rgba(255,255,255,0.08)'}`,
                    background: optionType === t ? (t === 'call' ? 'rgba(0,229,196,0.1)' : 'rgba(245,200,66,0.1)') : 'transparent',
                    color: optionType === t ? (t === 'call' ? '#00e5c4' : '#f5c842') : '#4a6a8a',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'call' ? '▲ Call' : '▼ Put'}
                </button>
              ))}
            </div>
          </div>

          {/* Strike + Expiry */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Strike ($)</label>
              <input type="number" step="0.5" min="0.5" value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="e.g. 150" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expiry</label>
              <input type="date" value={expiry} min={today} onChange={(e) => setExpiry(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* IV + RFR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>
                Implied Vol (%)
                <span style={{ color: '#2a4060', fontWeight: 400, letterSpacing: 0, textTransform: 'none', marginLeft: 4 }}>
                  — {ivSourceLabel}
                </span>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="500"
                value={ivPct}
                onChange={(e) => { setIvPct(e.target.value); setIvManuallyEdited(true); setIvSourceLabel('Manual'); }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Risk-Free Rate (%)</label>
              <input type="number" step="0.1" min="0" max="20" value={rfr} onChange={(e) => setRfr(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Contracts + Cost Basis */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Contracts</label>
              <input type="number" step="1" min="1" value={contracts} onChange={(e) => setContracts(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cost Basis ($/contract)</label>
              <input type="number" step="0.01" min="0" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} placeholder="Optional" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* ── Output ── */}
        {!canCompute ? (
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
            Enter ticker, strike, and expiry to compute
          </div>
        ) : result && (
          <>
            {/* Main output card */}
            <div style={{ background: 'rgba(0,229,196,0.04)', border: '1px solid rgba(0,229,196,0.12)', borderRadius: 10, padding: '16px 18px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Theoretical Price
                  </div>
                  <div style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                    ${result.price.toFixed(2)}
                  </div>
                  <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, marginTop: 4 }}>
                    per share · ${(result.price * 100).toFixed(0)} per contract
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                    Total Position
                  </div>
                  <div style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                    ${totalPositionValue!.toFixed(0)}
                  </div>
                  <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, marginTop: 4 }}>
                    {numContracts} contract{numContracts !== 1 ? 's' : ''} × 100
                  </div>
                </div>
              </div>

              {/* Greeks row */}
              <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,229,196,0.08)', flexWrap: 'wrap' }}>
                {[
                  { g: 'Delta', sym: 'Δ', val: result.delta.toFixed(3), color: '#00e5c4' },
                  { g: 'Gamma', sym: 'Γ', val: result.gamma.toFixed(4), color: '#9ab4d4' },
                  { g: 'Theta', sym: 'Θ', val: `${result.theta.toFixed(3)}/day`, color: '#ff8c42' },
                  { g: 'Vega',  sym: 'V', val: `${result.vega.toFixed(3)}/1%`, color: '#9ab4d4' },
                ].map(({ g, sym, val, color }) => (
                  <div key={g} style={{ minWidth: 70 }}>
                    <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{g}</div>
                    <div style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>{sym} {val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Value breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Value Breakdown</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>Intrinsic</span>
                  <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>${result.intrinsicValue.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>Time value</span>
                  <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>${result.timeValue.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>Moneyness</span>
                  <span style={{
                    background: `${moneynessColor}18`,
                    border: `1px solid ${moneynessColor}35`,
                    color: moneynessColor,
                    borderRadius: 3,
                    padding: '0px 5px',
                    fontSize: 10,
                    fontFamily: 'DM Sans, sans-serif',
                    fontWeight: 600,
                  }}>{moneynessLevel}</span>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Position P&L</div>
                {pnl != null ? (
                  <>
                    <div style={{ color: pnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700 }}>
                      {pnl >= 0 ? '+' : ''}{pnl < 0 ? '-$' : '$'}{Math.abs(pnl).toFixed(0)}
                    </div>
                    <div style={{ color: pnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginTop: 2 }}>
                      {pnlPct != null ? `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%` : ''}
                    </div>
                    <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 4 }}>
                      vs ${costBasisTotal!.toFixed(0)} cost basis
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, marginTop: 8 }}>
                    Enter cost basis to see P&L
                  </div>
                )}
                {breakEven != null && (
                  <div style={{ marginTop: 8, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>
                    Break-even at expiry: <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>${breakEven.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sensitivity table */}
            {sensitivityRows.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,229,196,0.06)' }}>
                  <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Sensitivity — Underlying Price Moves
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,229,196,0.06)' }}>
                      {['Move', 'Underlying', 'Option', 'Total', pnl != null ? 'P&L' : ''].filter(Boolean).map((h) => (
                        <th key={h} style={{ padding: '6px 10px', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: h === 'Move' ? 'left' : 'right' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityRows.map((row) => {
                      const isBase = row.priceDeltaPct === 0;
                      const rowPnlColor = row.pnl == null ? '#9ab4d4' : row.pnl >= 0 ? '#00d68f' : '#ff4d6d';
                      return (
                        <tr
                          key={row.priceDeltaPct}
                          style={{
                            borderBottom: '1px solid rgba(0,229,196,0.04)',
                            background: isBase ? 'rgba(0,229,196,0.04)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', color: row.priceDeltaPct < 0 ? '#ff4d6d' : row.priceDeltaPct > 0 ? '#00d68f' : '#9ab4d4', fontWeight: isBase ? 600 : 400 }}>
                            {row.priceDeltaPct > 0 ? '+' : ''}{row.priceDeltaPct}%
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#9ab4d4' }}>
                            ${row.underlyingPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
                            ${row.optionValue.toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
                            ${row.totalValue.toFixed(0)}
                          </td>
                          {costBasisTotal != null && (
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: rowPnlColor, fontWeight: 600 }}>
                              {row.pnl != null ? `${row.pnl >= 0 ? '+$' : '-$'}${Math.abs(row.pnl).toFixed(0)}` : ''}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p style={{ color: '#2a4060', fontFamily: 'DM Sans, sans-serif', fontSize: 10, textAlign: 'center', margin: 0 }}>
              Estimated via Black-Scholes using {ivSourceLabel.toLowerCase()} volatility. For reference only. Not financial advice.
            </p>
          </>
        )}
      </div>
    </>
  );
}
