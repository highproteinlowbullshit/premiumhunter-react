import { useState } from 'react'
import {
  Newspaper, TrendingUp, TrendingDown, Minus,
  Settings2, Target, BarChart2, CalendarOff,
  Clock, ExternalLink, AlertTriangle, BarChart,
} from 'lucide-react'
import type { MarketPulse, MarketNewsArticle, SentimentHistoryPoint } from '../hooks/useMarketPulse'
import { MiniSparkline } from './MiniSparkline'

interface OpenPosition {
  ticker:   string
  strategy: string
  strike?:  number
}

interface Props {
  pulse:             MarketPulse | null
  allArticles:       MarketNewsArticle[]
  watchlistArticles: MarketNewsArticle[]
  sentimentHistory:  SentimentHistoryPoint[]
  openPositions:     OpenPosition[]
  isLoading:         boolean
  isWeekend:         boolean
}

type Tab = 'pulse' | 'news' | 'tickers' | 'sectors'

const SENTIMENT_COLOR: Record<string, string> = {
  bullish:          '#22c55e',
  slightly_bullish: '#14b8a6',
  neutral:          'var(--ph-text-3)',
  slightly_bearish: '#f59e0b',
  bearish:          '#ef4444',
}

function SentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === 'bullish')          return <TrendingUp size={16} color="#22c55e" />
  if (sentiment === 'slightly_bullish') return <TrendingUp size={14} color="#14b8a6" style={{ opacity: 0.75 }} />
  if (sentiment === 'slightly_bearish') return <TrendingDown size={14} color="#f59e0b" style={{ opacity: 0.75 }} />
  if (sentiment === 'bearish')          return <TrendingDown size={16} color="#ef4444" />
  return <Minus size={16} color="var(--ph-text-3)" />
}

const cardBase: React.CSSProperties = {
  background:   'rgba(13,27,53,0.6)',
  border:       '0.5px solid rgba(0,229,196,0.12)',
  borderRadius: 12,
  marginBottom: 20,
  overflow:     'hidden',
}

const cardPad: React.CSSProperties = { padding: '20px 24px' }

