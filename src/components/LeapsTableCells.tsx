import { useState, useEffect } from 'react';
import { getQuote } from '../lib/finnhub';
import { getIVData } from '../lib/polygon';
import { blackScholes, yearsToExpiry, estimateVolatility } from '../lib/blackScholes';

interface LeapsTableCellsProps {
  ticker: string;
  optionType: 'call' | 'put';
  strike: number;
  expiry: string;
  quantity: number;   // contracts
  avgCost: number;    // per-share basis
}

const cellBase: React.CSSProperties = {
  padding: '12px 14px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 13,
};

// Returned as a fragment — must be placed directly inside a <tr>
export function LeapsTableCells({ ticker, optionType, strike, expiry, quantity, avgCost }: LeapsTableCellsProps) {
  const [loading, setLoading] = useState(true);
  const [spotPrice, setSpotPrice] = useState<number | null>(null);
  const [volatility, setVolatility] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchData() {
      const [quoteRes, ivRes] = await Promise.allSettled([
        getQuote(ticker),
        getIVData(ticker),
      ]);
      if (cancelled) return;

      if (quoteRes.status === 'fulfilled') {
        const q = quoteRes.value;
        const price = q.c > 0 ? q.c : (q.pc > 0 ? q.pc : 0);
        setSpotPrice(price > 0 ? price : null);
      }

      const vol =
        ivRes.status === 'fulfilled' && ivRes.value.currentHV > 0
          ? ivRes.value.currentHV / 100
          : estimateVolatility(ticker);
      setVolatility(vol);
      setLoading(false);
    }

    void fetchData();
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading) {
    return (
      <>
        <td style={{ ...cellBase, color: '#4a6a8a' }}>…</td>
        <td style={{ ...cellBase, color: '#4a6a8a' }}>…</td>
        <td style={{ ...cellBase, color: '#4a6a8a' }}>…</td>
        <td style={{ ...cellBase, color: '#4a6a8a' }}>…</td>
      </>
    );
  }

  if (!spotPrice || !volatility) {
    return (
      <>
        <td style={{ ...cellBase, color: '#4a6a8a' }}>—</td>
        <td style={{ ...cellBase, color: '#4a6a8a' }}>—</td>
        <td style={{ ...cellBase, color: '#4a6a8a' }}>—</td>
        <td style={{ ...cellBase, color: '#4a6a8a' }}>—</td>
      </>
    );
  }

  const T = yearsToExpiry(expiry);
  if (T <= 0) {
    return (
      <>
        <td colSpan={4} style={{ ...cellBase, color: '#ff4d6d' }}>Expired</td>
      </>
    );
  }

  const result = blackScholes({
    spotPrice,
    strikePrice: strike,
    timeToExpiry: T,
    riskFreeRate: 0.045,
    volatility,
    optionType,
  });

  const marketValue = result.price * quantity * 100;
  const costBasis   = avgCost * quantity * 100;
  const pnl         = marketValue - costBasis;
  const pnlPct      = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const pnlColor    = pnl >= 0 ? '#00d68f' : '#ff4d6d';

  const fmtDollar = (v: number) =>
    `${v < 0 ? '-$' : '$'}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      {/* Current Price (BS estimate) */}
      <td style={{ ...cellBase }}>
        <span style={{ color: '#00e5c4' }}>~${result.price.toFixed(2)}</span>
        <span style={{ color: '#2a4060', fontSize: 9, fontFamily: 'DM Sans, sans-serif', marginLeft: 4 }}>BS</span>
      </td>

      {/* Market Value */}
      <td style={{ ...cellBase, color: '#e8f0fe' }}>
        {fmtDollar(marketValue)}
      </td>

      {/* Unrealized P&L */}
      <td style={{ ...cellBase, color: pnlColor }}>
        {pnl >= 0 ? '+' : ''}{fmtDollar(pnl)}
      </td>

      {/* P&L % */}
      <td style={{ ...cellBase, color: pnlColor }}>
        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
      </td>
    </>
  );
}

// ── Mobile card variant (flat grid, not table cells) ─────────────────────────

interface LeapsMobileValuesProps {
  ticker: string;
  optionType: 'call' | 'put';
  strike: number;
  expiry: string;
  quantity: number;
  avgCost: number;
}

export function LeapsMobileValues(props: LeapsMobileValuesProps) {
  const { ticker, optionType, strike, expiry, quantity, avgCost } = props;
  const [loading, setLoading] = useState(true);
  const [spotPrice, setSpotPrice] = useState<number | null>(null);
  const [volatility, setVolatility] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchData() {
      const [quoteRes, ivRes] = await Promise.allSettled([
        getQuote(ticker),
        getIVData(ticker),
      ]);
      if (cancelled) return;

      if (quoteRes.status === 'fulfilled') {
        const q = quoteRes.value;
        const price = q.c > 0 ? q.c : (q.pc > 0 ? q.pc : 0);
        setSpotPrice(price > 0 ? price : null);
      }

      const vol =
        ivRes.status === 'fulfilled' && ivRes.value.currentHV > 0
          ? ivRes.value.currentHV / 100
          : estimateVolatility(ticker);
      setVolatility(vol);
      setLoading(false);
    }

    void fetchData();
    return () => { cancelled = true; };
  }, [ticker]);

  const mono: React.CSSProperties = { fontFamily: 'JetBrains Mono, monospace', fontSize: 12 };
  const label: React.CSSProperties = { color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', marginBottom: 2 };

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {['Est. Price', 'Market Value', 'Unrealized P&L', 'P&L %'].map((l) => (
          <div key={l}>
            <div style={label}>{l}</div>
            <div style={{ ...mono, color: '#4a6a8a' }}>…</div>
          </div>
        ))}
      </div>
    );
  }

  if (!spotPrice || !volatility) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {['Est. Price', 'Market Value', 'Unrealized P&L', 'P&L %'].map((l) => (
          <div key={l}>
            <div style={label}>{l}</div>
            <div style={{ ...mono, color: '#4a6a8a' }}>—</div>
          </div>
        ))}
      </div>
    );
  }

  const T = yearsToExpiry(expiry);
  if (T <= 0) {
    return <div style={{ ...mono, color: '#ff4d6d', fontSize: 11 }}>Expired</div>;
  }

  const result = blackScholes({ spotPrice, strikePrice: strike, timeToExpiry: T, riskFreeRate: 0.045, volatility, optionType });
  const marketValue = result.price * quantity * 100;
  const costBasis   = avgCost * quantity * 100;
  const pnl         = marketValue - costBasis;
  const pnlPct      = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const pnlColor    = pnl >= 0 ? '#00d68f' : '#ff4d6d';
  const fmtDollar   = (v: number) => `${v < 0 ? '-$' : '$'}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <div>
        <div style={label}>Est. Price</div>
        <div style={{ ...mono }}>
          <span style={{ color: '#00e5c4' }}>~${result.price.toFixed(2)}</span>
          <span style={{ color: '#2a4060', fontSize: 9, fontFamily: 'DM Sans, sans-serif', marginLeft: 3 }}>BS</span>
        </div>
      </div>
      <div>
        <div style={label}>Market Value</div>
        <div style={{ ...mono, color: '#e8f0fe' }}>{fmtDollar(marketValue)}</div>
      </div>
      <div>
        <div style={label}>Unrealized P&L</div>
        <div style={{ ...mono, color: pnlColor }}>
          {pnl >= 0 ? '+' : ''}{fmtDollar(pnl)}
        </div>
      </div>
      <div>
        <div style={label}>P&L %</div>
        <div style={{ ...mono, color: pnlColor }}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
