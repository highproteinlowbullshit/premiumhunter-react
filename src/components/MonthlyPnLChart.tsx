import { useState, useRef } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { toPng } from 'html-to-image'
import { useMonthlyPnL, type MonthlyPnLData } from '../hooks/useMonthlyPnL'
import { usePaperMode } from '../context/PaperModeContext'

interface Props {
  compact?: boolean
}

// ── Custom bar shape — rounded top for positive, rounded bottom for negative ──
function RoundedBar(props: any) {
  const { x, y, width, height, isNegative, isHovered, isCurrentMonth, displayProjected } = props
  if (!height || height <= 0) return null

  const radius = 4
  const opacity = isHovered ? 1 : 0.85
  const hasProjected = isCurrentMonth && (displayProjected ?? 0) > 0

  if (isNegative) {
    const fill = isHovered ? '#f87171' : '#ef4444'
    // Rounded bottom corners
    return (
      <path
        d={`
          M ${x} ${y}
          L ${x + width} ${y}
          L ${x + width} ${y + height - radius}
          Q ${x + width} ${y + height} ${x + width - radius} ${y + height}
          L ${x + radius} ${y + height}
          Q ${x} ${y + height} ${x} ${y + height - radius}
          Z
        `}
        fill={fill}
        opacity={opacity}
      />
    )
  }

  const fill = isHovered ? '#2dd4bf' : '#00e5c4'

  if (hasProjected) {
    // Flat top — projected bar stacks above this one
    return <rect x={x} y={y} width={width} height={height} fill={fill} opacity={0.7} />
  }

  // Rounded top corners only
  return (
    <path
      d={`
        M ${x + radius} ${y}
        L ${x + width - radius} ${y}
        Q ${x + width} ${y} ${x + width} ${y + radius}
        L ${x + width} ${y + height}
        L ${x} ${y + height}
        L ${x} ${y + radius}
        Q ${x} ${y} ${x + radius} ${y}
        Z
      `}
      fill={fill}
      opacity={isCurrentMonth ? 0.7 : opacity}
    />
  )
}

