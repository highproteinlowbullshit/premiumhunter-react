import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET      = Deno.env.get('MARKET_PULSE_CRON_SECRET') ?? ''
const OPENROUTER_KEY   = Deno.env.get('OPENROUTER_API_KEY') ?? ''
const OPENROUTER_MODEL = Deno.env.get('OPENROUTER_MODEL') ?? 'mistralai/mistral-7b-instruct:free'
const FINNHUB_KEY      = Deno.env.get('FINNHUB_API_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Categories fetched with equal weight — 100 articles each, no crypto
const CATEGORY_FEEDS = ['general', 'forex', 'merger'] as const

// Wheel-strategy tickers used for company news + relevance scoring
const COMPANY_NEWS_TICKERS = [
  'TSLA', 'AAPL', 'NVDA', 'META', 'MSFT',
  'AMZN', 'GOOGL', 'AMD',  'PLTR', 'SOFI',
  'MARA', 'GME',  'DIS',  'INTC', 'SHOP',
]

const MARKET_KEYWORDS = [
  'options', 'volatility', ' iv ', 'earnings', 'wheel', 'premium',
  'puts', 'calls', 'expir', 'dividend', 'guidance', 'revenue',
  'fed ', 'interest rate', 'inflation', 'recession', 'rally',
  'selloff', 'acquisition', 'merger', 'buyback',
]

const EQUITY_TICKERS = [
  'tsla', 'aapl', 'nvda', 'meta', 'msft', 'amzn', 'googl', 'amd',
  'pltr', 'sofi', 'mara', 'gme',  'dis',  'intc', 'shop',
  'spy',  'qqq',  'vix',
]

interface RawArticle {
  headline:        string
  summary:         string
  source:          string
  url:             string
  datetime:        number   // unix seconds
  related_tickers: string[]
  category:        string
  source_api:      'finnhub'
  relevance_score: number
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
}

// ── Finnhub category news ─────────────────────────────────────────────────────

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
    } catch { /* skip failed category */ }
  }

  return results
}

// ── Finnhub company news ──────────────────────────────────────────────────────

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
    } catch { /* skip failed ticker */ }
  }

  return results
}

// ── Dedup + Score ─────────────────────────────────────────────────────────────

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
      for (const kw of MARKET_KEYWORDS) { if (text.includes(kw)) score += 8  }
      for (const kw of EQUITY_TICKERS)  { if (text.includes(kw)) score += 12 }
      if (a.related_tickers.length > 0)  score += 5
      if (a.category === 'company')       score += 10  // company news always ticker-relevant
      const ageHours = (nowSec - a.datetime) / 3600
      if (ageHours < 6)       score += 15
      else if (ageHours < 12) score += 5
      return { ...a, relevance_score: Math.min(100, score) }
    })
    .sort((a, b) => b.relevance_score - a.relevance_score)
}

// ── OpenRouter ────────────────────────────────────────────────────────────────

