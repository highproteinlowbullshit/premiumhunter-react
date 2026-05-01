import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from 'recharts'
import { usePaperMode } from '../context/PaperModeContext'
import type { PortfolioGreeks } from '../lib/blackScholes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function fmtDollar(n: number, showSign = false): string {
  const abs = Math.abs(n).toFixed(2)
  const sign = n >= 0 ? (showSign ? '+' : '') : '−'
  return `${sign}$${abs}`
}

function generateThetaProjection(
  baseTheta: number,
  dteNow: number,
): Array<{ day: number; cumulative: number }> {
  if (dteNow <= 0 || baseTheta <= 0) return [{ day: 0, cumulative: 0 }]
  const points = [{ day: 0, cumulative: 0 }]
  let cumulative = 0
  const maxDays = Math.ceil(dteNow)
  for (let d = 1; d <= maxDays; d++) {
    const dteRemaining = Math.max(0.5, dteNow - (d - 1))
    const dailyRate = baseTheta * Math.sqrt(dteNow / dteRemaining)
    cumulative += dailyRate
    points.push({ day: d, cumulative: Math.round(cumulative * 100) / 100 })
  }
  return points
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PortfolioGreeksDashboardProps {
  greeks: PortfolioGreeks | null
  isLoading: boolean
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="mb-6 space-y-4">
      {/* Zone A skeleton */}
      <div className="rounded-2xl p-6 animate-pulse" style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', height: 160 }} />
      {/* Zone B skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', height: 140, animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
      {/* Zone C skeleton */}
      <div className="rounded-2xl p-6 animate-pulse" style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', height: 200 }} />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyGreeks() {
  const navigate = useNavigate()
  return (
    <div className="rounded-2xl p-10 mb-6 flex flex-col items-center gap-4 text-center"
      style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', backdropFilter: 'blur(12px)' }}>
      <div style={{ fontSize: 48, color: '#14b8a6', fontFamily: 'serif', lineHeight: 1 }}>Θ</div>
      <h3 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
        No Greeks to display
      </h3>
      <p className="text-sm max-w-sm" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
        Open a Cash Secured Put or Covered Call position to see your portfolio Greeks — including your daily theta income, delta exposure, and risk metrics.
      </p>
      <button
        onClick={() => navigate('/screener')}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #00e5c4, #00b4d8)', color: '#050d1a', fontFamily: 'DM Sans, sans-serif' }}>
        Find opportunities →
      </button>
    </div>
  )
}

// ── Zone A: Theta hero ────────────────────────────────────────────────────────

function ZoneThetaHero({ greeks }: { greeks: PortfolioGreeks }) {
  const projectionData = useMemo(
    () => generateThetaProjection(greeks.dailyThetaIncome, greeks.weightedAverageDTE),
    [greeks.dailyThetaIncome, greeks.weightedAverageDTE],
  )

  const maxBarTheta = greeks.thetaByPosition[0]?.dailyTheta ?? 1
  const topPositions = greeks.thetaByPosition.slice(0, 5)
  const remaining = greeks.thetaByPosition.length - 5

  return (
    <div className="rounded-2xl overflow-hidden mb-4"
      style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', backdropFilter: 'blur(12px)' }}>
      <div className="grid grid-cols-1 lg:grid-cols-3">

        {/* Left: Big theta number */}
        <div className="p-6 border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'rgba(0,229,196,0.08)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#14b8a6', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.12em' }}>
            Daily theta income
          </p>
          <p className="tabular-nums font-bold leading-none mb-2" style={{ fontSize: 48, color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace' }}>
            +${greeks.dailyThetaIncome.toFixed(2)}
          </p>
          <p className="text-xs mb-4" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Time decay earned today across {greeks.positions.length} position{greeks.positions.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-5">
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>This week</p>
              <p className="text-sm font-semibold" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
                +${greeks.weeklyThetaIncome.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>To expiry</p>
              <p className="text-sm font-semibold" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
                +${greeks.monthlyThetaIncome.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Bar chart per position */}
        <div className="p-6 border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'rgba(0,229,196,0.08)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.1em' }}>
            Theta by position
          </p>
          {topPositions.length === 0 ? (
            <p className="text-xs" style={{ color: '#4a6a8a' }}>No positions</p>
          ) : (
            <div className="space-y-2.5">
              {topPositions.map(pos => (
                <div key={pos.positionId} className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-12 flex-shrink-0"
                    style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                    {pos.ticker}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (pos.dailyTheta / maxBarTheta) * 100)}%`,
                        background: 'linear-gradient(90deg, #14b8a6, #0d9488)',
                      }}
                    />
                  </div>
                  <span className="text-xs tabular-nums flex-shrink-0" style={{ color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, width: 52, textAlign: 'right' }}>
                    ${pos.dailyTheta.toFixed(2)}/d
                  </span>
                </div>
              ))}
              {remaining > 0 && (
                <p className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                  and {remaining} more…
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Theta projection chart */}
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.1em' }}>
            Theta decay projection
          </p>
          <div style={{ height: 80 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectionData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <defs>
                  <linearGradient id="thetaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload as { day: number; cumulative: number }
                    return (
                      <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(10,22,40,0.95)', border: '1px solid rgba(0,229,196,0.2)' }}>
                        <p className="text-xs" style={{ color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace' }}>
                          Day {d.day}: +${d.cumulative.toFixed(2)}
                        </p>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#14b8a6"
                  strokeWidth={1.5}
                  fill="url(#thetaGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div>
              <p className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Avg DTE</p>
              <p className="text-sm font-semibold" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
                {greeks.weightedAverageDTE.toFixed(0)} days
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Acceleration</p>
              <p className="text-sm font-semibold" style={{ color: greeks.thetaAccelerationNote ? '#f59e0b' : '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
                {greeks.thetaAccelerationNote ? 'High' : 'Normal'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Theta acceleration banner */}
      {greeks.thetaAccelerationNote && (
        <div className="px-6 py-3" style={{ background: 'rgba(245,158,11,0.06)', borderTop: '1px solid rgba(245,158,11,0.15)' }}>
          <p className="text-xs italic" style={{ color: '#f59e0b', fontFamily: 'DM Sans, sans-serif' }}>
            ⚡ {greeks.thetaAccelerationNote}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Zone B: Four Greeks cards ─────────────────────────────────────────────────

const DELTA_EXPOSURE_CONFIG: Record<
  PortfolioGreeks['deltaExposure'],
  { label: string; color: string; arrow: string }
> = {
  bullish:         { label: 'Bullish',           color: '#00d68f', arrow: '▲' },
  slightly_bullish:{ label: 'Slightly bullish',  color: '#14b8a6', arrow: '↗' },
  neutral:         { label: 'Neutral',           color: '#4a6a8a', arrow: '→' },
  slightly_bearish:{ label: 'Slightly bearish',  color: '#f59e0b', arrow: '↘' },
  bearish:         { label: 'Bearish',           color: '#ef4444', arrow: '▼' },
}

const VEGA_RISK_CONFIG: Record<PortfolioGreeks['vegaRisk'], { label: string; color: string }> = {
  low:      { label: 'Low IV risk',      color: '#14b8a6' },
  moderate: { label: 'Moderate IV risk', color: '#f59e0b' },
  high:     { label: 'High IV risk',     color: '#ef4444' },
}

const GAMMA_RISK_CONFIG: Record<PortfolioGreeks['gammaRisk'], { label: string; color: string }> = {
  low:      { label: 'Low gamma risk',      color: '#14b8a6' },
  moderate: { label: 'Moderate',            color: '#f59e0b' },
  high:     { label: 'High gamma risk',     color: '#ef4444' },
  extreme:  { label: 'Extreme ⚠',          color: '#ef4444' },
}

function GreekCard({
  title, symbol, value, valueColor, badge, badgeColor,
  impact, explanation, tooltip,
  extra,
}: {
  title: string
  symbol: string
  value: string
  valueColor: string
  badge: string
  badgeColor: string
  impact: string
  explanation: string
  tooltip: string
  extra?: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-4 overflow-hidden"
      style={{
        background: 'rgba(13,27,53,0.6)',
        border: '1px solid rgba(0,229,196,0.1)',
        backdropFilter: 'blur(12px)',
      }}
      title={tooltip}
    >
      {/* Symbol + title row */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span style={{ fontSize: 24, color: valueColor, fontFamily: 'serif', lineHeight: 1, flexShrink: 0 }}>{symbol}</span>
        <span className="text-xs font-medium uppercase tracking-wide truncate" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{title}</span>
      </div>
      {/* Value — allow wrapping so monospace numbers don't push outside the card */}
      <p className="font-bold tabular-nums break-all mb-2" style={{ color: valueColor, fontFamily: 'JetBrains Mono, monospace', fontSize: 17, lineHeight: 1.3 }}>
        {value}
      </p>
      {/* Badge below value — no horizontal competition */}
      <span
        className="inline-block text-xs px-2 py-0.5 rounded font-semibold mb-2"
        style={{
          background: `${badgeColor}18`,
          border: `1px solid ${badgeColor}40`,
          color: badgeColor,
          fontFamily: 'DM Sans, sans-serif',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
        {badge}
      </span>
      <p className="text-xs mb-1" style={{ color: '#6a8fb0', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-word' }}>{impact}</p>
      {extra}
      <p className="text-xs leading-relaxed mt-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
        {explanation}
      </p>
    </div>
  )
}

function ZoneGreeksRow({ greeks }: { greeks: PortfolioGreeks }) {
  const deltaConf = DELTA_EXPOSURE_CONFIG[greeks.deltaExposure]
  const vegaConf  = VEGA_RISK_CONFIG[greeks.vegaRisk]
  const gammaConf = GAMMA_RISK_CONFIG[greeks.gammaRisk]

  const ivDataLine = greeks.positionsWithEstimatedIV > 0
    ? `${greeks.positionsWithEstimatedIV} position${greeks.positionsWithEstimatedIV > 1 ? 's' : ''} use estimated IV`
    : 'Live IV data'

  const ivDotColor = greeks.positionsWithEstimatedIV > 0 ? '#f59e0b' : '#00d68f'

  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">

        {/* Delta */}
        <GreekCard
          title="Delta"
          symbol="Δ"
          value={`${greeks.totalDelta >= 0 ? '+' : ''}${greeks.totalDelta.toFixed(1)}`}
          valueColor={greeks.totalDelta >= 0 ? '#14b8a6' : '#f59e0b'}
          badge={`${deltaConf.arrow} ${deltaConf.label}`}
          badgeColor={deltaConf.color}
          impact={`$${Math.abs(greeks.dollarDeltaPerPoint).toFixed(0)} per $1 avg move`}
          explanation={`Portfolio moves ~$${Math.abs(greeks.dollarDeltaPerPoint).toFixed(0)} if all stocks move $1 simultaneously`}
          tooltip="Delta measures your portfolio's sensitivity to stock price moves. Positive delta: you benefit if stocks rise (typical for CSP sellers). Negative delta: you benefit if stocks fall (typical for CC sellers). Your delta changes as stock prices move — that's gamma."
        />

        {/* Theta */}
        <GreekCard
          title="Theta"
          symbol="Θ"
          value={`+$${greeks.dailyThetaIncome.toFixed(2)}/day`}
          valueColor="#14b8a6"
          badge={`Week: +$${greeks.weeklyThetaIncome.toFixed(2)}`}
          badgeColor="#14b8a6"
          impact={`Max: +$${greeks.monthlyThetaIncome.toFixed(2)}`}
          explanation={`Time decay earns you $${greeks.dailyThetaIncome.toFixed(2)} today even if all stocks stay exactly flat`}
          tooltip="Theta is your best friend as a wheel trader. Options lose value every day from time decay — as the seller, you collect this decay as income. Theta accelerates as options approach expiry, which is why positions under 21 DTE earn decay fastest."
        />

        {/* Vega */}
        <GreekCard
          title="Vega"
          symbol="V"
          value={`${greeks.totalVega >= 0 ? '+' : ''}$${greeks.totalVega.toFixed(2)}`}
          valueColor={greeks.totalVega >= 0 ? '#00d68f' : '#ef4444'}
          badge={vegaConf.label}
          badgeColor={vegaConf.color}
          impact={`$${Math.abs(greeks.dollarVegaPerPoint).toFixed(0)} per 1% IV move`}
          explanation="Rising IV increases option prices — as a seller, this creates unrealised losses until expiry"
          tooltip="Vega measures sensitivity to implied volatility changes. As an option seller, you are short vega: if IV rises, options become more expensive = unrealised loss. If IV falls, options become cheaper = unrealised gain. High IV is why you entered the trade — now you want it to drop."
          extra={
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs" style={{ color: greeks.scenarios.ivUp10Percent >= 0 ? '#14b8a6' : '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
                IV+10%: {fmtDollar(greeks.scenarios.ivUp10Percent, true)}
              </span>
              <span className="text-xs" style={{ color: greeks.scenarios.ivDown10Percent >= 0 ? '#14b8a6' : '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
                IV−10%: {fmtDollar(greeks.scenarios.ivDown10Percent, true)}
              </span>
            </div>
          }
        />

        {/* Gamma */}
        <GreekCard
          title="Gamma"
          symbol="Γ"
          value={`${greeks.totalGamma.toFixed(4)}`}
          valueColor={greeks.gammaRisk === 'low' ? '#14b8a6' : greeks.gammaRisk === 'moderate' ? '#f59e0b' : '#ef4444'}
          badge={gammaConf.label}
          badgeColor={gammaConf.color}
          impact={`Risk: ${greeks.gammaRisk}`}
          explanation="Short gamma means sharp market moves can cause accelerating losses"
          tooltip="Gamma measures how fast your delta changes as stocks move. As a seller, you are short gamma: large moves in either direction hurt you more than expected. This risk increases sharply as positions approach expiry. Positions under 7 DTE carry the highest gamma risk."
        />
      </div>

      {/* Data quality indicator */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: ivDotColor }} />
          <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{ivDataLine}</span>
          <span className="text-xs" style={{ color: '#2e4060', fontFamily: 'DM Sans, sans-serif' }}>·</span>
          <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Calculated {timeAgo(greeks.calculatedAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Zone C: Scenario analysis ─────────────────────────────────────────────────

function ScenarioValue({ value }: { value: number }) {
  const color = value >= 0 ? '#14b8a6' : '#ef4444'
  return (
    <span className="font-semibold tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
      {fmtDollar(value, true)}
    </span>
  )
}

function ZoneScenarios({ greeks }: { greeks: PortfolioGreeks }) {
  const leftRows: Array<{ label: string; value: number }> = [
    { label: 'All stocks +5%',  value: greeks.scenarios.stocksUp5Percent },
    { label: 'All stocks +10%', value: greeks.scenarios.stocksUp10Percent },
    { label: 'All stocks −5%',  value: greeks.scenarios.stocksDown5Percent },
    { label: 'All stocks −10%', value: greeks.scenarios.stocksDown10Percent },
  ]
  const rightRows: Array<{ label: string; value: number; accent?: boolean }> = [
    { label: '1 week (no move)',     value: greeks.scenarios.oneWeekFromNow },
    { label: 'IV up 10%',           value: greeks.scenarios.ivUp10Percent },
    { label: 'IV down 10%',         value: greeks.scenarios.ivDown10Percent },
    { label: 'All expire worthless', value: greeks.scenarios.atExpiry, accent: true },
  ]

  const rowBase: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: 8,
  }

  return (
    <div className="rounded-2xl p-5 sm:p-6 mb-4"
      style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
          Portfolio scenario analysis
        </h3>
      </div>
      <p className="text-xs mb-5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
        Estimated P&L change from current position values
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: price scenarios */}
        <div>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.1em' }}>
            Price moves
          </p>
          <div className="space-y-1">
            {leftRows.map((row, i) => (
              <div key={row.label} style={{ ...rowBase, background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                <span className="text-sm" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>{row.label}</span>
                <ScenarioValue value={row.value} />
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: '#2e4060', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic' }}>
            Uses delta + gamma approximation across positions
          </p>
        </div>

        {/* Right: time and IV scenarios */}
        <div>
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.1em' }}>
            Time & volatility
          </p>
          <div className="space-y-1">
            {rightRows.map((row, i) => (
              <div
                key={row.label}
                style={{
                  ...rowBase,
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  ...(row.accent ? { borderLeft: '2px solid #14b8a6', paddingLeft: 10 } : {}),
                }}
              >
                <span className="text-sm" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>{row.label}</span>
                <ScenarioValue value={row.value} />
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: '#2e4060', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic' }}>
            Approximations based on Black-Scholes Greeks
          </p>
        </div>
      </div>

      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(0,229,196,0.06)' }}>
        <p className="text-xs" style={{ color: '#2e4060', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
          Scenario estimates use delta and gamma approximations and assume instantaneous simultaneous moves in all positions. Actual results will differ based on individual stock correlations, IV changes, and time. Not financial advice.
        </p>
      </div>
    </div>
  )
}

// ── Zone D: Position breakdown table ─────────────────────────────────────────

const MONEYNESS_COLORS: Record<string, string> = {
  'Deep OTM': '#14b8a6',
  'OTM':      '#0d9488',
  'ATM':      '#f59e0b',
  'ITM':      '#f97316',
  'Deep ITM': '#ef4444',
}

function ZonePositionBreakdown({ greeks }: { greeks: PortfolioGreeks }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl mb-4 overflow-hidden"
      style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', backdropFilter: 'blur(12px)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span className="text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
          Position breakdown ({greeks.positions.length} open)
        </span>
        <span style={{ color: '#4a6a8a', fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ⌄
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto" style={{ borderTop: '1px solid rgba(0,229,196,0.08)' }}>
          <table className="w-full text-xs" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                {['Ticker', 'Strategy', 'DTE', 'Δ Delta', 'Θ /day', 'V Vega', 'Γ Gamma', 'Moneyness'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left" style={{ color: '#4a6a8a', borderBottom: '1px solid rgba(0,229,196,0.08)', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {greeks.positions.map((pos, i) => {
                const isAtm = pos.moneynessLabel === 'ATM' || pos.moneynessLabel === 'ITM' || pos.moneynessLabel === 'Deep ITM'
                const rowBg = isAtm ? 'rgba(245,158,11,0.04)' : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                return (
                  <tr key={pos.positionId} style={{ background: rowBg }}>
                    <td className="px-4 py-2.5">
                      <div>
                        <div className="font-bold" style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</div>
                        {pos.currentPrice > 0 && (
                          <div style={{ color: '#4a6a8a', fontSize: 10 }}>${pos.currentPrice.toFixed(2)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{
                          color: pos.strategy === 'CSP' ? '#00c6f5' : '#00e5c4',
                          background: pos.strategy === 'CSP' ? 'rgba(0,198,245,0.1)' : 'rgba(0,229,196,0.1)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                        {pos.strategy}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{
                        color: pos.dte <= 7 ? '#ef4444' : pos.dte <= 14 ? '#f59e0b' : '#9ab4d4',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>
                        {pos.dte}d
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: pos.sellerDelta >= 0 ? '#14b8a6' : '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>
                        {pos.sellerDelta >= 0 ? '+' : ''}{pos.sellerDelta.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace' }}>
                        +${pos.dollarThetaToday.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: pos.sellerVega < 0 ? '#ef4444' : '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                        {fmtDollar(pos.dollarVegaImpact, true)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                        {pos.sellerGamma.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{
                          color: MONEYNESS_COLORS[pos.moneynessLabel] ?? '#9ab4d4',
                          background: `${MONEYNESS_COLORS[pos.moneynessLabel] ?? '#9ab4d4'}18`,
                          fontFamily: 'JetBrains Mono, monospace',
                          whiteSpace: 'nowrap',
                        }}>
                        {pos.moneynessLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {greeks.positions.length > 1 && (
              <tfoot>
                <tr style={{ borderTop: '1px solid rgba(0,229,196,0.08)' }}>
                  <td className="px-4 py-2.5 font-bold" colSpan={2} style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif' }}>Portfolio total</td>
                  <td className="px-4 py-2.5" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>{greeks.weightedAverageDTE.toFixed(0)}d avg</td>
                  <td className="px-4 py-2.5 font-bold" style={{ color: greeks.totalDelta >= 0 ? '#14b8a6' : '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>
                    {greeks.totalDelta >= 0 ? '+' : ''}{greeks.totalDelta.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 font-bold" style={{ color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace' }}>
                    +${greeks.dailyThetaIncome.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 font-bold" style={{ color: greeks.totalVega < 0 ? '#ef4444' : '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                    {fmtDollar(greeks.totalVega, true)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>{greeks.totalGamma.toFixed(4)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

// ── Zone E: Education ─────────────────────────────────────────────────────────

function ZoneEducation({ greeks }: { greeks: PortfolioGreeks }) {
  const [open, setOpen] = useState(false)

  const cards = [
    {
      icon: '⏳',
      title: 'Theta is your daily income',
      body: `Every day that passes, your options lose time value. As the seller, you keep that lost value as profit. Your $${greeks.dailyThetaIncome.toFixed(2)}/day theta means the market is paying you that amount today for taking on assignment risk — even if stocks don't move.`,
    },
    {
      icon: '📈',
      title: 'Delta tells your market bias',
      body: `Your portfolio delta of ${greeks.totalDelta.toFixed(1)} means you ${greeks.totalDelta > 0 ? 'benefit slightly from rising markets' : 'benefit slightly from falling markets'}. As a CSP seller, you naturally have positive delta because you agreed to buy shares — you want stocks to stay stable or rise slightly.`,
    },
    {
      icon: '⚡',
      title: 'Vega: the IV risk',
      body: 'You sold options when IV was high — now you want IV to drop or stay stable. If IV spikes further, your positions show unrealised losses even if stocks don\'t move. This is temporary — if you hold to expiry, vega risk disappears completely.',
    },
    {
      icon: '🎯',
      title: 'Gamma near expiry',
      body: 'As your positions approach expiry, gamma risk increases. This means a $1 stock move has a bigger impact on your position than it did when you opened it. Positions under 7 DTE carry the highest gamma risk — be especially careful with near-strike positions this close to expiry.',
    },
  ]

  return (
    <div className="rounded-2xl overflow-hidden mb-4"
      style={{ background: 'rgba(13,27,53,0.6)', border: '1px solid rgba(0,229,196,0.1)', backdropFilter: 'blur(12px)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            Understanding your Greeks
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,229,196,0.08)', color: '#4a6a8a', border: '1px solid rgba(0,229,196,0.12)' }}>ⓘ</span>
        </div>
        <span style={{ color: '#4a6a8a', fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ⌄
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 pb-5" style={{ borderTop: '1px solid rgba(0,229,196,0.08)' }}>
          {cards.map(card => (
            <div key={card.title} className="rounded-xl p-4 mt-4"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-2xl mb-2">{card.icon}</div>
              <h4 className="text-sm font-semibold mb-2" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>{card.title}</h4>
              <p className="text-xs leading-relaxed" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>{card.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PortfolioGreeksDashboard({ greeks, isLoading }: PortfolioGreeksDashboardProps) {
  const { isPaperMode } = usePaperMode()

  const wrapperStyle: React.CSSProperties = isPaperMode
    ? { borderLeft: '3px solid rgba(245,200,66,0.6)', paddingLeft: 0 }
    : {}

  if (isLoading) {
    return (
      <div className="mb-6">
        <SectionHeader isPaper={isPaperMode} updatedAt={null} />
        <LoadingSkeleton />
      </div>
    )
  }

  if (!greeks || greeks.positions.length === 0) {
    return (
      <div className="mb-6" style={wrapperStyle}>
        <SectionHeader isPaper={isPaperMode} updatedAt={null} />
        <EmptyGreeks />
      </div>
    )
  }

  return (
    <div className="mb-6" style={wrapperStyle}>
      <SectionHeader isPaper={isPaperMode} updatedAt={greeks.calculatedAt} />
      <ZoneThetaHero greeks={greeks} />
      <ZoneGreeksRow greeks={greeks} />
      <ZoneScenarios greeks={greeks} />
      <ZonePositionBreakdown greeks={greeks} />
      <ZoneEducation greeks={greeks} />
    </div>
  )
}

function SectionHeader({ isPaper, updatedAt }: { isPaper: boolean; updatedAt: string | null }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1, #e8f0fe)' }}>
            Portfolio Greeks
          </h2>
          {isPaper && (
            <span className="text-xs px-1.5 py-0.5 rounded font-semibold tracking-widest"
              style={{ background: 'rgba(245,200,66,0.12)', color: '#f5c842', fontFamily: 'JetBrains Mono, monospace' }}>
              PAPER
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Real-time risk metrics across your open positions
        </p>
      </div>
      {updatedAt && (
        <span className="text-xs" style={{ color: '#2e4060', fontFamily: 'DM Sans, sans-serif' }}>
          Updated {timeAgo(updatedAt)}
        </span>
      )}
    </div>
  )
}