// ── Tooltip ────────────────────────────────────────────────────
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const month: MonthlyPnLData = payload[0]?.payload
  if (!month) return null

  const winRateColor =
    month.winRate >= 70 ? '#00d68f' : month.winRate >= 50 ? '#f5c842' : '#ff4d6d'

  return (
    <div style={{
      background: '#0d1f30',
      border: '1px solid rgba(0,229,196,0.25)',
      borderRadius: 8,
      padding: '12px 16px',
      minWidth: 200,
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <p style={{ color: '#e8f0fe', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>
        {month.month}
      </p>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, marginBottom: 8 }}>
        <TRow
          label="Premium collected"
          value={`$${month.premiumCollected.toLocaleString()}`}
          color={month.premiumCollected >= 0 ? '#00d68f' : '#ff4d6d'}
        />
        {month.premiumOpen > 0 && month.isCurrentMonth && (
          <>
            <TRow
              label="Open (projected)"
              value={`+$${month.premiumOpen.toLocaleString()}`}
              color="rgba(0,229,196,0.6)"
              italic
            />
            <TRow
              label="Total potential"
              value={`$${(month.premiumCollected + month.premiumOpen).toLocaleString()}`}
              color="#00e5c4"
              bold
            />
          </>
        )}
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
        <TRow label="Positions closed" value={month.positionsClosed.toString()} />
        <TRow label="Win rate" value={`${month.winRate}%`} color={winRateColor} />
        {month.bestTrade && (
          <TRow
            label="Best trade"
            value={`+$${month.bestTrade.pnl.toLocaleString()} (${month.bestTrade.ticker})`}
            color="#00d68f"
          />
        )}
        {month.worstTrade && month.worstTrade.pnl < 0 && (
          <TRow
            label="Worst trade"
            value={`$${month.worstTrade.pnl.toLocaleString()} (${month.worstTrade.ticker})`}
            color="#ff4d6d"
          />
        )}
      </div>
      {month.isCurrentMonth && (
        <p style={{ color: '#4a6a8a', fontSize: 11, fontStyle: 'italic', marginTop: 6 }}>
          * Current month in progress
        </p>
      )}
    </div>
  )
}

function TRow({
  label, value, color, italic, bold,
}: {
  label: string; value: string; color?: string; italic?: boolean; bold?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
      <span style={{ color: '#9ab4d4', fontSize: 12 }}>{label}</span>
      <span style={{
        color: color ?? '#e8f0fe',
        fontSize: 12,
        fontStyle: italic ? 'italic' : 'normal',
        fontWeight: bold ? 600 : 400,
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Stat pill ──────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 6,
      padding: '4px 10px',
      textAlign: 'center',
    }}>
      {label && (
        <p style={{ color: '#4a6a8a', fontSize: 10, fontFamily: 'DM Sans, sans-serif', margin: '0 0 2px' }}>
          {label}
        </p>
      )}
      <p style={{ color, fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', margin: 0 }}>
        {value}
      </p>
    </div>
  )
}

// ── Footer stat card ───────────────────────────────────────────
function FooterStat({
  label, value, sub, valueColor, subColor,
}: {
  label: string; value: string; sub?: string; valueColor?: string; subColor?: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.04)',
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      <p style={{ color: '#4a6a8a', fontSize: 11, fontFamily: 'DM Sans, sans-serif', margin: '0 0 4px' }}>
        {label}
      </p>
      <p style={{
        color: valueColor ?? '#e8f0fe',
        fontSize: 18,
        fontWeight: 600,
        fontFamily: 'JetBrains Mono, monospace',
        margin: '0 0 2px',
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ color: subColor ?? '#4a6a8a', fontSize: 11, fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export function MonthlyPnLChart({ compact = false }: Props) {
  const { data, isLoading } = useMonthlyPnL()
  const { isPaperMode } = usePaperMode()
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)
  const [showProjected, setShowProjected] = useState(true)
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const cardStyle: React.CSSProperties = {
    background: 'rgba(13,27,53,0.6)',
    border: '1px solid rgba(0,229,196,0.1)',
    borderRadius: 16,
    padding: '20px 24px',
    backdropFilter: 'blur(12px)',
    marginBottom: compact ? 24 : 24,
  }

  // ── Loading skeleton ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="animate-pulse" style={{ width: 200, height: 20, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
          {!compact && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[100, 80, 90].map((w, i) => (
                <div key={i} className="animate-pulse" style={{ width: w, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
              ))}
            </div>
          )}
        </div>
        <div className="animate-pulse" style={{ width: '100%', height: compact ? 160 : 240, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />
        {!compact && (
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse" style={{ flex: 1, height: 60, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────
  if (!data || data.months.every(m => m.premiumCollected === 0 && m.premiumOpen === 0)) {
    return (
      <div style={{
        ...cardStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: compact ? 200 : 340,
        textAlign: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ marginBottom: 12 }}>
          <rect x="2" y="20" width="6" height="10" rx="2" fill="#00e5c4" opacity="0.3" />
          <rect x="10" y="14" width="6" height="16" rx="2" fill="#00e5c4" opacity="0.5" />
          <rect x="18" y="8" width="6" height="22" rx="2" fill="#00e5c4" opacity="0.7" />
          <rect x="24" y="2" width="6" height="28" rx="2" fill="#00e5c4" opacity="0.9" />
        </svg>
        <h3 style={{ color: '#e8f0fe', fontSize: 16, fontWeight: 600, fontFamily: 'Syne, sans-serif', margin: '0 0 8px' }}>
          Monthly premium income
        </h3>
        <p style={{ color: '#9ab4d4', fontSize: 14, fontFamily: 'DM Sans, sans-serif', maxWidth: 320, lineHeight: 1.6, margin: '0 0 8px' }}>
          Close your first wheel position to see your income chart. Premium income from closed
          trades appears here month by month.
        </p>
        <p style={{ color: '#4a6a8a', fontSize: 12, fontFamily: 'DM Sans, sans-serif', maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
          Your income compounds as you reinvest and add capital over time.
        </p>
      </div>
    )
  }

  const chartHeight = compact ? 160 : 240
  const hasProjectedData = data.months.some(m => m.isCurrentMonth && m.premiumOpen > 0)

  const chartData = data.months.map(month => ({
    ...month,
    displayCollected: month.premiumCollected,
    displayProjected: showProjected && month.isCurrentMonth ? month.premiumOpen : 0,
    isNegative: month.premiumCollected < 0,
    isHovered: month.monthKey === hoveredMonth,
  }))

  const handleShare = async () => {
    if (!exportRef.current) return
    setIsGenerating(true)
    try {
      const dataUrl = await toPng(exportRef.current, {
        backgroundColor: '#0f1923',
        pixelRatio: 2,
      })
      setShareImageUrl(dataUrl)
      setShowShareModal(true)
    } catch (err) {
      console.error('Share image generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!shareImageUrl) return
    const a = document.createElement('a')
    a.href = shareImageUrl
    a.download = `premium-income-${new Date().toISOString().slice(0, 7)}.png`
    a.click()
  }

  const handleCopy = async () => {
    if (!shareImageUrl) return
    try {
      const res = await fetch(shareImageUrl)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    } catch (err) {
      console.error('Copy to clipboard failed:', err)
    }
  }

  return (
    <>
      <div style={cardStyle} ref={exportRef}>
        {/* Paper badge */}
        {isPaperMode && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: 6, padding: '2px 8px', marginBottom: 10,
          }}>
            <span style={{ color: '#f5c842', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace' }}>
              PAPER
            </span>
          </div>
        )}

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h3 style={{ color: '#e8f0fe', fontSize: 16, fontWeight: 500, fontFamily: 'Syne, sans-serif', margin: 0 }}>
              Monthly premium income
            </h3>
            <p style={{ color: '#4a6a8a', fontSize: 12, fontFamily: 'DM Sans, sans-serif', margin: '4px 0 0' }}>
              Realized P&L from closed wheel positions
            </p>
          </div>

          {compact ? (
            <StatPill label="This year" value={`$${data.totalThisYear.toLocaleString()}`} color="#00e5c4" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <StatPill label="Total this year" value={`$${data.totalThisYear.toLocaleString()}`} color="#00d68f" />
              <StatPill label="Monthly avg" value={`$${data.averageMonthly.toLocaleString()}`} color="#00e5c4" />
              {data.streakMonths >= 2 && (
                <StatPill label="" value={`🔥 ${data.streakMonths} mo streak`} color="#f5c842" />
              )}
              {hasProjectedData && (
                <button
                  onClick={() => setShowProjected(p => !p)}
                  style={{
                    background: showProjected ? 'rgba(0,229,196,0.1)' : 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(0,229,196,0.15)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    color: showProjected ? '#00e5c4' : '#4a6a8a',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                    transition: 'all 0.2s',
                  }}
                >
                  Show projected
                </button>
              )}
              <button
                onClick={handleShare}
                disabled={isGenerating}
                style={{
                  background: 'rgba(0,229,196,0.08)',
                  border: '1px solid rgba(0,229,196,0.2)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  color: '#00e5c4',
                  fontSize: 11,
                  cursor: isGenerating ? 'default' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  opacity: isGenerating ? 0.7 : 1,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 7.5V1.5M3.5 4L6 1.5 8.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 8v2.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                {isGenerating ? 'Generating…' : 'Share'}
              </button>
            </div>
          )}
        </div>

        {/* Bar chart */}
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
            barSize={28}
            onMouseLeave={() => setHoveredMonth(null)}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,229,196,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value, index) => {
                const m = chartData[index]
                if (m?.monthKey.endsWith('-01')) return value
                return value.split(' ')[0]
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
                return `$${value}`
              }}
              width={48}
            />
            <ReferenceLine y={0} stroke="rgba(0,229,196,0.15)" strokeWidth={1} />
            {data.averageMonthly > 0 && (
              <ReferenceLine
                y={data.averageMonthly}
                stroke="rgba(0,229,196,0.25)"
                strokeDasharray="4 2"
                strokeWidth={1}
                label={{
                  value: 'avg',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'rgba(0,229,196,0.45)',
                }}
              />
            )}
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar
              dataKey="displayCollected"
              name="Premium collected"
              stackId="main"
              shape={RoundedBar}
              onMouseEnter={(barData: any) => setHoveredMonth(barData.monthKey)}
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="displayProjected"
              name="Open (projected)"
              stackId="main"
              fill="rgba(0,229,196,0.15)"
              stroke="#00e5c4"
              strokeWidth={1}
              strokeDasharray="3 2"
              radius={[4, 4, 0, 0] as any}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Footer stats */}
        {!compact && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid rgba(0,229,196,0.06)',
          }}>
            <FooterStat
              label="Best month"
              value={`$${data.bestMonthAmount.toLocaleString()}`}
              sub={data.bestMonth?.month ?? '—'}
              valueColor="#00e5c4"
            />
            <FooterStat
              label="This month"
              value={`$${data.currentMonthSoFar.toLocaleString()}`}
              sub={
                data.growthPercent !== null
                  ? `${data.growthPercent > 0 ? '+' : ''}${data.growthPercent}% vs last year`
                  : undefined
              }
              subColor={
                data.growthPercent !== null
                  ? data.growthPercent >= 0 ? '#00d68f' : '#ff4d6d'
                  : undefined
              }
              valueColor={data.currentMonthSoFar >= 0 ? '#00e5c4' : '#ff4d6d'}
            />
            <FooterStat
              label="All time"
              value={`$${data.totalAllTime.toLocaleString()}`}
              sub={`across ${data.months.filter(m => m.positionsClosed > 0).length} active months`}
              valueColor="#e8f0fe"
            />
          </div>
        )}

        {/* Share export watermark (shown in screenshot) */}
        {!compact && (
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <span style={{ color: 'rgba(0,229,196,0.2)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
              premiumhunter.xyz
            </span>
          </div>
        )}

        {/* Paper mode banner */}
        {isPaperMode && !compact && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            background: 'rgba(245,200,66,0.08)',
            border: '1px solid rgba(245,200,66,0.15)',
            borderRadius: 8,
            color: '#f5c842',
            fontSize: 12,
            fontFamily: 'DM Sans, sans-serif',
          }}>
            Showing paper trading income — switch to real mode to see your actual premium income
          </div>
        )}
      </div>

      {/* Share modal */}
      {showShareModal && shareImageUrl && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            style={{
              background: '#0a1628',
              border: '1px solid rgba(0,229,196,0.15)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 560,
              width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ color: '#e8f0fe', fontSize: 16, fontWeight: 600, fontFamily: 'Syne, sans-serif', margin: 0 }}>
                Share your income chart
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>

            <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <img src={shareImageUrl} alt="Premium income chart" style={{ width: '100%', display: 'block' }} />
            </div>

            <p style={{ color: '#4a6a8a', fontSize: 11, fontFamily: 'DM Sans, sans-serif', textAlign: 'center', marginBottom: 16 }}>
              Past performance is not indicative of future results.
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDownload}
                style={{
                  flex: 1, padding: '10px 0',
                  background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
                  border: 'none', borderRadius: 8,
                  color: '#050d1a', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Download PNG
              </button>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1, padding: '10px 0',
                  background: 'rgba(0,229,196,0.1)',
                  border: '1px solid rgba(0,229,196,0.2)',
                  borderRadius: 8,
                  color: '#00e5c4', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
