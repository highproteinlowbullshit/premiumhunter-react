import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { TickerPerformanceSummary, TickerPerformanceData } from '../hooks/useTickerPerformance'
import { EmptyState } from './ui/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'annReturn' | 'winRate' | 'totalPnL' | 'consistency' | 'trades'
type SortOption = { key: SortKey; label: string }

const SORT_OPTIONS: SortOption[] = [
  { key: 'annReturn', label: 'Ann. return' },
  { key: 'winRate', label: 'Win rate' },
  { key: 'totalPnL', label: 'Total P&L' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'trades', label: 'Most trades' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(v: number, compact = false): string {
  if (compact && Math.abs(v) >= 1000) {
    return v < 0
      ? `-$${(Math.abs(v) / 1000).toFixed(1)}k`
      : `$${(v / 1000).toFixed(1)}k`
  }
  return v < 0
    ? `-$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtMonthYear(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + '-01')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function fmtShortDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function annReturnColor(v: number): string {
  if (v >= 25) return '#00e5c4'
  if (v >= 15) return '#00d68f'
  if (v >= 8) return '#f59e0b'
  return '#ff4d6d'
}

function annReturnWeight(v: number): number {
  return v >= 25 ? 700 : 400
}

// ── Monthly mini chart tooltip ─────────────────────────────────────────────────

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const val: number = payload[0]?.value ?? 0
  return (
    <div style={{ background: 'rgba(10,22,40,0.97)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 6, padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
      <div style={{ color: '#4a6a8a', marginBottom: 2 }}>{label}</div>
      <div style={{ color: val >= 0 ? '#00e5c4' : '#ff4d6d' }}>{val >= 0 ? '+' : ''}{fmt$(val)}</div>
    </div>
  )
}

// ── Skeleton loading state ─────────────────────────────────────────────────────

function SkeletonPulse({ w, h }: { w: string | number; h: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 4,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div
      style={{
        background: 'rgba(13,27,53,0.6)',
        border: '1px solid rgba(0,229,196,0.08)',
        borderRadius: 12,
        padding: '20px',
        marginBottom: 24,
      }}
    >
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <SkeletonPulse w={160} h={16} />
          <div style={{ marginTop: 6 }}><SkeletonPulse w={260} h={11} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[100, 90, 70, 90].map((w, i) => <SkeletonPulse key={i} w={w} h={22} />)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[80, 70, 70, 90, 90].map((w, i) => <SkeletonPulse key={i} w={w} h={26} />)}
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <SkeletonPulse w={28} h={14} />
          <SkeletonPulse w={60} h={14} />
          <SkeletonPulse w={80} h={14} />
          <SkeletonPulse w={70} h={14} />
          <SkeletonPulse w={80} h={14} />
          <SkeletonPulse w={90} h={14} />
          <SkeletonPulse w={60} h={14} />
          <SkeletonPulse w={80} h={14} />
        </div>
      ))}
    </div>
  )
}

// ── Expanded row panel ─────────────────────────────────────────────────────────

function buildMonthlyChartData(ticker: TickerPerformanceData): Array<{ month: string; pnl: number }> {
  return ticker.monthlyBreakdown
}

function ExpandedPanel({ ticker }: { ticker: TickerPerformanceData }) {
  const chartData = buildMonthlyChartData(ticker)

  return (
    <tr>
      <td
        colSpan={8}
        style={{
          background: 'rgba(5,13,26,0.5)',
          borderBottom: '1px solid rgba(0,229,196,0.06)',
          padding: '0 0 0 0',
        }}
      >
        <div style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <XAxis dataKey="month" tick={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, fill: '#4a6a8a' }} axisLine={false} tickLine={false} />
                <Tooltip content={<MiniTooltip />} />
                <Line type="monotone" dataKey="pnl" stroke="#00e5c4" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {[
              { label: 'Avg DTE at entry', value: `${ticker.averageDTE}d` },
              { label: 'Largest win', value: fmt$(ticker.largestWin), color: '#00e5c4' },
              { label: 'Largest loss', value: fmt$(ticker.largestLoss), color: ticker.largestLoss < 0 ? '#ff4d6d' : '#4a6a8a' },
              { label: 'Sharpe proxy', value: ticker.sharpeProxy.toFixed(2) },
              { label: 'First trade', value: fmtShortDate(ticker.firstTradeDate) },
              { label: 'Total days tracked', value: `${ticker.totalDaysTraded}d` },
              { label: 'Max drawdown', value: fmt$(ticker.maxDrawdown), color: '#f59e0b' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginBottom: 3 }}>{label}</div>
                <div style={{ color: color ?? '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Insight card ───────────────────────────────────────────────────────────────

function InsightCard({ icon, title, ticker }: { icon: string; title: string; ticker: TickerPerformanceData | null }) {
  if (!ticker) return null
  return (
    <div
      style={{
        background: 'rgba(13,27,53,0.5)',
        border: '1px solid rgba(0,229,196,0.08)',
        borderRadius: 10,
        padding: 12,
        minWidth: 200,
        flex: '1 1 200px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        {ticker.ticker}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          <div style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>Ann. return</div>
          <div style={{ color: annReturnColor(ticker.annualisedReturn), fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            {ticker.annualisedReturn.toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>Win rate</div>
          <div style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            {ticker.winRate.toFixed(1)}%
          </div>
        </div>
        <div>
          <div style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>Trades</div>
          <div style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            {ticker.totalCycles}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  summary: TickerPerformanceSummary | null
  isLoading: boolean
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TickerPerformanceTable({ summary, isLoading }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('annReturn')
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)

  if (isLoading) return <LoadingSkeleton />
  if (!summary || summary.tickers.length === 0) {
    return (
      <EmptyState
        icon="🏆"
        title="No completed cycles yet"
        description="Close your first position to start tracking per-ticker win rate, premium collected, and annualised return."
      />
    )
  }

  // Sort
  const sorted = [...summary.tickers].sort((a, b) => {
    switch (sortBy) {
      case 'annReturn': return b.annualisedReturn - a.annualisedReturn
      case 'winRate': return b.winRate - a.winRate
      case 'totalPnL': return b.totalPnL - a.totalPnL
      case 'consistency': return b.consistencyScore - a.consistencyScore
      case 'trades': return b.totalCycles - a.totalCycles
      default: return 0
    }
  })

  const bestTicker = sorted[0]
  const worstTicker = sorted[sorted.length - 1]

  // Worst ticker for "review" card: lowest winRate with > 3 cycles, excluding high performers
  const reviewCandidate = [...summary.tickers]
    .filter(t => t.totalCycles > 3 && t.winRate < 70)
    .sort((a, b) => a.winRate - b.winRate)[0] ?? null

  const rankLabel = (i: number) => {
    if (i === 0) return '🥇'
    if (i === 1) return '🥈'
    if (i === 2) return '🥉'
    return `#${i + 1}`
  }

  const trendArrow = (trend: TickerPerformanceData['recentTrend']) => {
    if (trend === 'improving') return <span style={{ color: '#00e5c4', marginLeft: 4 }}>↑</span>
    if (trend === 'declining') return <span style={{ color: '#f59e0b', marginLeft: 4 }}>↓</span>
    return <span style={{ color: '#4a6a8a', marginLeft: 4 }}>→</span>
  }

  const consistencyBadge = (score: number) => {
    if (score >= 80) {
      return <span style={{ background: 'rgba(0,229,196,0.12)', color: '#00e5c4', border: '1px solid rgba(0,229,196,0.3)', borderRadius: 4, padding: '2px 7px', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>Consistent</span>
    }
    if (score >= 60) {
      return <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 7px', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>Variable</span>
    }
    return <span style={{ background: 'rgba(255,77,109,0.1)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.3)', borderRadius: 4, padding: '2px 7px', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>Inconsistent</span>
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(0,229,196,0.12)' : 'rgba(255,255,255,0.04)',
    border: active ? '1px solid rgba(0,229,196,0.3)' : '1px solid rgba(255,255,255,0.06)',
    color: active ? '#00e5c4' : '#4a6a8a',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontFamily: 'DM Sans, sans-serif',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  const headerPillStyle: React.CSSProperties = {
    background: 'rgba(0,229,196,0.08)',
    border: '1px solid rgba(0,229,196,0.15)',
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    color: '#00e5c4',
    whiteSpace: 'nowrap',
  }

  const mutedPillStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: 'DM Sans, sans-serif',
    color: '#4a6a8a',
    whiteSpace: 'nowrap',
  }

  const colHeaderStyle: React.CSSProperties = {
    color: '#2e4a6a',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '8px 12px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(0,229,196,0.06)',
  }

  return (
    <div
      style={{
        background: 'rgba(13,27,53,0.6)',
        border: '1px solid rgba(0,229,196,0.08)',
        borderRadius: 12,
        marginBottom: 24,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 600, color: '#e8f0fe', marginBottom: 3 }}>
              Ticker Performance
            </div>
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#4a6a8a' }}>
              Annualised returns across completed wheel cycles
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={headerPillStyle}>Portfolio: {summary.portfolioAnnualisedReturn.toFixed(1)}% ann.</span>
            <span style={headerPillStyle}>Win rate: {summary.portfolioWinRate.toFixed(1)}%</span>
            <span style={mutedPillStyle}>{summary.totalCompletedTrades} trades</span>
            {summary.dataFromDate && (
              <span style={mutedPillStyle}>
                From {fmtMonthYear(summary.dataFromDate.slice(0, 7))}
              </span>
            )}
          </div>
        </div>

        {/* Sort controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              style={pillStyle(sortBy === opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...colHeaderStyle, width: 44 }}>Rank</th>
              <th style={colHeaderStyle}>Ticker</th>
              <th style={colHeaderStyle}>Ann. Return</th>
              <th style={colHeaderStyle}>Win Rate</th>
              <th style={colHeaderStyle}>Total P&amp;L</th>
              <th style={colHeaderStyle}>Avg Capital</th>
              <th style={colHeaderStyle}>Cycles</th>
              <th style={colHeaderStyle}>Consistency</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const isBest = t.ticker === bestTicker?.ticker
              const isWorst = t.ticker === worstTicker?.ticker && sorted.length > 1
              const isDeclining = t.recentTrend === 'declining'
              const isExpanded = expandedTicker === t.ticker

              const rowStyle: React.CSSProperties = {
                background: isDeclining ? 'rgba(245,158,11,0.03)' : 'transparent',
                borderLeft: isBest
                  ? '3px solid rgba(0,229,196,0.4)'
                  : isWorst
                  ? '3px solid rgba(255,77,109,0.3)'
                  : '3px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }

              const cellStyle: React.CSSProperties = {
                padding: '11px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                verticalAlign: 'top',
              }

              return [
                <tr
                  key={t.ticker}
                  style={rowStyle}
                  onClick={() => setExpandedTicker(isExpanded ? null : t.ticker)}
                >
                  {/* Rank */}
                  <td style={{ ...cellStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#9ab4d4' }}>
                    {rankLabel(i)}
                  </td>

                  {/* Ticker */}
                  <td style={{ ...cellStyle }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: '#e8f0fe' }}>
                        {t.ticker}
                      </span>
                      {trendArrow(t.recentTrend)}
                    </div>
                  </td>

                  {/* Ann. Return */}
                  <td style={cellStyle}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 13,
                      color: annReturnColor(t.annualisedReturn),
                      fontWeight: annReturnWeight(t.annualisedReturn),
                    }}>
                      {t.annualisedReturn.toFixed(1)}%
                    </div>
                    <div style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 2 }}>
                      on deployed capital
                    </div>
                  </td>

                  {/* Win Rate */}
                  <td style={cellStyle}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#9ab4d4', marginBottom: 4 }}>
                      {t.winRate.toFixed(1)}%
                    </div>
                    <div style={{ width: '100%', maxWidth: 80, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 4 }}>
                      <div style={{ width: `${Math.min(100, t.winRate)}%`, height: '100%', background: '#00e5c4', borderRadius: 2 }} />
                    </div>
                    <div style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>
                      {t.expiredWorthless}/{t.totalCycles}
                    </div>
                  </td>

                  {/* Total P&L */}
                  <td style={cellStyle}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 13,
                      color: t.totalPnL >= 0 ? '#00e5c4' : '#ff4d6d',
                      marginBottom: 3,
                    }}>
                      {t.totalPnL >= 0 ? '+' : ''}{fmt$(t.totalPnL, true)}
                    </div>
                    <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>
                      Premium: {t.totalPremiumCollected >= 0 ? '+' : ''}{fmt$(t.totalPremiumCollected, true)}
                    </div>
                    {t.totalCapitalGains > 0 && (
                      <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10 }}>
                        Gains: +{fmt$(t.totalCapitalGains, true)}
                      </div>
                    )}
                  </td>

                  {/* Avg Capital */}
                  <td style={cellStyle}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#9ab4d4' }}>
                      {fmt$(t.averageCapitalDeployed, true)}
                    </div>
                    <div style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 2 }}>per position</div>
                  </td>

                  {/* Cycles */}
                  <td style={cellStyle}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#9ab4d4' }}>
                      {t.totalCycles - t.coveredCallCycles} CSP
                    </div>
                    {t.coveredCallCycles > 0 && (
                      <div style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: 10, marginTop: 2 }}>
                        {t.coveredCallCycles} CC
                      </div>
                    )}
                  </td>

                  {/* Consistency */}
                  <td style={cellStyle}>
                    {consistencyBadge(t.consistencyScore)}
                    <div style={{ color: '#2e4a6a', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, marginTop: 4 }}>
                      {t.consistencyScore.toFixed(0)}/100
                    </div>
                  </td>
                </tr>,

                isExpanded ? <ExpandedPanel key={`${t.ticker}-exp`} ticker={t} /> : null,
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Insight cards */}
      <div style={{ padding: '16px 20px 0 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <InsightCard icon="🏆" title="Best annualised return" ticker={summary.bestAnnualisedReturn} />
          <InsightCard icon="⚖️" title="Most consistent" ticker={summary.mostConsistent} />
          {reviewCandidate && (
            <InsightCard icon="⚠️" title="Review (low win rate)" ticker={reviewCandidate} />
          )}
        </div>

        {/* Footer note */}
        <div style={{
          color: '#2e4a6a',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
          fontStyle: 'italic',
          paddingBottom: 16,
        }}>
          Annualised return = (total P&amp;L / capital deployed) × (365 / days traded). Accuracy improves after 5+ completed cycles per ticker.
        </div>
      </div>
    </div>
  )
}
