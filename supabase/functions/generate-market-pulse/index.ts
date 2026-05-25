import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET      = Deno.env.get('MARKET_PULSE_CRON_SECRET') ?? ''
const OPENROUTER_KEY   = Deno.env.get('OPENROUTER_API_KEY') ?? ''
const OPENROUTER_MODEL = Deno.env.get('OPENROUTER_MODEL') ?? 'mistralai/mistral-7b-instruct:free'
const FINNHUB_KEY      = Deno.env.get('FINNHUB_API_KEY') ?? ''
const POLYGON_KEY      = Deno.env.get('POLYGON_API_KEY') ?? ''  // used only for market context snapshots

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_FEEDS = ['general', 'forex', 'merger'] as const

const COMPANY_NEWS_TICKERS = [
  'TSLA', 'AAPL', 'NVDA', 'META', 'MSFT',
  'AMZN', 'GOOGL', 'AMD',  'PLTR', 'SOFI',
  'MARA', 'GME',  'DIS',  'INTC', 'SHOP',
]

const WHEEL_TICKERS = [
  'TSLA', 'AAPL', 'NVDA', 'META', 'MSFT', 'AMZN', 'GOOGL', 'AMD',
  'PLTR', 'SOFI', 'MARA', 'GME',  'DIS',  'INTC', 'SHOP',
  'SPY',  'QQQ',  'VIX',
]

const MARKET_KEYWORDS = [
  'options', 'volatility', ' iv ', 'earnings', 'wheel', 'premium',
  'puts', 'calls', 'expir', 'dividend', 'guidance', 'revenue',
  'fed ', 'interest rate', 'inflation', 'recession', 'rally',
  'selloff', 'acquisition', 'merger', 'buyback',
]

