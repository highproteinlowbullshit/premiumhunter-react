import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface MarketPulse {
  id:                     string
  pulse_date:             string
  market_sentiment:       'bullish' | 'slightly_bullish' | 'neutral' | 'slightly_bearish' | 'bearish'
  sentiment_score:        number
  headline:               string
  summary:                string
  options_context:        string
  key_themes:             string[]
  source_articles:        Array<{ title: string; source: string; url: string; datetime: number; tickers: string[] }>
  mentioned_tickers:      string[]
  wheel_relevant_context: string
  vix_context:            string
  model_used:             string
  generated_at:           string
  news_articles_fetched:  number
  news_articles_used:     number
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

function isWeekendSGT(): boolean {
  // SGT = UTC+8; check if it's Saturday (6) or Sunday (0) there
  const sgtMs  = Date.now() + 8 * 60 * 60 * 1000
  const sgtDay = new Date(sgtMs).getUTCDay()
  return sgtDay === 0 || sgtDay === 6
}

function todaySGT(): string {
  const sgtMs = Date.now() + 8 * 60 * 60 * 1000
  return new Date(sgtMs).toISOString().split('T')[0]
}

export function useMarketPulse(watchlistTickers: string[]) {
  const isWeekend = isWeekendSGT()
  const today     = todaySGT()

  const pulseQuery = useQuery({
    queryKey:       ['market-pulse', today],
    queryFn:        async (): Promise<MarketPulse | null> => {
      const { data, error } = await supabase
        .from('market_pulse')
        .select('*')
        .eq('pulse_date', today)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled:        !isWeekend,
    staleTime:      30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  })

  const newsQuery = useQuery({
    queryKey:       ['market-news', today],
    queryFn:        async (): Promise<MarketNewsArticle[]> => {
      const { data, error } = await supabase
        .from('market_news')
        .select('*')
        .eq('pulse_date', today)
        .order('relevance_score', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled:        !isWeekend,
    staleTime:      30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  })

  const allArticles = newsQuery.data ?? []
  const watchlistArticles = watchlistTickers.length > 0
    ? allArticles.filter(a =>
        a.related_tickers.some(t => watchlistTickers.includes(t))
      )
    : []

  return {
    pulse:             pulseQuery.data ?? null,
    allArticles,
    watchlistArticles,
    isLoading:         pulseQuery.isLoading || newsQuery.isLoading,
    isAvailable:       !!pulseQuery.data,
    isWeekend,
  }
}
