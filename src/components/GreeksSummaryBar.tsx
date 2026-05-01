import type { PortfolioGreeks } from '../lib/blackScholes'

interface GreeksSummaryBarProps {
  greeks: PortfolioGreeks | null
  isLoading: boolean
}

function Pill({
  label, value, color, tooltip,
}: {
  label: string
  value: string
  color: string
  tooltip: string
}) {
  return (
    <div
      title={tooltip}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-default"
      style={{
        background: `${color}10`,
        border: `1px solid ${color}28`,
      }}
    >
      <span className="text-xs font-semibold" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
        {label}
      </span>
      <span className="text-xs font-bold tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </span>
    </div>
  )
}

export function GreeksSummaryBar({ greeks, isLoading }: GreeksSummaryBarProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mb-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-8 w-28 rounded-lg animate-pulse"
            style={{ background: 'rgba(0,229,196,0.05)', animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    )
  }

  if (!greeks || greeks.positions.length === 0) return null

  const gammaColor =
    greeks.gammaRisk === 'low' ? '#14b8a6'
    : greeks.gammaRisk === 'moderate' ? '#f59e0b'
    : '#ef4444'

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Pill
        label="Θ"
        value={`+$${greeks.dailyThetaIncome.toFixed(2)}/day`}
        color="#14b8a6"
        tooltip="Daily theta income — dollars earned today from time decay across all positions"
      />
      <Pill
        label="Δ"
        value={`${greeks.totalDelta >= 0 ? '+' : ''}${greeks.totalDelta.toFixed(1)}`}
        color={greeks.totalDelta >= 0 ? '#14b8a6' : '#f59e0b'}
        tooltip={`Net delta — portfolio moves ~$${Math.abs(greeks.dollarDeltaPerPoint).toFixed(0)} per $1 avg stock move. ${greeks.deltaExposure.replace('_', ' ')}.`}
      />
      <Pill
        label="V"
        value={`$${greeks.totalVega.toFixed(2)}`}
        color={greeks.totalVega < 0 ? '#ef4444' : '#00d68f'}
        tooltip={`Net vega — portfolio changes $${Math.abs(greeks.dollarVegaPerPoint).toFixed(0)} per 1% IV move. ${greeks.vegaRisk} IV risk.`}
      />
      <Pill
        label="Γ"
        value={greeks.totalGamma.toFixed(4)}
        color={gammaColor}
        tooltip={`Net gamma — ${greeks.gammaRisk} gamma risk. Large moves ${greeks.gammaRisk === 'low' ? 'have limited' : 'could have significant'} accelerating impact.`}
      />
    </div>
  )
}