async function generatePulse(articles: RawArticle[]): Promise<AIPulse> {
  const fallback: AIPulse = {
    market_sentiment:       'neutral',
    sentiment_score:        0,
    headline:               'Market pulse unavailable — AI generation failed',
    summary:                "Unable to generate today's AI market pulse. Check back later.",
    options_context:        'No options context available.',
    key_themes:             [],
    wheel_relevant_context: 'No wheel context available.',
    vix_context:            'VIX data unavailable.',
  }
  if (!OPENROUTER_KEY) return fallback

  const articleText = articles
    .map((a, i) => `${i + 1}. [${a.source}] ${a.headline}. ${a.summary.slice(0, 200)}`)
    .join('\n')

  const prompt = `You are a concise market analyst for options premium sellers (wheel strategy).
Analyze these ${articles.length} news articles and return ONLY a JSON object with no extra text or markdown:

${articleText}

Return exactly this JSON structure:
{
  "market_sentiment": "bullish|slightly_bullish|neutral|slightly_bearish|bearish",
  "sentiment_score": <integer -100 to 100>,
  "headline": "<punchy market headline, max 15 words>",
  "summary": "<2-3 sentence market summary covering macro, equities, and volatility>",
  "options_context": "<1-2 sentences on what this means for premium sellers>",
  "key_themes": ["<theme1>", "<theme2>", "<theme3>"],
  "wheel_relevant_context": "<1-2 sentences on TSLA/AAPL/NVDA/PLTR/GME/SOFI wheel relevance>",
  "vix_context": "<one sentence on volatility environment>"
}`

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
        max_tokens:  600,
        temperature: 0.3,
      }),
    })
    if (!res.ok) return fallback
    const json    = await res.json()
    const content = (json.choices?.[0]?.message?.content ?? '') as string
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed  = JSON.parse(cleaned) as Partial<AIPulse>
    return {
      market_sentiment:       parsed.market_sentiment       ?? fallback.market_sentiment,
      sentiment_score:        typeof parsed.sentiment_score === 'number' ? parsed.sentiment_score : fallback.sentiment_score,
      headline:               parsed.headline               ?? fallback.headline,
      summary:                parsed.summary                ?? fallback.summary,
      options_context:        parsed.options_context        ?? fallback.options_context,
      key_themes:             Array.isArray(parsed.key_themes) ? parsed.key_themes : fallback.key_themes,
      wheel_relevant_context: parsed.wheel_relevant_context ?? fallback.wheel_relevant_context,
      vix_context:            parsed.vix_context            ?? fallback.vix_context,
    }
  } catch {
    return fallback
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase   = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const authHeader = req.headers.get('Authorization') ?? ''
  const isCron     = CRON_SECRET !== '' && authHeader === `Bearer ${CRON_SECRET}`
  let   force      = false

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
      force = body.force === true
    }
  }

  const today = new Date().toISOString().split('T')[0]

  if (!force) {
    const { data: existing } = await supabase
      .from('market_pulse').select('id').eq('pulse_date', today).maybeSingle()
    if (existing) {
      return new Response(
        JSON.stringify({ message: 'Pulse already exists for today', pulse_date: today }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  const startMs = Date.now()

  // Fetch category news and company news in parallel
  const [categoryNews, companyNews] = await Promise.all([
    fetchCategoryNews(),
    fetchCompanyNews(),
  ])

  const raw    = [...categoryNews, ...companyNews]
  const deduped = deduplicateArticles(raw)
  const scored  = scoreArticles(deduped)
  const top200  = scored.slice(0, 200)  // stored in market_news for watchlist filtering
  const top20   = scored.slice(0, 20)   // sent to AI for summary generation

  const aiResult = await generatePulse(top20)

  const durationMs = Date.now() - startMs

  const { error: upsertError } = await supabase.from('market_pulse').upsert({
    pulse_date:             today,
    market_sentiment:       aiResult.market_sentiment,
    sentiment_score:        aiResult.sentiment_score,
    headline:               aiResult.headline,
    summary:                aiResult.summary,
    options_context:        aiResult.options_context,
    key_themes:             aiResult.key_themes,
    source_articles:        top20.map(a => ({
      title: a.headline, source: a.source, url: a.url,
      datetime: a.datetime, tickers: a.related_tickers,
    })),
    mentioned_tickers:      [...new Set(top200.flatMap(a => a.related_tickers))].filter(Boolean),
    wheel_relevant_context: aiResult.wheel_relevant_context,
    vix_context:            aiResult.vix_context,
    model_used:             OPENROUTER_MODEL,
    generated_at:           new Date().toISOString(),
    generation_duration_ms: durationMs,
    news_articles_fetched:  raw.length,
    news_articles_used:     top20.length,
  }, { onConflict: 'pulse_date' })

  if (upsertError) {
    console.error('market_pulse upsert failed:', upsertError.message)
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (force) {
    await supabase.from('market_news').delete().eq('pulse_date', today)
  }

  if (top200.length > 0) {
    const { error: newsError } = await supabase.from('market_news').insert(
      top200.map(a => ({
        pulse_date:      today,
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
    pulse_date:       today,
    market_sentiment: aiResult.market_sentiment,
    headline:         aiResult.headline,
    articles_fetched: raw.length,
    articles_stored:  top200.length,
    duration_ms:      durationMs,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
