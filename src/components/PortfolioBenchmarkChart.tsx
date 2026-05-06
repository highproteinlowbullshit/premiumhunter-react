import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { BenchmarkComparison } from '../lib/spyBenchmark';
import type { PnLAttribution, EnhancedTimeRange } from '../hooks/usePortfolioEnhanced';

type ChartMode = 'benchmark' | 'attribution';

function fmt(val: number, sym = '$'): string {
  return Math.abs(val) >= 1000 ? `${sym}${(val / 1000).toFixed(1)}k` : `${sym}${val.toFixed(0)}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Small SVG donut ───────────────────────────────────────────────────────────

function DonutChart({ premiumPct }: { premiumPct: number }) {
  const r = 16, cx = 20, cy = 20, circ = 2 * Math.PI * r;
  const tealDash = (premiumPct / 100) * circ;
  const indigoDash = circ - tealDash;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      {premiumPct > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#14b8a6" strokeWidth="6"
          strokeDasharray={`${tealDash} ${circ - tealDash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
      )}
      {indigoDash > 0.5 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#6366f1" strokeWidth="6"
          strokeDasharray={`${indigoDash} ${circ - indigoDash}`}
          strokeLinecap="round"
          transform={`rotate(${-90 + (premiumPct / 100) * 360} ${cx} ${cy})`} />
      )}
    </svg>
  );
}

// ── Custom tooltips ───────────────────────────────────────────────────────────