const EQUITY_TICKERS_LC = [
  'tsla', 'aapl', 'nvda', 'meta', 'msft', 'amzn', 'googl', 'amd',
  'pltr', 'sofi', 'mara', 'gme',  'dis',  'intc', 'shop',
  'spy',  'qqq',  'vix',
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface RawArticle {
  headline:        string
  summary:         string
  source:          string
  url:             string
  datetime:        number   // unix seconds
  related_tickers: string[]
  category:        string
  source_api:      'finnhub' | 'yahoo_rss'
  relevance_score: number
}

interface LiveMarketContext {
  spy_change:   number | null
  vix_level:    number | null
  btc_change:   number | null
  market_phase: string
}

interface IVEnvironment {
  score:         number
  label:         string
  avg_iv_rank:   number
  high_iv_count: number
  note:          string
}

interface EarningsEvent {
  ticker:      string
  days_until:  number
  day_of_week: string
  timing:      string
}

interface AIPulse {
  market_sentiment:       'bullish' | 'slightly_bullish' | 'neutral' | 'slightly_bearish' | 'bearish'
  sentiment_score:        number
  headline:               string
  summary:                string
  options_context:        string
  key_themes:             string[]
  wheel_relevant_context: string
  vix_context:            string
  sector_pulse:           Array<{ sector: string; sentiment: string; note: string }>
  mentioned_ticker_context: Record<string, string>
}

// ── Finnhub category news ──────────────────────────────────────────────────────

async function fetchCategoryNews(): Promise<RawArticle[]> {
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 3600
  const results: RawArticle[] = []

  for (const cat of CATEGORY_FEEDS) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=${cat}&token=${FINNHUB_KEY}`
      )
      if (!res.ok) continue
      const items = await res.json() as Array<{
        headline: string; summary: string; source: string; url: string;
        datetime: number; related: unknown; category: string;
      }>
      results.push(
        ...items
          .filter(a => a.datetime >= cutoff)
          .slice(0, 100)
          .map(a => ({
            headline:        a.headline ?? '',
            summary:         a.summary  ?? '',
            source:          a.source   ?? '',
            url:             a.url      ?? '',
            datetime:        a.datetime,
            related_tickers: Array.isArray(a.related) ? a.related : [],
            category:        cat,
            source_api:      'finnhub' as const,
            relevance_score: 0,
          }))
      )
    } catch { /* skip */ }
  }
  return results
}

// ── Finnhub company news ───────────────────────────────────────────────────────

async function fetchCompanyNews(): Promise<RawArticle[]> {
  const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0]
  const to   = new Date().toISOString().split('T')[0]
  const results: RawArticle[] = []

  for (const ticker of COMPANY_NEWS_TICKERS) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
      )
      if (!res.ok) continue
      const items = await res.json() as Array<{
        headline: string; summary: string; source: string; url: string; datetime: number;
      }>
      results.push(
        ...items.slice(0, 10).map(a => ({
          headline:        a.headline ?? '',
          summary:         a.summary  ?? '',
          source:          a.source   ?? '',
          url:             a.url      ?? '',
          datetime:        a.datetime,
          related_tickers: [ticker],
          category:        'company',
          source_api:      'finnhub' as const,
          relevance_score: 0,
        }))
      )
    } catch { /* skip */ }
  }
  return results
}

// ── Yahoo Finance RSS ──────────────────────────────────────────────────────────

async function fetchYahooRSS(): Promise<RawArticle[]> {
  const feeds = [
    'https://finance.yahoo.com/news/rss',
    'https://finance.yahoo.com/rss/topstories',
  ]
  const results: RawArticle[] = []
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 3600

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PremiumHunter/1.0)', 'Accept': 'application/rss+xml, text/xml' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []

      for (const item of itemBlocks.slice(0, 20)) {
        const getTag = (tag: string): string => {
          const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
          return (m?.[1] ?? m?.[2] ?? '').trim()
        }
        const headline = getTag('title')
        const pubDate  = getTag('pubDate')
        const url      = getTag('link') || getTag('guid')
        const summary  = getTag('description').replace(/<[^>]*>/g, '').slice(0, 300)
        if (!headline || headline.length < 10) continue

        let datetime = 0
        if (pubDate) { try { datetime = new Date(pubDate).getTime() / 1000 } catch { /**/ } }
        if (datetime < cutoff) continue

        const tickerMatches = `${headline} ${summary}`.match(/\$([A-Z]{1,5})\b/g) ?? []
        const related = tickerMatches.map(t => t.replace('$', '')).filter(t => t.length >= 1)

        results.push({
          headline,
          summary,
          source:          'Yahoo Finance',
          url,
          datetime,
          related_tickers: related,
          category:        'general',
          source_api:      'yahoo_rss',
          relevance_score: 0,
        })
      }
    } catch (err) {
      console.warn('Yahoo RSS error:', err)
    }
  }
  return results
}

// ── Dedup + Score ──────────────────────────────────────────────────────────────

function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>()
  return articles.filter(a => {
    const key = a.headline.slice(0, 60).toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function scoreArticles(articles: RawArticle[]): RawArticle[] {
  const nowSec = Date.now() / 1000
  return articles
    .map(a => {
      let score = 50
      const text = (a.headline + ' ' + a.summary).toLowerCase()
      for (const kw of MARKET_KEYWORDS)   { if (text.includes(kw)) score += 8  }
      for (const kw of EQUITY_TICKERS_LC) { if (text.includes(kw)) score += 12 }
      if (a.related_tickers.length > 0)    score += 5
      if (a.category === 'company')         score += 10
      if (a.source_api === 'yahoo_rss')     score += 3   // slight boost for third source
      const ageHours = (nowSec - a.datetime) / 3600
      if (ageHours < 6)       score += 15
      else if (ageHours < 12) score += 5
      return { ...a, relevance_score: Math.min(100, score) }
    })
    .sort((a, b) => b.relevance_score - a.relevance_score)
}

// ── Live Market Context (Polygon snapshots only) ───────────────────────────────

async function fetchLiveMarketContext(pulseType: 'pre_market' | 'post_market'): Promise<LiveMarketContext> {
  const ctx: LiveMarketContext = {
    spy_change:   null,
    vix_level:    null,
    btc_change:   null,
    market_phase: pulseType,
  }
  if (!POLYGON_KEY) return ctx

  const utcHour = new Date().getUTCHours()

  await Promise.allSettled([
    // SPY snapshot
    fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/SPY?apiKey=${POLYGON_KEY}`, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const t = d?.ticker
        if (!t) return
        const prev = t.prevDay?.c ?? 0
        const curr = t.day?.c ?? t.lastTrade?.p ?? 0
        if (prev > 0 && curr > 0) ctx.spy_change = Math.round(((curr - prev) / prev) * 1000) / 10
      })
      .catch(() => {}),

    // VIXY as VIX proxy (VIX itself isn't a stock ticker on Polygon)
    fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/VIXY?apiKey=${POLYGON_KEY}`, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const price = d?.ticker?.day?.c ?? d?.ticker?.lastTrade?.p
        if (price) ctx.vix_level = Math.round(price * 10) / 10
      })
      .catch(() => {}),

    // BTC/USD — only meaningful if markets haven't just opened
    fetch(`https://api.polygon.io/v2/snapshot/locale/global/markets/crypto/tickers/X:BTCUSD?apiKey=${POLYGON_KEY}`, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const t = d?.ticker
        if (!t) return
        const prev = t.prevDay?.c ?? 0
        const curr = t.day?.c ?? 0
        if (prev > 0 && curr > 0) ctx.btc_change = Math.round(((curr - prev) / prev) * 1000) / 10
      })
      .catch(() => {}),
  ])

  console.log(`Market context: SPY=${ctx.spy_change}% VIX=${ctx.vix_level} BTC=${ctx.btc_change}%`)
  return ctx
}

