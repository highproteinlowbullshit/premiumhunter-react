import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface MarketPulse {
  id:                       string
  pulse_date:               string
  pulse_type:               'pre_market' | 'post_market'
  market_sentiment:         'bullish' | 'slightly_bullish' | 'neutral' | 'slightly_bearish' | 'bearish'
  sentiment_score:          number
  headline:                 string
  summary:                  string
  options_context:          string
  key_themes:               string[]
  source_articles:          Array<{ title: string; source: string; url: string; datetime: number; tickers: string[] }>
  mentioned_tickers:        string[]
  wheel_relevant_context:   string
  vix_context:              string
  model_used:               string
  generated_at:             string
  news_articles_fetched:    number
  news_articles_used:       number
  // Enhanced fields
  iv_environment_score:     number | null
  iv_environment_label:     string | null
  sector_pulse:             Array<{ sector: string; sentiment: 'bullish' | 'neutral' | 'bearish'; note: string }>
  earnings_this_week:       Array<{ ticker: string; days_until: number; day_of_week: string; timing: string }>
  market_context:           {
    spy_change:   number | null
    vix_level:    number | null
    btc_change:   number | null
    market_phase: string | null
  } | null
  mentioned_ticker_context: Record<string, string>
}

export interface MarketNewsArticle {
  id:              string
  pulse_date:      string
  headline:        string
  summary:         string
  source:          string
  url:             string
  datetime:        string | null
  related_tickers: string[]
  category:        string
  relevance_score: number
  source_api:      string
}

export interface SentimentHistoryPoint {
  pulse_date:       string
  sentiment_score:  number
  market_sentiment: string
}

function isWeekendSGT(): boolean {
  const sgtMs  = Date.now() + 8 * 60 * 60 * 1000
  const sgtDay = new Date(sgtMs).getUTCDay()
  return sgtDay === 0 || sgtDay === 6
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

function mapPulseRow(pulse: Record<string, unknown>): MarketPulse {
  const mc = pulse.market_context as Record<string, unknown> | null
  return {
    id:                       pulse.id as string,
    pulse_date:               pulse.pulse_date as string,
    pulse_type:               (pulse.pulse_type as 'pre_market' | 'post_market') ?? 'pre_market',
    market_sentiment:         pulse.market_sentiment as MarketPulse['market_sentiment'],
    sentiment_score:          (pulse.sentiment_score as number) ?? 0,
    headline:                 (pulse.headline as string) ?? '',
    summary:                  (pulse.summary as string) ?? '',
    options_context:          (pulse.options_context as string) ?? '',
    key_themes:               Array.isArray(pulse.key_themes) ? pulse.key_themes as string[] : [],
    source_articles:          Array.isArray(pulse.source_articles) ? pulse.source_articles as MarketPulse['source_articles'] : [],
    mentioned_tickers:        Array.isArray(pulse.mentioned_tickers) ? pulse.mentioned_tickers as string[] : [],
    wheel_relevant_context:   (pulse.wheel_relevant_context as string) ?? '',
    vix_context:              (pulse.vix_context as string) ?? '',
    model_used:               (pulse.model_used as string) ?? '',
    generated_at:             (pulse.generated_at as string) ?? '',
    news_articles_fetched:    (pulse.news_articles_fetched as number) ?? 0,
    news_articles_used:       (pulse.news_articles_used as number) ?? 0,
    iv_environment_score:     pulse.iv_environment_score != null ? Number(pulse.iv_environment_score) : null,
    iv_environment_label:     (pulse.iv_environment_label as string | null) ?? null,
    sector_pulse:             Array.isArray(pulse.sector_pulse) ? pulse.sector_pulse as MarketPulse['sector_pulse'] : [],
    earnings_this_week:       Array.isArray(pulse.earnings_this_week) ? pulse.earnings_this_week as MarketPulse['earnings_this_week'] : [],
    market_context:           mc ? {
      spy_change:   mc.spy_change   != null ? Number(mc.spy_change)   : null,
      vix_level:    mc.vix_level    != null ? Number(mc.vix_level)    : null,
      btc_change:   mc.btc_change   != null ? Number(mc.btc_change)   : null,
      market_phase: (mc.market_phase as string) ?? null,
    } : null,
    mentioned_ticker_context: (pulse.mentioned_ticker_context && typeof pulse.mentioned_ticker_context === 'object')
      ? pulse.mentioned_ticker_context as Record<string, string>
      : {},
  }
}

export function useMarketPulse(watchlistTickers: string[]) {
  const isWeekend = isWeekendSGT()
  const today     = todayUTC()

  // Fetch both pre + post market pulses for today; prefer post_market if available
  const pulseQuery = useQuery({
    queryKey:        ['market-pulse', today],
    queryFn:         async (): Promise<MarketPulse | null> => {
      const { data, error } = await supabase
        .from('market_pulse')
        .select('*')
        .eq('pulse_date', today)
        .order('pulse_type', { ascending: false }) // post_market sorts before pre_market alphabetically
      if (error) throw error
      if (!data || data.length === 0) return null
      const postMarket = data.find(d => d.pulse_type === 'post_market')
      const preMarket  = data.find(d => d.pulse_type === 'pre_market')
      const row        = postMarket ?? preMarket
      return row ? mapPulseRow(row as Record<string, unknown>) : null
    },
    enabled:         !isWeekend,
    staleTime:       30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  })

  const newsQuery = useQuery({
    queryKey:        ['market-news', today],
    queryFn:         async (): Promise<MarketNewsArticle[]> => {
      const { data, error } = await supabase
        .from('market_news')
        .select('*')
        .eq('pulse_date', today)
        .order('relevance_score', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled:         !isWeekend,
    staleTime:       30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  })

  // Last 10 pre-market pulses for the sentiment sparkline
  const historyQuery = useQuery({
    queryKey:  ['market-pulse-history'],
    queryFn:   async (): Promise<SentimentHistoryPoint[]> => {
      const { data } = await supabase
        .from('market_pulse')
        .select('pulse_date, sentiment_score, market_sentiment')
        .eq('pulse_type', 'pre_market')
        .order('pulse_date', { ascending: false })
        .limit(10)
      return ((data ?? []) as SentimentHistoryPoint[]).reverse()
    },
    enabled:   !isWeekend,
    staleTime: 60 * 60 * 1000,
  })

  const allArticles       = newsQuery.data ?? []
  const watchlistArticles = watchlistTickers.length > 0
    ? allArticles.filter(a =>
        Array.isArray(a.related_tickers) &&
        a.related_tickers.some(t => watchlistTickers.includes(t))
      )
    : []

  // Client-side position impact matching — no AI call, pure lookup
  function matchPositionsToNews(
    positions: Array<{ ticker: string; strategy: string; strike?: number }>
  ) {
    const ctx = pulseQuery.data?.mentioned_ticker_context ?? {}
    return positions
      .map(pos => ({ ...pos, newsContext: ctx[pos.ticker] ?? null }))
      .filter(p => p.newsContext !== null)
  }

  return {
    pulse:              pulseQuery.data ?? null,
    allArticles,
    watchlistArticles,
    sentimentHistory:   historyQuery.data ?? [],
    matchPositionsToNews,
    isLoading:          pulseQuery.isLoading || newsQuery.isLoading,
    isAvailable:        !!pulseQuery.data,
    isWeekend,
  }
}