function BenchmarkTooltip({ active, payload, label, sym = '$' }: any) {
  if (!active || !payload?.length) return null;
  const port = payload.find((p: any) => p.dataKey === 'portfolioValue');
  const spy = payload.find((p: any) => p.dataKey === 'spyValue');
  // Read pre-computed returns from the data row (hidden Areas excluded in Recharts v3)
  const row = payload[0]?.payload ?? {};
  const portRet: number = row.portfolioReturn ?? 0;
  const spyRet: number = row.spyReturn ?? 0;
  const outperf = Math.round((portRet - spyRet) * 100) / 100;
  return (
    <div style={{ background: 'rgba(10,22,40,0.97)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 8, padding: '10px 14px', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>
      <div style={{ color: '#6a8fb0', marginBottom: 6, fontSize: 11 }}>{fmtDate(label)}</div>
      {port && <div style={{ color: '#14b8a6', marginBottom: 2 }}>Your portfolio: {fmt(port.value, sym)} ({portRet > 0 ? '+' : ''}{portRet}%)</div>}
      {spy && <div style={{ color: '#64748b', marginBottom: 4 }}>SPY equivalent: {fmt(spy.value, sym)} ({spyRet > 0 ? '+' : ''}{spyRet}%)</div>}
      <div style={{ color: outperf >= 0 ? '#00d68f' : '#ff4d6d', fontWeight: 600 }}>
        {outperf >= 0 ? '+' : ''}{outperf}% vs SPY
      </div>
    </div>
  );
}

function AttributionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const premium = payload.find((p: any) => p.dataKey === 'premiumIncome')?.value ?? 0;
  const gains = payload.find((p: any) => p.dataKey === 'capitalGains')?.value ?? 0;
  const total = premium + gains;
  const pct = total > 0 ? Math.round((premium / total) * 100) : 100;
  return (
    <div style={{ background: 'rgba(10,22,40,0.97)', border: '1px solid rgba(0,229,196,0.12)', borderRadius: 8, padding: '10px 14px', fontFamily: 'DM Sans, sans-serif', fontSize: 12 }}>
      <div style={{ color: '#6a8fb0', marginBottom: 6, fontSize: 11 }}>{label}</div>
      <div style={{ color: '#14b8a6', marginBottom: 2 }}>Premium income: {fmt(premium)}</div>
      {gains > 0 && <div style={{ color: '#818cf8', marginBottom: 2 }}>Capital gains: {fmt(gains)}</div>}
      <div style={{ color: '#9ab4d4', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        Total: {fmt(total)} · {pct}% premium
      </div>
    </div>
  );
}

// ── Time range toggle ─────────────────────────────────────────────────────────

const RANGES: Array<{ key: EnhancedTimeRange; label: string }> = [
  { key: '1M', label: '1M' }, { key: '3M', label: '3M' },
  { key: '6M', label: '6M' }, { key: '1Y', label: '1Y' },
  { key: 'all', label: 'All' },
];

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  benchmark: BenchmarkComparison | null;
  attribution: PnLAttribution | null;
  timeRange: EnhancedTimeRange;
  onTimeRangeChange: (range: EnhancedTimeRange) => void;
  isLoading: boolean;
  currency?: 'USD' | 'SGD';
  fxRate?: number;
}

export function PortfolioBenchmarkChart({ benchmark, attribution, timeRange, onTimeRangeChange, isLoading, currency, fxRate }: Props) {
  const [mode, setMode] = useState<ChartMode>('benchmark');

  const cardStyle: React.CSSProperties = {
    background: 'rgba(13,27,53,0.6)',
    border: '1px solid rgba(0,229,196,0.08)',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 24,
  };

  return (
    <div style={cardStyle}>
      {/* Mode tabs + time range */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        {/* Mode tabs */}
        <div style={{ display: 'flex', background: 'rgba(5,13,26,0.6)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 8, padding: 3, gap: 2 }}>
          {([
            { key: 'benchmark' as ChartMode, label: 'vs SPY Benchmark' },
            { key: 'attribution' as ChartMode, label: 'Income vs Capital Gains' },
          ]).map(({ key, label }) => (
            <button key={key} onClick={() => setMode(key)}
              style={{
                background: mode === key ? 'rgba(0,229,196,0.1)' : 'transparent',
                border: `1px solid ${mode === key ? 'rgba(0,229,196,0.2)' : 'transparent'}`,
                borderRadius: 6, color: mode === key ? '#00e5c4' : '#4a6a8a',
                fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600,
                padding: '5px 12px', cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Time range toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(({ key, label }) => (
            <button key={key} onClick={() => onTimeRangeChange(key)}
              style={{
                background: timeRange === key ? 'rgba(0,229,196,0.12)' : 'transparent',
                border: `1px solid ${timeRange === key ? 'rgba(0,229,196,0.25)' : 'rgba(0,229,196,0.08)'}`,
                borderRadius: 6, color: timeRange === key ? '#00e5c4' : '#4a6a8a',
                fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600,
                padding: '4px 10px', cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
          Loading performance data…
        </div>
      ) : mode === 'benchmark' ? (
        <BenchmarkView benchmark={benchmark} currency={currency} fxRate={fxRate} />
      ) : (
        <AttributionView attribution={attribution} />
      )}
    </div>
  );
}

// ── Benchmark view ────────────────────────────────────────────────────────────

function BenchmarkView({ benchmark, currency, fxRate }: { benchmark: BenchmarkComparison | null; currency?: 'USD' | 'SGD'; fxRate?: number }) {
  const rate = fxRate ?? 1;
  const sym = currency === 'SGD' ? 'S$' : '$';
  if (!benchmark) {
    return (
      <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <p style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 14, textAlign: 'center' }}>
          Building benchmark history…
        </p>
        <p style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, textAlign: 'center' }}>
          Requires at least 7 days of portfolio snapshots. Visit again daily and it will populate automatically.
        </p>
      </div>
    );
  }

  const pillStyle = (color: string): React.CSSProperties => ({
    background: `${color}12`,
    border: `1px solid ${color}30`,
    borderRadius: 8,
    padding: '8px 14px',
    textAlign: 'center' as const,
  });

  return (
    <>
      {/* Stat pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={pillStyle('#14b8a6')}>
          <div style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 3 }}>Your return</div>
          <div style={{ color: benchmark.portfolioReturn >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700 }}>
            {benchmark.portfolioReturn >= 0 ? '+' : ''}{benchmark.portfolioReturn}%
          </div>
        </div>
        <div style={pillStyle('#64748b')}>
          <div style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 3 }}>SPY return</div>
          <div style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700 }}>
            {benchmark.spyReturn >= 0 ? '+' : ''}{benchmark.spyReturn}%
          </div>
        </div>
        <div style={pillStyle(benchmark.isOutperforming ? '#00d68f' : '#ff4d6d')}>
          <div style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 3 }}>Outperformance</div>
          <div style={{ color: benchmark.isOutperforming ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700 }}>
            {benchmark.outperformance >= 0 ? '+' : ''}{benchmark.outperformance}%
          </div>
          <div style={{ color: benchmark.isOutperforming ? '#00d68f' : '#ff4d6d', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 2, fontWeight: 600 }}>
            {benchmark.isOutperforming ? '▲ Beating market' : '▼ Lagging market'}
          </div>
        </div>
      </div>

      {/* Chart — hidden dataKeys feed tooltip; visible areas are portfolio + spy */}
      {(() => {
        const displayPoints = benchmark.dataPoints.map(dp => ({
          ...dp,
          portfolioValue: Math.round(dp.portfolioValue * rate * 100) / 100,
          spyValue: Math.round(dp.spyValue * rate * 100) / 100,
        }));
        return (
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart
          data={displayPoints}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,196,0.05)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate}
            tick={{ fill: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
            axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v) => fmt(v, sym)}
            tick={{ fill: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
            axisLine={false} tickLine={false} width={52} />
          <Tooltip content={(props) => <BenchmarkTooltip {...props} sym={sym} />} />
          {/* Visible lines */}
          <Area type="monotone" dataKey="spyValue" name="SPY (normalised)"
            stroke="#475569" strokeWidth={1.5} strokeDasharray="4 2" fill="none" dot={false} />
          <Area type="monotone" dataKey="portfolioValue" name="Your portfolio"
            stroke="#14b8a6" strokeWidth={2} fill="url(#portGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
        );
      })()}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 2, background: '#14b8a6' }} />
            <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>Your portfolio</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 2, background: '#475569', borderTop: '2px dashed #475569' }} />
            <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11 }}>SPY (same start value)</span>
          </div>
        </div>
        <p style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontStyle: 'italic', margin: 0 }}>
          SPY via Polygon.io · Past performance not indicative of future results
        </p>
      </div>
    </>
  );
}