// ── IV Environment Score (from iv_snapshots) ───────────────────────────────────

// deno-lint-ignore no-explicit-any
async function calculateIVEnvironment(supabase: any): Promise<IVEnvironment> {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('iv_snapshots')
    .select('ticker, iv_rank')
    .in('ticker', WHEEL_TICKERS)
    .eq('snapshot_date', today)

  if (!data || data.length === 0) {
    return { score: 50, label: 'Neutral', avg_iv_rank: 50, high_iv_count: 0, note: 'IV data not yet available for today' }
  }

  const ranks: number[] = data
    .map((d: { iv_rank: number | null }) => Number(d.iv_rank))
    .filter((r: number) => !isNaN(r) && r >= 0)

  if (ranks.length === 0) {
    return { score: 50, label: 'Neutral', avg_iv_rank: 50, high_iv_count: 0, note: 'IV ranks not yet computed for today' }
  }

  const avg_iv_rank   = Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length)
  const high_iv_count = ranks.filter(r => r >= 60).length
  let score = avg_iv_rank + Math.round((high_iv_count / ranks.length) * 20)
  score = Math.min(100, score)

  const label = score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Neutral' : score >= 30 ? 'Poor' : 'Avoid'
  const note  = score >= 80
    ? `${high_iv_count} key stocks have elevated IV — excellent premium selling conditions`
    : score >= 65
      ? `Good conditions — avg IV rank ${avg_iv_rank} across wheel stocks`
      : score >= 45
        ? `Neutral — IV rank ${avg_iv_rank}. Selective opportunities available`
        : score >= 30
          ? `Poor — IV rank compressed at ${avg_iv_rank}. Premium thin`
          : `Avoid new positions — IV rank ${avg_iv_rank}. Premium too low to justify risk`

  return { score, label, avg_iv_rank, high_iv_count, note }
}

// ── Earnings Calendar (from iv_snapshots.earnings_date) ───────────────────────

// deno-lint-ignore no-explicit-any
async function fetchEarningsThisWeek(supabase: any): Promise<EarningsEvent[]> {
  const today = new Date().toISOString().split('T')[0]
  const DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  try {
    // earnings_date is a DATE column; compute days_until in SQL
    const { data } = await supabase
      .from('iv_snapshots')
      .select('ticker, earnings_date')
      .eq('snapshot_date', today)
      .not('earnings_date', 'is', null)
      .order('earnings_date', { ascending: true })
      .limit(20)

    if (!data || data.length === 0) return []

    const todayMs = new Date(today).getTime()
    return data
      .map((row: { ticker: string; earnings_date: string }) => {
        const earningsMs = new Date(row.earnings_date).getTime()
        const days_until  = Math.round((earningsMs - todayMs) / 86_400_000)
        if (days_until < 0 || days_until > 7) return null
        const earningsDay = new Date(row.earnings_date)
        return {
          ticker:      row.ticker,
          days_until,
          day_of_week: DAYS[earningsDay.getUTCDay()],
          timing:      'unknown',
        }
      })
      .filter(Boolean) as EarningsEvent[]
  } catch (err) {
    console.warn('Earnings fetch failed:', err)
    return []
  }
}

// ── Enhanced AI Prompt ─────────────────────────────────────────────────────────

