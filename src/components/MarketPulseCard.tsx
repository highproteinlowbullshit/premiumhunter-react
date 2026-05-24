import { useState } from 'react'
import {
  Newspaper, TrendingUp, TrendingDown, Minus,
  Settings2, Target, BarChart2, CalendarOff,
  Clock, ExternalLink,
} from 'lucide-react'
import type { MarketPulse, MarketNewsArticle } from '../hooks/useMarketPulse'

interface Props {
  pulse:             MarketPulse | null
  allArticles:       MarketNewsArticle[]
  watchlistArticles: MarketNewsArticle[]
  isLoading:         boolean
  isWeekend:         boolean
}

type Tab = 'pulse' | 'news' | 'tickers'

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
  padding:      '20px 24px',
  marginBottom: 20,
}

export function MarketPulseCard({
  pulse, allArticles, watchlistArticles, isLoading, isWeekend,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pulse')

  if (isLoading) {
    return (
      <div style={cardBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Newspaper size={16} color="#00e5c4" />
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>AI Market Pulse</span>
        </div>
        {[100, 75, 55].map(w => (
          <div key={w} style={{
            height: 12, borderRadius: 6, marginBottom: 10,
            background: 'rgba(255,255,255,0.05)',
            width: `${w}%`,
          }} />
        ))}
      </div>
    )
  }

  if (isWeekend) {
    return (
      <div style={{ ...cardBase, textAlign: 'center', padding: '36px 24px' }}>
        <CalendarOff size={28} color="var(--ph-text-3)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ph-text-2)' }}>
          Markets closed. AI Market Pulse resumes Monday.
        </p>
      </div>
    )
  }

  if (!pulse) {
    return (
      <div style={{ ...cardBase, textAlign: 'center', padding: '36px 24px' }}>
        <Clock size={28} color="var(--ph-text-3)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ph-text-2)' }}>
          Market pulse generating... check back shortly.
        </p>
      </div>
    )
  }

  const sentimentColor = SENTIMENT_COLOR[pulse.market_sentiment] ?? 'var(--ph-text-3)'

  const tabs: Array<[Tab, string]> = [
    ['pulse',   'Market pulse'],
    ['news',    `All news (${allArticles.length})`],
    ['tickers', `Your tickers (${watchlistArticles.length})`],
  ]

  return (
    <div style={cardBase}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Newspaper size={16} color="#00e5c4" />
        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>AI Market Pulse</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ph-text-3)' }}>
          {new Date(pulse.pulse_date + 'T00:00:00').toLocaleDateString('en-SG', {
            weekday: 'short', month: 'short', day: 'numeric',
          })}
        </span>
      </div>

      {/* Tabs */}
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

      {activeTab === 'pulse'   && <PulseTab pulse={pulse} sentimentColor={sentimentColor} />}
      {activeTab === 'news'    && <ArticleList articles={allArticles} emptyLabel="No articles today." />}
      {activeTab === 'tickers' && <ArticleList articles={watchlistArticles} emptyLabel="No articles match your watchlist." />}
    </div>
  )
}

function PulseTab({ pulse, sentimentColor }: { pulse: MarketPulse; sentimentColor: string }) {
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

      {/* Headline */}
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ph-text-1)', marginBottom: 10, lineHeight: 1.5 }}>
        {pulse.headline}
      </p>

      {/* Summary */}
      <p style={{ fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.7, marginBottom: 16 }}>
        {pulse.summary}
      </p>

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
              fontSize:   11,
              padding:    '3px 9px',
              background: 'rgba(255,255,255,0.05)',
              border:     '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              color:      'var(--ph-text-2)',
            }}>
              {theme}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        paddingTop: 12,
        borderTop:  '1px solid rgba(255,255,255,0.05)',
        fontSize:   10,
        color:      'var(--ph-text-3)',
        display:    'flex',
        gap:        8,
        flexWrap:   'wrap',
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

function InfoBox({
  icon, label, accent, children,
}: {
  icon: React.ReactNode; label: string; accent: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background:   `rgba(${accent === '#00e5c4' ? '0,229,196' : '20,184,166'},0.04)`,
      border:       `1px solid rgba(${accent === '#00e5c4' ? '0,229,196' : '20,184,166'},0.12)`,
      borderRadius: 8,
      padding:      '12px 14px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon}
        <span style={{
          fontSize:      10,
          fontWeight:    600,
          color:         accent,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {label}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--ph-text-2)', lineHeight: 1.6 }}>
        {children}
      </p>
    </div>
  )
}

function ArticleList({
  articles, emptyLabel,
}: {
  articles: MarketNewsArticle[]; emptyLabel: string
}) {
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
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flexShrink: 0, marginTop: 3 }}
            >
              <ExternalLink size={10} color="var(--ph-text-3)" />
            </a>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--ph-text-3)' }}>
            <span>{a.source}</span>
            {a.related_tickers.length > 0 && (
              <span>{a.related_tickers.slice(0, 4).join(', ')}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