// ── Attribution view ──────────────────────────────────────────────────────────

function AttributionView({ attribution }: { attribution: PnLAttribution | null }) {
  if (!attribution || attribution.monthlyAttribution.length === 0) {
    return (
      <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 14 }}>
        No closed positions yet — attribution appears once trades are completed.
      </div>
    );
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontFamily: 'DM Sans, sans-serif', fontSize: 13,
  };

  return (
    <>
      {/* Header row: stat pills + donut */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)', borderRadius: 10, padding: '10px 16px', flex: '1 1 160px' }}>
          <div style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 3 }}>Total premium income</div>
          <div style={{ color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700 }}>
            ${attribution.totalPremiumIncome.toLocaleString()}
          </div>
          <div style={{ color: '#2e8a7a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 2 }}>
            {attribution.premiumAsPercentOfTotal}% of all returns
          </div>
        </div>
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 16px', flex: '1 1 160px' }}>
          <div style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontSize: 11, marginBottom: 3 }}>Capital gains</div>
          <div style={{ color: '#818cf8', fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700 }}>
            ${attribution.totalRealizedGains.toLocaleString()}
          </div>
          <div style={{ color: '#5355a0', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 2 }}>
            {attribution.capitalGainsAsPercentOfTotal}% of all returns
          </div>
        </div>
        <DonutChart premiumPct={attribution.premiumAsPercentOfTotal} />
      </div>

      {/* Stacked bar chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={attribution.monthlyAttribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,196,0.05)" vertical={false} />
          <XAxis dataKey="month"
            tick={{ fill: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
            axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt}
            tick={{ fill: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
            axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<AttributionTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="premiumIncome" name="Premium income" stackId="a" fill="#14b8a6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="capitalGains" name="Capital gains" stackId="a" fill="#6366f1" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Breakdown cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        {/* Premium breakdown */}
        <div style={{ background: 'rgba(5,13,26,0.5)', border: '1px solid rgba(20,184,166,0.1)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ color: '#14b8a6', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Premium sources</div>
          {[
            { label: 'CSP premium', value: attribution.cspPremiumIncome, color: '#14b8a6' },
            { label: 'CC premium', value: attribution.ccPremiumIncome, color: '#2dd4bf' },
            { label: 'Assignment CSP', value: attribution.premiumFromAssignedCSPs, color: '#5eead4' },
          ].map(({ label, value, color }) => value > 0 && (
            <div key={label} style={rowStyle}>
              <span style={{ color: '#6a8fb0' }}>{label}</span>
              <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>${value.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ ...rowStyle, borderBottom: 'none', marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(20,184,166,0.12)' }}>
            <span style={{ color: '#9ab4d4', fontWeight: 700 }}>Total premium</span>
            <span style={{ color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700 }}>${attribution.totalPremiumIncome.toLocaleString()}</span>
          </div>
        </div>

        {/* Capital gains breakdown */}
        <div style={{ background: 'rgba(5,13,26,0.5)', border: '1px solid rgba(99,102,241,0.1)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ color: '#818cf8', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Capital gains sources</div>
          {attribution.totalRealizedGains > 0 ? (
            <>
              <div style={rowStyle}>
                <span style={{ color: '#6a8fb0' }}>Shares called away</span>
                <span style={{ color: '#818cf8', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>${attribution.totalRealizedGains.toLocaleString()}</span>
              </div>
              <div style={{ ...rowStyle, borderBottom: 'none', marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(99,102,241,0.12)' }}>
                <span style={{ color: '#9ab4d4', fontWeight: 700 }}>Total gains</span>
                <span style={{ color: '#818cf8', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700 }}>${attribution.totalRealizedGains.toLocaleString()}</span>
              </div>
            </>
          ) : (
            <p style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontStyle: 'italic', margin: 0 }}>
              No shares called away yet — gains appear when shares are called away or sold.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