export function MarketPulseCard({
  pulse, allArticles, watchlistArticles, sentimentHistory, openPositions, isLoading, isWeekend,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pulse')

  if (isLoading) {
    return (
      <div style={{ ...cardBase, ...cardPad }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Newspaper size={16} color="#00e5c4" />
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>AI Market Pulse</span>
        </div>
        {[100, 75, 55].map(w => (
          <div key={w} style={{
            height: 12, borderRadius: 6, marginBottom: 10,
            background: 'rgba(255,255,255,0.05)', width: `${w}%`,
          }} />
        ))}
      </div>
    )
  }

  if (isWeekend) {
    return (
      <div style={{ ...cardBase, ...cardPad, textAlign: 'center', padding: '36px 24px' }}>
        <CalendarOff size={28} color="var(--ph-text-3)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ph-text-2)' }}>
          Markets closed. AI Market Pulse resumes Monday.
        </p>
      </div>
    )
  }

  if (!pulse) {
    return (
      <div style={{ ...cardBase, ...cardPad, textAlign: 'center', padding: '36px 24px' }}>
        <Clock size={28} color="var(--ph-text-3)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ph-text-2)' }}>
          Market pulse generating... check back shortly.
        </p>
      </div>
    )
  }

  const sentimentColor = SENTIMENT_COLOR[pulse.market_sentiment] ?? 'var(--ph-text-3)'

  // Client-side position impact matching
  const positionMatches = openPositions
    .map(pos => ({ ...pos, newsContext: pulse.mentioned_ticker_context[pos.ticker] ?? null }))
    .filter(p => p.newsContext !== null)

  const tabs: Array<[Tab, string]> = [
    ['pulse',   'Market pulse'],
    ['news',    `All news (${allArticles.length})`],
    ['tickers', `Your tickers (${watchlistArticles.length})`],
    ['sectors', 'Sectors'],
  ]

  return (
    <div style={cardBase}>
      {/* ── Header ── */}
      <div style={{ ...cardPad, paddingBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Newspaper size={16} color="#00e5c4" />
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>AI Market Pulse</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ph-text-3)' }}>
            {new Date(pulse.pulse_date + 'T12:00:00').toLocaleDateString('en-SG', {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* ── Live market numbers strip ── */}
      {pulse.market_context && (
        <div style={{
          padding: '8px 24px',
          borderTop:    '0.5px solid rgba(0,229,196,0.08)',
          borderBottom: '0.5px solid rgba(0,229,196,0.08)',
          display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
          background: 'rgba(0,0,0,0.15)',
        }}>
          {[
            {
              label: 'SPY',
              value: pulse.market_context.spy_change,
              fmt:   (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
              color: (v: number) => v >= 0 ? '#22c55e' : '#ef4444',
            },
            {
              label: 'VIX',
              value: pulse.market_context.vix_level,
              fmt:   (v: number) => v.toFixed(1),
              color: (v: number) => v > 25 ? '#ef4444' : v > 18 ? '#f59e0b' : '#22c55e',
            },
            {
              label: 'BTC',
              value: pulse.market_context.btc_change,
              fmt:   (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
              color: (v: number) => v >= 0 ? '#22c55e' : '#ef4444',
            },
          ].filter(item => item.value !== null).map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {item.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: item.color(item.value as number) }}>
                {item.fmt(item.value as number)}
              </span>
            </div>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ph-text-3)', fontStyle: 'italic' }}>
            {pulse.pulse_type === 'post_market' ? 'Post-market' : 'Pre-market'}
          </span>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ ...cardPad, paddingTop: 16, paddingBottom: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
          {tabs.map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding:      '6px 14px',
                background:   'transparent',
                border:       'none',
                cursor:       'pointer',
                fontSize:     12,
                fontFamily:   'DM Sans, sans-serif',
                color:        activeTab === tab ? '#00e5c4' : 'var(--ph-text-3)',
                borderBottom: activeTab === tab ? '2px solid #00e5c4' : '2px solid transparent',
                fontWeight:   activeTab === tab ? 600 : 400,
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'pulse' && (
          <PulseTab
            pulse={pulse}
            sentimentColor={sentimentColor}
            sentimentHistory={sentimentHistory}
            positionMatches={positionMatches}
          />
        )}
        {activeTab === 'news'    && <ArticleList articles={allArticles} emptyLabel="No articles today." />}
        {activeTab === 'tickers' && <ArticleList articles={watchlistArticles} emptyLabel="No articles match your watchlist." />}
        {activeTab === 'sectors' && <SectorsTab pulse={pulse} />}
      </div>
    </div>
  )
}

// ── PulseTab ───────────────────────────────────────────────────────────────────

interface PositionMatch extends OpenPosition { newsContext: string | null }

function PulseTab({
  pulse, sentimentColor, sentimentHistory, positionMatches,
}: {
  pulse:            MarketPulse
  sentimentColor:   string
  sentimentHistory: SentimentHistoryPoint[]
  positionMatches:  PositionMatch[]
}) {
  const oldScore = sentimentHistory[0]?.sentiment_score ?? null
  const improving = oldScore !== null && pulse.sentiment_score > oldScore

  return (
    <div>
      {/* Sentiment + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <SentimentIcon sentiment={pulse.market_sentiment} />
        <span style={{ fontSize: 13, fontWeight: 700, color: sentimentColor, textTransform: 'capitalize' }}>
          {pulse.market_sentiment.replace(/_/g, ' ')}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ph-text-3)' }}>
          ({pulse.sentiment_score > 0 ? '+' : ''}{pulse.sentiment_score})
        </span>
      </div>

      {/* Sentiment sparkline (shows after 2+ days of data) */}
      {sentimentHistory.length >= 2 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
          padding: '10px 14px',
          background: 'rgba(0,0,0,0.2)', borderRadius: 8,
          border: '0.5px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {sentimentHistory.length}-day trend
            </p>
            <MiniSparkline values={sentimentHistory.map(h => h.sentiment_score)} color="#14b8a6" />
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--ph-text-2)' }}>
              {oldScore !== null ? `${oldScore > 0 ? '+' : ''}${oldScore}  ` : ''}
              {pulse.sentiment_score > 0 ? '+' : ''}{pulse.sentiment_score}
            </p>
            {oldScore !== null && (
              <p style={{ margin: '2px 0 0', fontSize: 10, color: improving ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                {improving
                  ? <><TrendingUp size={10} /> Improving</>
                  : <><TrendingDown size={10} /> Deteriorating</>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Headline */}
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ph-text-1)', marginBottom: 10, lineHeight: 1.5 }}>
        {pulse.headline}
      </p>

      {/* Summary */}
      <p style={{ fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.7, marginBottom: 16 }}>
        {pulse.summary}
      </p>

      {/* Earnings warning */}
      {pulse.earnings_this_week.length > 0 && (
        <div style={{
          padding: '10px 14px', marginBottom: 14,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <AlertTriangle size={11} color="#ef4444" />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Earnings this week — avoid selling premium
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {pulse.earnings_this_week.map((e, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: e.days_until <= 2 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)',
                border:     `1px solid ${e.days_until <= 2 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                color:      e.days_until <= 2 ? '#ef4444' : '#f59e0b',
              }}>
                {e.ticker}{' '}
                <span style={{ fontWeight: 400, opacity: 0.8 }}>
                  {e.days_until === 0 ? '(today)' : e.days_until === 1 ? '(tomorrow)' : `(${e.days_until}d)`}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* IV environment score */}
      {pulse.iv_environment_score !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
          padding: '10px 14px', borderRadius: 8,
          background: pulse.iv_environment_score >= 65
            ? 'rgba(20,184,166,0.06)' : pulse.iv_environment_score >= 45
            ? 'rgba(0,0,0,0.15)' : 'rgba(239,68,68,0.05)',
          border: `0.5px solid ${pulse.iv_environment_score >= 65
            ? 'rgba(20,184,166,0.2)' : pulse.iv_environment_score >= 45
            ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <BarChart size={10} color="var(--ph-text-3)" />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                IV for sellers
              </span>
            </div>
            <div style={{ width: 100, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width:  `${pulse.iv_environment_score}%`,
                background: pulse.iv_environment_score >= 65 ? '#14b8a6' : pulse.iv_environment_score >= 45 ? '#f59e0b' : '#ef4444',
                borderRadius: 3, transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
          <div>
            <p style={{
              margin: '0 0 2px', fontSize: 13, fontWeight: 700,
              color: pulse.iv_environment_score >= 65 ? '#14b8a6' : pulse.iv_environment_score >= 45 ? '#f59e0b' : '#ef4444',
            }}>
              {pulse.iv_environment_label} ({pulse.iv_environment_score}/100)
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--ph-text-3)' }}>
              Based on IV ranks across wheel stocks
            </p>
          </div>
        </div>
      )}

      {/* Position impact */}
      {positionMatches.length > 0 && (
        <div style={{ marginBottom: 14, border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            padding: '7px 14px',
            background: 'rgba(0,0,0,0.2)',
            borderBottom: '0.5px solid rgba(255,255,255,0.06)',
            fontSize: 10, fontWeight: 700, color: 'var(--ph-text-3)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Your positions in today's news
          </div>
          {positionMatches.map((pos, i) => (
            <div key={i} style={{
              padding: '8px 14px',
              borderBottom: i < positionMatches.length - 1 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                padding: '2px 6px', borderRadius: 4,
                fontSize: 10, fontWeight: 700,
                background: pos.strategy === 'CSP' ? 'rgba(20,184,166,0.15)' : 'rgba(245,158,11,0.15)',
                color:      pos.strategy === 'CSP' ? '#14b8a6' : '#f59e0b',
              }}>
                {pos.strategy}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ph-text-1)' }}>
                {pos.ticker}{pos.strike ? ` $${pos.strike}` : ''}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ph-text-2)', flex: 1 }}>
                — {pos.newsContext}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Options context */}
      <InfoBox icon={<Settings2 size={11} color="#00e5c4" />} label="Options context" accent="#00e5c4">
        {pulse.options_context}
      </InfoBox>

      {/* Wheel stocks */}
      <InfoBox icon={<Target size={11} color="#14b8a6" />} label="Wheel stocks" accent="#14b8a6">
        {pulse.wheel_relevant_context}
      </InfoBox>

      {/* VIX line */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 16 }}>
        <BarChart2 size={11} color="var(--ph-text-3)" style={{ marginTop: 3, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--ph-text-2)', lineHeight: 1.6 }}>{pulse.vix_context}</span>
      </div>

      {/* Key themes */}
      {pulse.key_themes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {pulse.key_themes.map(theme => (
            <span key={theme} style={{
              fontSize: 11, padding: '3px 9px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, color: 'var(--ph-text-2)',
            }}>
              {theme}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: 10, color: 'var(--ph-text-3)', display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        <span>{pulse.model_used}</span>
        <span>·</span>
        <span>{pulse.news_articles_used} articles</span>
        <span>·</span>
        <span>Not financial advice</span>
      </div>
    </div>
  )
}

// ── SectorsTab ─────────────────────────────────────────────────────────────────

function SectorsTab({ pulse }: { pulse: MarketPulse }) {
  if (pulse.sector_pulse.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--ph-text-3)', textAlign: 'center', padding: '24px 0', margin: 0 }}>
        Sector rotation data not available yet.
      </p>
    )
  }

  const SECTOR_COLOR: Record<string, string> = { bullish: '#22c55e', bearish: '#ef4444', neutral: 'var(--ph-text-3)' }

  function SectorIcon({ sentiment }: { sentiment: string }) {
    if (sentiment === 'bullish')  return <TrendingUp   size={12} />
    if (sentiment === 'bearish')  return <TrendingDown size={12} />
    return <Minus size={12} />
  }

  return (
    <div>
      {pulse.sector_pulse.map((s, i) => {
        const color = SECTOR_COLOR[s.sentiment] ?? 'var(--ph-text-3)'
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0',
            borderBottom: i < pulse.sector_pulse.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
          }}>
            <span style={{ color, flexShrink: 0, display: 'flex' }}>
              <SectorIcon sentiment={s.sentiment} />
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: 'var(--ph-text-1)' }}>
                {s.sector}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ph-text-2)', lineHeight: 1.5 }}>
                {s.note}
              </p>
            </div>
            <span style={{
              padding: '2px 8px', borderRadius: 10,
              fontSize: 10, fontWeight: 600,
              background: `${color}15`, color, border: `1px solid ${color}30`,
              textTransform: 'capitalize', flexShrink: 0,
            }}>
              {s.sentiment}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── InfoBox ────────────────────────────────────────────────────────────────────

function InfoBox({
  icon, label, accent, children,
}: {
  icon: React.ReactNode; label: string; accent: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background:   `rgba(${accent === '#00e5c4' ? '0,229,196' : '20,184,166'},0.04)`,
      border:       `1px solid rgba(${accent === '#00e5c4' ? '0,229,196' : '20,184,166'},0.12)`,
      borderRadius: 8, padding: '12px 14px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--ph-text-2)', lineHeight: 1.6 }}>{children}</p>
    </div>
  )
}

// ── ArticleList ────────────────────────────────────────────────────────────────

function ArticleList({ articles, emptyLabel }: { articles: MarketNewsArticle[]; emptyLabel: string }) {
  if (articles.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--ph-text-3)', textAlign: 'center', padding: '24px 0', margin: 0 }}>
        {emptyLabel}
      </p>
    )
  }
  return (
    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
      {articles.map(a => (
        <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--ph-text-1)', lineHeight: 1.5, flex: 1 }}>
              {a.headline}
            </span>
            <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, marginTop: 3 }}>
              <ExternalLink size={10} color="var(--ph-text-3)" />
            </a>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--ph-text-3)' }}>
            <span>{a.source}</span>
            {Array.isArray(a.related_tickers) && a.related_tickers.length > 0 && (
              <span>{a.related_tickers.slice(0, 4).join(', ')}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