async function generatePulse(
  articles: RawArticle[],
  marketCtx: LiveMarketContext,
  ivEnv: IVEnvironment,
  earnings: EarningsEvent[],
  pulseType: 'pre_market' | 'post_market',
): Promise<AIPulse> {
  const fallback: AIPulse = {
    market_sentiment:         'neutral',
    sentiment_score:          0,
    headline:                 'Market pulse unavailable — AI generation failed',
    summary:                  "Unable to generate today's AI market pulse. Check back later.",
    options_context:          'No options context available.',
    key_themes:               [],
    wheel_relevant_context:   'No wheel context available.',
    vix_context:              'VIX data unavailable.',
    sector_pulse:             [],
    mentioned_ticker_context: {},
  }
  if (!OPENROUTER_KEY) return fallback

  const timeLabel = pulseType === 'pre_market' ? 'Pre-market' : 'Post-market'

  const marketLine = [
    marketCtx.spy_change  !== null ? `SPY ${marketCtx.spy_change > 0 ? '+' : ''}${marketCtx.spy_change}%` : null,
    marketCtx.vix_level   !== null ? `VIX ${marketCtx.vix_level}${marketCtx.vix_level > 20 ? ' (elevated)' : ''}` : null,
    marketCtx.btc_change  !== null ? `BTC ${marketCtx.btc_change > 0 ? '+' : ''}${marketCtx.btc_change}%` : null,
  ].filter(Boolean).join(' · ') || 'Market data unavailable'

  const earningsLine = earnings.length > 0
    ? earnings.map(e => `${e.ticker} (${e.day_of_week}${e.days_until === 0 ? ' — TODAY' : e.days_until === 1 ? ' — tomorrow' : `, ${e.days_until}d`})`).join(', ')
    : 'None this week'

  const articleText = articles.slice(0, 20)
    .map((a, i) => `${i + 1}. [${a.source}] ${a.headline}. ${a.summary.slice(0, 150)}`)
    .join('\n')

  const prompt = `You are a concise market analyst for options premium sellers (wheel strategy).
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — ${timeLabel} update.

LIVE MARKET: ${marketLine}
IV ENVIRONMENT: ${ivEnv.label} (${ivEnv.score}/100) — ${ivEnv.note}
EARNINGS THIS WEEK (avoid selling premium): ${earningsLine}

TOP ${articles.slice(0, 20).length} ARTICLES:
${articleText}

Return ONLY a JSON object, no markdown, no extra text:
{
  "market_sentiment": "bullish|slightly_bullish|neutral|slightly_bearish|bearish",
  "sentiment_score": <integer -100 to 100>,
  "headline": "<punchy headline, max 15 words>",
  "summary": "<2-3 sentences covering macro, equities, and volatility>",
  "options_context": "<1-2 sentences: is this a good time to sell premium?>",
  "key_themes": ["<theme1>", "<theme2>", "<theme3>"],
  "wheel_relevant_context": "<1-2 sentences on TSLA/AAPL/NVDA/PLTR/GME/SOFI wheel relevance>",
  "vix_context": "<one sentence on volatility environment for sellers>",
  "sector_pulse": [
    { "sector": "<name>", "sentiment": "bullish|neutral|bearish", "note": "<one sentence>" }
  ],
  "mentioned_ticker_context": {
    "<TICKER>": "<short phrase e.g. 'down 3% on earnings miss' or 'stable, no major news'>"
  }
}
For mentioned_ticker_context: only include tickers actually mentioned in the news or market data. Include SPY always. Keep each value to one short phrase.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://premiumhunter.app',
        'X-Title':       'PremiumHunter Market Pulse',
      },
      body: JSON.stringify({
        model:       OPENROUTER_MODEL,
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  900,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) return fallback
    const json    = await res.json()
    const content = (json.choices?.[0]?.message?.content ?? '') as string
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed  = JSON.parse(cleaned) as Partial<AIPulse>
    return {
      market_sentiment:         parsed.market_sentiment         ?? fallback.market_sentiment,
      sentiment_score:          typeof parsed.sentiment_score === 'number' ? parsed.sentiment_score : fallback.sentiment_score,
      headline:                 parsed.headline                 ?? fallback.headline,
      summary:                  parsed.summary                  ?? fallback.summary,
      options_context:          parsed.options_context          ?? fallback.options_context,
      key_themes:               Array.isArray(parsed.key_themes) ? parsed.key_themes : fallback.key_themes,
      wheel_relevant_context:   parsed.wheel_relevant_context   ?? fallback.wheel_relevant_context,
      vix_context:              parsed.vix_context              ?? fallback.vix_context,
      sector_pulse:             Array.isArray(parsed.sector_pulse) ? parsed.sector_pulse : [],
      mentioned_ticker_context: (parsed.mentioned_ticker_context && typeof parsed.mentioned_ticker_context === 'object')
        ? parsed.mentioned_ticker_context as Record<string, string>
        : {},
    }
  } catch {
    return fallback
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase   = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const authHeader = req.headers.get('Authorization') ?? ''
  const isCron     = CRON_SECRET !== '' && authHeader === `Bearer ${CRON_SECRET}`
  let   force      = false
  let   pulseType: 'pre_market' | 'post_market' = 'pre_market'

  if (!isCron) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: sub } = await supabase
      .from('subscriptions').select('tier').eq('user_id', user.id).single()
    if (sub?.tier !== 'superuser') {
      return new Response(JSON.stringify({ error: 'Superuser access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      force     = body.force === true
      if (body.pulse_type === 'post_market') pulseType = 'post_market'
    }
  } else {
    // Cron: detect pre vs post from query param or UTC hour
    const url       = new URL(req.url)
    const typeParam = url.searchParams.get('type')
    if (typeParam === 'post_market') {
      pulseType = 'post_market'
    } else if (!typeParam) {
      const utcHour = new Date().getUTCHours()
      pulseType = utcHour >= 20 ? 'post_market' : 'pre_market'
    }
  }

  const today = new Date().toISOString().split('T')[0]

  if (!force) {
    const { data: existing } = await supabase
      .from('market_pulse').select('id').eq('pulse_date', today).eq('pulse_type', pulseType).maybeSingle()
    if (existing) {
      return new Response(
        JSON.stringify({ message: `${pulseType} pulse already exists for today`, pulse_date: today }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  const startMs = Date.now()

  // Fetch all data in parallel
  const [categoryNews, companyNews, yahooNews, marketCtx, ivEnv, earnings] = await Promise.all([
    fetchCategoryNews(),
    fetchCompanyNews(),
    fetchYahooRSS(),
    fetchLiveMarketContext(pulseType),
    calculateIVEnvironment(supabase),
    fetchEarningsThisWeek(supabase),
  ])

  const raw     = [...categoryNews, ...companyNews, ...yahooNews]
  const deduped = deduplicateArticles(raw)
  const scored  = scoreArticles(deduped)
  const top200  = scored.slice(0, 200)
  const top20   = scored.slice(0, 20)

  console.log(`News: Finnhub cat=${categoryNews.length} company=${companyNews.length} Yahoo=${yahooNews.length} → deduped=${deduped.length}`)
  console.log(`IV: ${ivEnv.label} (${ivEnv.score}/100) · Earnings: ${earnings.map(e => e.ticker).join(', ') || 'none'}`)

  const aiResult   = await generatePulse(top20, marketCtx, ivEnv, earnings, pulseType)
  const durationMs = Date.now() - startMs

  const { error: upsertError } = await supabase.from('market_pulse').upsert({
    pulse_date:               today,
    pulse_type:               pulseType,
    market_sentiment:         aiResult.market_sentiment,
    sentiment_score:          aiResult.sentiment_score,
    headline:                 aiResult.headline,
    summary:                  aiResult.summary,
    options_context:          aiResult.options_context,
    key_themes:               aiResult.key_themes,
    source_articles:          top20.map(a => ({
      title: a.headline, source: a.source, url: a.url,
      datetime: a.datetime, tickers: a.related_tickers,
    })),
    mentioned_tickers:        [...new Set(top200.flatMap(a => a.related_tickers))].filter(Boolean),
    mentioned_ticker_context: aiResult.mentioned_ticker_context,
    wheel_relevant_context:   aiResult.wheel_relevant_context,
    vix_context:              aiResult.vix_context,
    sector_pulse:             aiResult.sector_pulse,
    earnings_this_week:       earnings,
    market_context:           marketCtx,
    iv_environment_score:     ivEnv.score,
    iv_environment_label:     ivEnv.label,
    model_used:               OPENROUTER_MODEL,
    generated_at:             new Date().toISOString(),
    generation_duration_ms:   durationMs,
    news_articles_fetched:    raw.length,
    news_articles_used:       top20.length,
  }, { onConflict: 'pulse_date,pulse_type' })

  if (upsertError) {
    console.error('market_pulse upsert failed:', upsertError.message)
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (force) {
    await supabase.from('market_news').delete().eq('pulse_date', today).eq('pulse_type', pulseType)
  }

  if (top200.length > 0) {
    const { error: newsError } = await supabase.from('market_news').insert(
      top200.map(a => ({
        pulse_date:      today,
        pulse_type:      pulseType,
        headline:        a.headline,
        summary:         a.summary.slice(0, 500),
        source:          a.source,
        url:             a.url,
        datetime:        a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
        related_tickers: a.related_tickers,
        category:        a.category,
        relevance_score: a.relevance_score,
        source_api:      a.source_api,
      }))
    )
    if (newsError) console.error('market_news insert failed:', newsError.message)
  }

  return new Response(JSON.stringify({
    pulse_date:           today,
    pulse_type:           pulseType,
    market_sentiment:     aiResult.market_sentiment,
    headline:             aiResult.headline,
    iv_environment:       ivEnv.label,
    earnings_count:       earnings.length,
    articles_fetched:     raw.length,
    articles_stored:      top200.length,
    duration_ms:          durationMs,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
