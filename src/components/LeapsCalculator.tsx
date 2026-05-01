import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
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

interface SavedScenario {
  id: string;
  name: string;
  simPrice: number;
  simDayOffset: number;
  optionValue: number;
  positionChange: number;
}

type IVSourceLabel = 'Live HV30' | 'Default estimate' | 'Manual';

// Custom tooltip for Recharts — defined outside component to avoid re-creation on render
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(9,18,40,0.96)', border: '1px solid rgba(0,229,196,0.2)', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, marginBottom: 4 }}>
        Spot ${typeof label === 'number' ? label.toFixed(2) : label}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginBottom: 2 }}>
          {p.name}: ${typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
}

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

  // ── What-If Simulator state ──────────────────────────────────────────────────
  const [simPrice, setSimPrice] = useState(0);
  const [simUserEdited, setSimUserEdited] = useState(false);
  const [simDayOffset, setSimDayOffset] = useState(0);
  const [simPriceInputStr, setSimPriceInputStr] = useState('');
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [showScenarios, setShowScenarios] = useState(false);
  const [compareAll, setCompareAll] = useState(false);
  const simInputDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const simSectionRef = useRef<HTMLDivElement>(null);

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
      setSimUserEdited(false);
      setSimDayOffset(0);
      setSimPriceInputStr('');
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

  // ── Simulator derived values ─────────────────────────────────────────────────
  const sliderMin = S > 0 ? Math.max(0.01, Math.round(S * 0.30 * 100) / 100) : 0.01;
  const sliderMax = S > 0 ? Math.round(S * 3.00 * 100) / 100 : 1000;
  const maxDaysToExpiry = Math.max(0, Math.ceil(T * 365));

  // Sync simPrice to live spot when spot loads (and user hasn't manually set it)
  useEffect(() => {
    if (S > 0 && !simUserEdited) {
      setSimPrice(S);
      setSimPriceInputStr(S.toFixed(2));
    }
  }, [S, simUserEdited]);

  const clampedSimPrice = Math.max(0.01, Math.min(sliderMax * 2, simPrice));
  const thumbPct = sliderMin < sliderMax
    ? Math.max(0, Math.min(100, ((clampedSimPrice - sliderMin) / (sliderMax - sliderMin)) * 100))
    : 50;

  const simT = simDayOffset === 0 ? T : Math.max(0, (maxDaysToExpiry - simDayOffset) / 365);
  const simBSResult = canCompute && clampedSimPrice >= 0.01 && simT >= 0
    ? blackScholes({ spotPrice: clampedSimPrice, strikePrice: K, timeToExpiry: simT, riskFreeRate: r, volatility: iv, optionType })
    : null;

  const valueDiff = simBSResult && result ? simBSResult.price - result.price : null;
  const positionDiff = valueDiff != null ? valueDiff * numContracts * 100 : null;
  const valueDiffPct = valueDiff != null && result && result.price > 0 ? (valueDiff / result.price) * 100 : null;

  const isSimAtLive = Math.abs(clampedSimPrice - S) < 0.005 && simDayOffset === 0;
  const isDeepOTM = simBSResult ? Math.abs(simBSResult.delta) < 0.05 : false;
  const isExpiredSim = simDayOffset >= maxDaysToExpiry && maxDaysToExpiry > 0;

  // ── Chart data (memoized) ────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!canCompute || S <= 0) return [];
    const low = Math.max(0.01, Math.floor(S * 0.5));
    const high = Math.ceil(S * 2.0);
    const step = Math.max(1, Math.ceil((high - low) / 120));
    const points: Array<Record<string, number>> = [];
    for (let p = low; p <= high; p += step) {
      const todayRes = blackScholes({ spotPrice: p, strikePrice: K, timeToExpiry: T, riskFreeRate: r, volatility: iv, optionType });
      const expiryIntrinsic = Math.max(0, optionType === 'call' ? p - K : K - p);
      const pt: Record<string, number> = {
        price: Math.round(p * 100) / 100,
        today: Math.round(todayRes.price * 100) / 100,
        expiry: Math.round(expiryIntrinsic * 100) / 100,
      };
      if (simDayOffset > 0 && simT > 0) {
        const simRes = blackScholes({ spotPrice: p, strikePrice: K, timeToExpiry: simT, riskFreeRate: r, volatility: iv, optionType });
        pt.simDate = Math.round(simRes.price * 100) / 100;
      }
      points.push(pt);
    }
    return points;
  }, [S, K, T, r, iv, optionType, simDayOffset, simT, canCompute]);

  // ── Saved scenarios (localStorage) ──────────────────────────────────────────
  const scenarioKey = ticker && K && expiry ? `ph_leaps_scenarios_${ticker}_${K}_${expiry}` : null;

  useEffect(() => {
    if (!scenarioKey) return;
    try {
      const stored = localStorage.getItem(scenarioKey);
      if (stored) setSavedScenarios(JSON.parse(stored) as SavedScenario[]);
    } catch { /* ignore */ }
  }, [scenarioKey]);

  const saveScenario = () => {
    if (!scenarioKey || !simBSResult) return;
    const name = `$${clampedSimPrice.toFixed(0)} · ${simDayOffset}d`;
    const scenario: SavedScenario = {
      id: Date.now().toString(),
      name,
      simPrice: clampedSimPrice,
      simDayOffset,
      optionValue: simBSResult.price,
      positionChange: positionDiff ?? 0,
    };
    const next = [scenario, ...savedScenarios].slice(0, 5);
    setSavedScenarios(next);
    try { localStorage.setItem(scenarioKey, JSON.stringify(next)); } catch { /* ignore */ }
    setShowScenarios(true);
  };

  const deleteScenario = (id: string) => {
    const next = savedScenarios.filter((s) => s.id !== id);
    setSavedScenarios(next);
    if (scenarioKey) {
      try { localStorage.setItem(scenarioKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };

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
          maxWidth: 560,
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

            {/* ── Sensitivity table ── */}
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
                      {['Move', 'Underlying', 'Option', 'Total', pnl != null ? 'P&L' : '', 'Sim'].filter(Boolean).map((h) => (
                        <th key={h} style={{ padding: '6px 8px', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: h === 'Move' ? 'left' : 'right' }}>
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
                          <td style={{ padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', color: row.priceDeltaPct < 0 ? '#ff4d6d' : row.priceDeltaPct > 0 ? '#00d68f' : '#9ab4d4', fontWeight: isBase ? 600 : 400 }}>
                            {row.priceDeltaPct > 0 ? '+' : ''}{row.priceDeltaPct}%
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#9ab4d4' }}>
                            ${row.underlyingPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
                            ${row.optionValue.toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: '#e8f0fe' }}>
                            ${row.totalValue.toFixed(0)}
                          </td>
                          {costBasisTotal != null && (
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', color: rowPnlColor, fontWeight: 600 }}>
                              {row.pnl != null ? `${row.pnl >= 0 ? '+$' : '-$'}${Math.abs(row.pnl).toFixed(0)}` : ''}
                            </td>
                          )}
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                const p = Math.max(sliderMin, Math.min(sliderMax, row.underlyingPrice));
                                setSimPrice(p);
                                setSimPriceInputStr(p.toFixed(2));
                                setSimUserEdited(true);
                                setTimeout(() => simSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                              }}
                              style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.2)', borderRadius: 4, color: '#00e5c4', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 9, padding: '2px 5px', whiteSpace: 'nowrap' }}
                            >
                              Sim →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* ── What-If Price Simulator ── */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <div
              ref={simSectionRef}
              style={{ background: 'rgba(0,229,196,0.03)', border: '1px solid rgba(0,229,196,0.1)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}
            >
              {/* Simulator header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <span style={{ color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    What-If Simulator
                  </span>
                  <span style={{ color: '#2a4060', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginLeft: 8 }}>
                    Snap price &amp; time, see result
                  </span>
                </div>
                {!isSimAtLive && (
                  <button
                    onClick={() => { setSimPrice(S); setSimPriceInputStr(S.toFixed(2)); setSimUserEdited(false); setSimDayOffset(0); }}
                    style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.2)', borderRadius: 5, color: '#00e5c4', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 10, padding: '3px 8px' }}
                  >
                    ↺ Reset to live
                  </button>
                )}
              </div>

              {/* Price slider + tooltip */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Sim Price</label>
                  <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                    ${sliderMin.toFixed(0)} – ${sliderMax.toFixed(0)}
                  </span>
                </div>
                {/* Thumb tooltip */}
                <div style={{ position: 'relative', marginBottom: 2 }}>
                  <div style={{ position: 'absolute', left: `${thumbPct}%`, transform: 'translateX(-50%)', bottom: '100%', marginBottom: 2, background: 'rgba(0,229,196,0.9)', borderRadius: 4, color: '#040d1a', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700, padding: '2px 5px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10 }}>
                    ${clampedSimPrice.toFixed(2)}
                  </div>
                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={0.5}
                    value={clampedSimPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setSimPrice(val);
                      setSimPriceInputStr(val.toFixed(2));
                      setSimUserEdited(true);
                    }}
                    style={{ width: '100%', accentColor: '#00e5c4', cursor: 'pointer' }}
                  />
                </div>
                {/* Quick-select presets */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {[
                    { label: '−50%', mult: 0.5 },
                    { label: '−25%', mult: 0.75 },
                    { label: 'Current', mult: 1 },
                    { label: '+25%', mult: 1.25 },
                    { label: '+50%', mult: 1.5 },
                    { label: '+100%', mult: 2.0 },
                  ].map(({ label, mult }) => {
                    const target = Math.max(sliderMin, Math.min(sliderMax, Math.round(S * mult * 100) / 100));
                    const isActive = Math.abs(clampedSimPrice - target) < 0.005;
                    return (
                      <button
                        key={label}
                        onClick={() => { setSimPrice(target); setSimPriceInputStr(target.toFixed(2)); setSimUserEdited(mult !== 1); }}
                        style={{
                          background: isActive ? 'rgba(0,229,196,0.15)' : 'rgba(0,0,0,0.2)',
                          border: `1px solid ${isActive ? 'rgba(0,229,196,0.4)' : 'rgba(0,229,196,0.1)'}`,
                          borderRadius: 4,
                          color: isActive ? '#00e5c4' : '#4a6a8a',
                          cursor: 'pointer',
                          fontFamily: 'DM Sans, sans-serif',
                          fontSize: 10,
                          fontWeight: isActive ? 700 : 400,
                          padding: '2px 7px',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {/* Manual input */}
                  <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: '#4a6a8a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none' }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      min={0.01}
                      value={simPriceInputStr}
                      onChange={(e) => {
                        setSimPriceInputStr(e.target.value);
                        clearTimeout(simInputDebounceRef.current);
                        simInputDebounceRef.current = setTimeout(() => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) { setSimPrice(v); setSimUserEdited(true); }
                        }, 150);
                      }}
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 4, color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, outline: 'none', paddingLeft: 14, paddingRight: 4, paddingTop: 3, paddingBottom: 3, width: 70 }}
                    />
                  </div>
                </div>
              </div>

              {/* Time slider */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Time Forward</label>
                  <span style={{ color: simDayOffset === 0 ? '#4a6a8a' : '#f5c842', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: simDayOffset === 0 ? 400 : 600 }}>
                    {simDayOffset === 0 ? 'Today' : isExpiredSim ? 'Expiry' : `+${simDayOffset}d`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxDaysToExpiry}
                  step={1}
                  value={simDayOffset}
                  onChange={(e) => setSimDayOffset(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#f5c842', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ color: '#2a4060', fontFamily: 'DM Sans, sans-serif', fontSize: 9 }}>Today</span>
                  <span style={{ color: '#2a4060', fontFamily: 'DM Sans, sans-serif', fontSize: 9 }}>Expiry ({maxDaysToExpiry}d)</span>
                </div>
              </div>

              {/* Comparison panel */}
              {simBSResult && (
                <>
                  {/* Warning badges */}
                  {isDeepOTM && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,140,66,0.08)', border: '1px solid rgba(255,140,66,0.2)', borderRadius: 5, color: '#ff8c42', fontFamily: 'DM Sans, sans-serif', fontSize: 10, padding: '4px 8px', marginBottom: 8 }}>
                      <AlertTriangle size={10} strokeWidth={2} />
                      Deep OTM — option value near zero at this price
                    </div>
                  )}
                  {isExpiredSim && (
                    <div style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', borderRadius: 5, color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', fontSize: 10, padding: '4px 8px', marginBottom: 8 }}>
                      At expiry — showing intrinsic value only
                    </div>
                  )}

                  {/* Two-column comparison */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {/* Today Live column */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 7, padding: '9px 10px' }}>
                      <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Today · Live</div>
                      {[
                        { label: 'Spot', val: `$${S.toFixed(2)}`, color: '#9ab4d4' },
                        { label: 'Option', val: `$${result.price.toFixed(2)}`, color: '#00e5c4' },
                        { label: 'Total', val: `$${totalPositionValue!.toFixed(0)}`, color: '#e8f0fe' },
                        { label: 'Δ', val: result.delta.toFixed(3), color: '#9ab4d4' },
                        { label: 'Θ/day', val: result.theta.toFixed(3), color: '#ff8c42' },
                        { label: 'Vega', val: result.vega.toFixed(3), color: '#9ab4d4' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>{label}</span>
                          <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                    {/* What-If column */}
                    <div style={{ background: 'rgba(0,229,196,0.04)', border: '1px solid rgba(0,229,196,0.1)', borderRadius: 7, padding: '9px 10px' }}>
                      <div style={{ color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                        What-If · ${clampedSimPrice.toFixed(2)}{simDayOffset > 0 ? ` +${simDayOffset}d` : ''}
                      </div>
                      {[
                        { label: 'Spot', val: `$${clampedSimPrice.toFixed(2)}`, color: '#9ab4d4' },
                        { label: 'Option', val: `$${simBSResult.price.toFixed(2)}`, color: '#00e5c4' },
                        { label: 'Total', val: `$${(simBSResult.price * numContracts * 100).toFixed(0)}`, color: '#e8f0fe' },
                        { label: 'Δ', val: simBSResult.delta.toFixed(3), color: '#9ab4d4' },
                        { label: 'Θ/day', val: simBSResult.theta.toFixed(3), color: '#ff8c42' },
                        { label: 'Vega', val: simBSResult.vega.toFixed(3), color: '#9ab4d4' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>{label}</span>
                          <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* P&L impact card */}
                  {valueDiff != null && (
                    <div style={{
                      background: (positionDiff ?? 0) >= 0 ? 'rgba(0,214,143,0.06)' : 'rgba(255,77,109,0.06)',
                      border: `1px solid ${(positionDiff ?? 0) >= 0 ? 'rgba(0,214,143,0.2)' : 'rgba(255,77,109,0.2)'}`,
                      borderRadius: 7,
                      padding: '10px 12px',
                      marginBottom: 10,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>P&L Impact</div>
                          <div style={{ color: (positionDiff ?? 0) >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700 }}>
                            {(positionDiff ?? 0) >= 0 ? '+$' : '-$'}{Math.abs(positionDiff ?? 0).toFixed(0)}
                          </div>
                          {valueDiffPct != null && (
                            <div style={{ color: (positionDiff ?? 0) >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginTop: 2 }}>
                              {valueDiffPct >= 0 ? '+' : ''}{valueDiffPct.toFixed(1)}% option value
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9, marginBottom: 4 }}>Break-even spot</div>
                          {breakEven != null && (
                            <div style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>
                              ${breakEven.toFixed(2)}
                            </div>
                          )}
                          <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9, marginTop: 6 }}>per share Δ</div>
                          <div style={{ color: (valueDiff ?? 0) >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>
                            {(valueDiff ?? 0) >= 0 ? '+' : ''}{valueDiff?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save scenario button */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={saveScenario}
                      style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.2)', borderRadius: 5, color: '#00e5c4', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600, padding: '4px 10px' }}
                    >
                      + Save Scenario
                    </button>
                    {savedScenarios.length > 0 && (
                      <button
                        onClick={() => setShowScenarios((v) => !v)}
                        style={{ background: 'transparent', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 10, padding: '4px 6px' }}
                      >
                        {showScenarios ? '▲ Hide' : '▼ Show'} {savedScenarios.length} saved
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Saved Scenarios panel ── */}
            {showScenarios && savedScenarios.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Saved Scenarios ({savedScenarios.length}/5)
                  </span>
                  <button
                    onClick={() => setCompareAll((v) => !v)}
                    style={{ background: compareAll ? 'rgba(0,229,196,0.1)' : 'transparent', border: `1px solid ${compareAll ? 'rgba(0,229,196,0.3)' : 'rgba(0,229,196,0.1)'}`, borderRadius: 4, color: compareAll ? '#00e5c4' : '#4a6a8a', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 9, padding: '2px 7px' }}
                  >
                    {compareAll ? <><Check size={9} strokeWidth={2.5} style={{ display: 'inline', verticalAlign: 'middle' }} /> Comparing all</> : 'Compare all'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {savedScenarios.map((sc) => (
                    <div
                      key={sc.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', borderRadius: 5, padding: '5px 8px' }}
                    >
                      <button
                        onClick={() => { setSimPrice(sc.simPrice); setSimPriceInputStr(sc.simPrice.toFixed(2)); setSimDayOffset(sc.simDayOffset); setSimUserEdited(true); }}
                        style={{ background: 'transparent', border: 'none', color: '#9ab4d4', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textAlign: 'left', padding: 0 }}
                      >
                        {sc.name}
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                          ${sc.optionValue.toFixed(2)}
                        </span>
                        <span style={{ color: sc.positionChange >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600 }}>
                          {sc.positionChange >= 0 ? '+$' : '-$'}{Math.abs(sc.positionChange).toFixed(0)}
                        </span>
                        <button
                          onClick={() => deleteScenario(sc.id)}
                          style={{ background: 'transparent', border: 'none', color: '#2a4060', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 2px' }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {compareAll && (
                  <div style={{ marginTop: 8, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(0,229,196,0.08)' }}>
                          {['Scenario', 'Spot', 'Days', 'Option', 'Pos Δ'].map((h) => (
                            <th key={h} style={{ padding: '4px 6px', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Scenario' ? 'left' : 'right' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {savedScenarios.map((sc) => (
                          <tr key={sc.id} style={{ borderBottom: '1px solid rgba(0,229,196,0.04)' }}>
                            <td style={{ padding: '4px 6px', color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>{sc.name}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>${sc.simPrice.toFixed(2)}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>+{sc.simDayOffset}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>${sc.optionValue.toFixed(2)}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: sc.positionChange >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                              {sc.positionChange >= 0 ? '+$' : '-$'}{Math.abs(sc.positionChange).toFixed(0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Payoff Chart ── */}
            {chartData.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Payoff Curve
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  {[
                    { color: '#00e5c4', label: 'Today' },
                    { color: '#f5c842', label: 'At Expiry' },
                    ...(simDayOffset > 0 ? [{ color: '#b48af7', label: `Sim +${simDayOffset}d` }] : []),
                  ].map(({ color, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 12, height: 2, background: color, borderRadius: 1 }} />
                      <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 9 }}>{label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="price" tick={{ fill: '#2a4060', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} tickFormatter={(v: number) => `$${v}`} minTickGap={40} />
                    <YAxis tick={{ fill: '#2a4060', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} tickFormatter={(v: number) => `$${v}`} width={38} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <ReferenceLine x={S} stroke="rgba(0,229,196,0.3)" strokeDasharray="3 3" label={{ value: 'Spot', fill: '#00e5c4', fontSize: 8, fontFamily: 'DM Sans, sans-serif' }} />
                    <ReferenceLine x={K} stroke="rgba(245,200,66,0.3)" strokeDasharray="3 3" label={{ value: 'Strike', fill: '#f5c842', fontSize: 8, fontFamily: 'DM Sans, sans-serif' }} />
                    {!isSimAtLive && <ReferenceLine x={clampedSimPrice} stroke="rgba(180,138,247,0.4)" strokeDasharray="3 3" label={{ value: 'Sim', fill: '#b48af7', fontSize: 8, fontFamily: 'DM Sans, sans-serif' }} />}
                    <Line type="monotone" dataKey="today" stroke="#00e5c4" strokeWidth={1.5} dot={false} name="Today" />
                    <Line type="monotone" dataKey="expiry" stroke="#f5c842" strokeWidth={1.5} dot={false} name="At Expiry" />
                    {simDayOffset > 0 && <Line type="monotone" dataKey="simDate" stroke="#b48af7" strokeWidth={1.5} dot={false} name={`Sim +${simDayOffset}d`} />}
                  </LineChart>
                </ResponsiveContainer>
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
