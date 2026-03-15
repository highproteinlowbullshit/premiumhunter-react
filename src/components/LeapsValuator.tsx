import { useState, useEffect } from 'react';
import { getQuote } from '../lib/finnhub';
import { getIVData } from '../lib/polygon';
import {
  blackScholes,
  yearsToExpiry,
  estimateVolatility,
  getMoneynessLevel,
  MONEYNESS_COLORS,
} from '../lib/blackScholes';
import { LeapsCalculator } from './LeapsCalculator';

export interface LeapsValuatorProps {
  ticker: string;
  optionType: 'call' | 'put';
  strike: number;
  expiry: string;
  quantity: number;   // number of contracts
  avgCost: number;    // average cost per contract (per-share basis)
}

type IVSource = 'hv30' | 'default';

interface ValuationState {
  spotPrice: number;
  volatility: number;
  ivSource: IVSource;
}

export function LeapsValuator({ ticker, optionType, strike, expiry, quantity, avgCost }: LeapsValuatorProps) {
  const [loading, setLoading] = useState(true);
  const [valuation, setValuation] = useState<ValuationState | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchData() {
      const [quoteRes, ivRes] = await Promise.allSettled([
        getQuote(ticker),
        getIVData(ticker),
      ]);
      if (cancelled) return;

      // Spot price with pc fallback
      let spot = 0;
      if (quoteRes.status === 'fulfilled') {
        const q = quoteRes.value;
        spot = q.c > 0 ? q.c : (q.pc > 0 ? q.pc : 0);
      }

      // Volatility: HV30 from Polygon (as decimal) → else hardcoded default
      let vol: number;
      let ivSource: IVSource = 'default';
      if (ivRes.status === 'fulfilled' && ivRes.value.currentHV > 0) {
        vol = ivRes.value.currentHV / 100;
        ivSource = 'hv30';
      } else {
        vol = estimateVolatility(ticker);
      }

      if (!cancelled && spot > 0) {
        setValuation({ spotPrice: spot, volatility: vol, ivSource });
      } else if (!cancelled) {
        setValuation(null);
      }
      setLoading(false);
    }

    void fetchData();
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <div style={{ color: '#4a6a8a', fontSize: 11, fontFamily: 'DM Sans, sans-serif', padding: '2px 0' }}>
        Computing…
      </div>
    );
  }

  if (!valuation) {
    return <span style={{ color: '#4a6a8a' }}>—</span>;
  }

  const T = yearsToExpiry(expiry);
  if (T <= 0) {
    return <span style={{ color: '#ff4d6d', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>Expired</span>;
  }

  const result = blackScholes({
    spotPrice: valuation.spotPrice,
    strikePrice: strike,
    timeToExpiry: T,
    riskFreeRate: 0.045,
    volatility: valuation.volatility,
    optionType,
  });

  const totalValue = result.price * quantity * 100;
  const costBasis = avgCost * quantity * 100;
  const pnl = totalValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const pnlColor = pnl >= 0 ? '#00d68f' : '#ff4d6d';

  const moneynessLevel = getMoneynessLevel(result.moneyness, optionType);
  const moneynessColor = MONEYNESS_COLORS[moneynessLevel];

  return (
    <div style={{ minWidth: 190, lineHeight: 1.4 }}>
      {/* Row 1: Estimated price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
        <span style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700 }}>
          ~${result.price.toFixed(2)}
        </span>
        <span style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}>
          /share · ${totalValue.toFixed(0)} total
        </span>
      </div>

      {/* Row 2: Greeks */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
        {[
          { label: 'Δ', val: result.delta.toFixed(2), color: '#9ab4d4' },
          { label: 'Γ', val: result.gamma.toFixed(4), color: '#9ab4d4' },
          { label: 'Θ', val: result.theta.toFixed(3), color: '#ff8c42' },
          { label: 'V', val: result.vega.toFixed(3), color: '#9ab4d4' },
        ].map(({ label, val, color }) => (
          <span key={label} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#4a6a8a' }}>
            {label}<span style={{ color }}>{val}</span>
          </span>
        ))}
      </div>

      {/* Row 3: Intrinsic / Time */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
        <span style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}>
          Intr: <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>${(result.intrinsicValue).toFixed(2)}</span>
        </span>
        <span style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}>
          Time: <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>${(result.timeValue).toFixed(2)}</span>
        </span>
      </div>

      {/* Row 4: Moneyness badge */}
      <div style={{ marginBottom: 4 }}>
        <span style={{
          background: `${moneynessColor}18`,
          border: `1px solid ${moneynessColor}35`,
          color: moneynessColor,
          borderRadius: 3,
          padding: '1px 5px',
          fontSize: 10,
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 600,
        }}>
          {moneynessLevel}
        </span>
      </div>

      {/* Row 5: Unrealized P&L */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600 }}>
          {pnl >= 0 ? '+' : ''}{pnl < 0 ? '-$' : '$'}{Math.abs(pnl).toFixed(0)}
        </span>
        <span style={{ color: pnlColor, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
          ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
        </span>
      </div>

      {/* Source disclaimer + Simulate button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
        <div style={{ color: '#2a4060', fontSize: 9, fontFamily: 'DM Sans, sans-serif' }}>
          IV: {valuation.ivSource === 'hv30' ? `HV30 (${(valuation.volatility * 100).toFixed(0)}%)` : `Default (${(valuation.volatility * 100).toFixed(0)}%)`} · Black-Scholes est.
        </div>
        <button
          onClick={() => setCalcOpen(true)}
          style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.2)', borderRadius: 4, color: '#00e5c4', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: 600, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Simulate ↗
        </button>
      </div>

      {/* Full calculator (fixed overlay, escapes table cell layout) */}
      <LeapsCalculator
        isOpen={calcOpen}
        onClose={() => setCalcOpen(false)}
        initialTicker={ticker}
        initialOptionType={optionType}
        initialStrike={strike}
        initialExpiry={expiry}
        initialContracts={quantity}
        initialCostBasis={avgCost}
      />
    </div>
  );
}
