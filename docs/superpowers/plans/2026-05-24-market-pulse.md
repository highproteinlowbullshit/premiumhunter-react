# AI Market Pulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared daily AI-generated market summary card to the Dashboard, gated to Pro users, generated once per weekday morning via pg_cron and displayed with client-side watchlist filtering.

**Architecture:** A single Supabase edge function (`generate-market-pulse`) fetches Finnhub + Polygon news, calls OpenRouter once, and upserts one row into `market_pulse` plus up to 50 rows into `market_news`. The dashboard hook (`useMarketPulse`) reads both tables for today's date and filters news client-side against the user's watchlist. The Admin panel gets a `pulse` tab to manually trigger and inspect the function.

**Tech Stack:** Deno edge function, TanStack Query, Lucide React icons, Supabase RLS, pg_cron + pg_net, OpenRouter API, Finnhub API, Polygon API.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `supabase/functions/generate-market-pulse/index.ts` | Edge function: fetch news → AI call → upsert DB |
| Create | `src/hooks/useMarketPulse.ts` | TanStack Query hook: read pulse + news, weekend detection |
| Create | `src/components/MarketPulseCard.tsx` | 3-tab dashboard card (Pulse / All News / Your Tickers) |
| Modify | `src/lib/featureConfig.ts` | Add `market_pulse: 'pro'` |
| Modify | `src/pages/Dashboard.tsx` | Wire hook + card between PortfolioGreeksDashboard and MonthlyPnLChart |
| Modify | `src/pages/AdminPage.tsx` | Add `'pulse'` tab + `PulseTab` component |
| SQL | Run in Supabase dashboard | Create tables, RLS, indexes, cron job |

---

## Task 1: SQL — Tables, RLS, Indexes, Cron

**Files:**
- SQL run in Supabase SQL editor (not a migration file)

- [ ] **Step 1: Create market_pulse table**

Run this SQL in the Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS market_pulse (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_date              DATE NOT NULL UNIQUE,
  market_sentiment        TEXT NOT NULL,
  sentiment_score         INTEGER NOT NULL DEFAULT 0,
  headline                TEXT NOT NULL,
  summary                 TEXT NOT NULL,
  options_context         TEXT NOT NULL DEFAULT '',
  key_themes              JSONB NOT NULL DEFAULT '[]',
  source_articles         JSONB NOT NULL DEFAULT '[]',
  mentioned_tickers       JSONB NOT NULL DEFAULT '[]',
  wheel_relevant_context  TEXT NOT NULL DEFAULT '',
  vix_context             TEXT NOT NULL DEFAULT '',
  model_used              TEXT NOT NULL DEFAULT '',
  generated_at            TIMESTAMPTZ,
  generation_duration_ms  INTEGER,
  news_articles_fetched   INTEGER,
  news_articles_used      INTEGER,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE market_pulse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read market_pulse"
  ON market_pulse FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS market_pulse_date_idx ON market_pulse (pulse_date DESC);
```

- [ ] **Step 2: Create market_news table**

```sql
CREATE TABLE IF NOT EXISTS market_news (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_date      DATE NOT NULL,
  headline        TEXT NOT NULL,
  summary         TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL DEFAULT '',
  url             TEXT NOT NULL DEFAULT '',
  datetime        TIMESTAMPTZ,
  related_tickers JSONB NOT NULL DEFAULT '[]',
  category        TEXT NOT NULL DEFAULT 'general',
  relevance_score INTEGER NOT NULL DEFAULT 0,
  source_api      TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE market_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read market_news"
  ON market_news FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS market_news_date_idx ON market_news (pulse_date DESC);
CREATE INDEX IF NOT EXISTS market_news_tickers_gin ON market_news USING GIN (related_tickers);
```

- [ ] **Step 3: Verify tables exist**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('market_pulse', 'market_news');
-- Expected: 2 rows
```

- [ ] **Step 4: Schedule cron job**

First generate a random secret (e.g., `openssl rand -hex 32` in terminal). Save this value — you will set it as `MARKET_PULSE_CRON_SECRET` in Supabase edge function secrets in Task 8.

Replace `<MARKET_PULSE_CRON_SECRET>` with your generated value:

```sql
SELECT cron.schedule(
  'generate-market-pulse-daily',
  '30 0 * * 1-5',
  $$ SELECT net.http_post(
    url     := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/generate-market-pulse',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <MARKET_PULSE_CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  ); $$
);
```

- [ ] **Step 5: Verify cron scheduled**

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'generate-market-pulse-daily';
-- Expected: 1 row, active = true
```

---

## Task 2: Feature Config

**Files:**
- Modify: `src/lib/featureConfig.ts`

- [ ] **Step 1: Add market_pulse feature**

In `src/lib/featureConfig.ts`, add `market_pulse: 'pro'` in the `FEATURES` object after `morning_briefing`:

```ts
  morning_briefing:            'pro',
  market_pulse:                'pro',
```

- [ ] **Step 2: Add label**

In `FEATURE_LABELS`, add after `morning_briefing`:

```ts
  morning_briefing:            'AI morning briefing email',
  market_pulse:                'AI Market Pulse with daily news',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/featureConfig.ts
git commit -m "feat: add market_pulse feature gate (pro tier)"
```

---

## Task 3: Edge Function

**Files:**
- Create: `supabase/functions/generate-market-pulse/index.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p supabase/functions/generate-market-pulse
```

- [ ] **Step 2: Write the full edge function**

Create `supabase/functions/generate-market-pulse/index.ts` with:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET       = Deno.env.get('MARKET_PULSE_CRON_SECRET') ?? ''
const OPENROUTER_KEY    = Deno.env.get('OPENROUTER_API_KEY') ?? ''
const OPENROUTER_MODEL  = Deno.env.get('OPENROUTER_MODEL') ?? 'mistralai/mistral-7b-instruct:free'
const FINNHUB_KEY       = Deno.env.get('FINNHUB_API_KEY') ?? ''
const POLYGON_KEY       = Deno.env.get('POLYGON_API_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const POLYGON_TICKERS = ['SPY', 'VIX', 'MARA', 'COIN', 'GME']
const WHEEL_KEYWORDS  = ['options', 'volatility', ' iv ', 'earnings', 'wheel', 'premium', 'puts', 'calls', 'expir']
const WHEEL_TICKERS   = ['mara', 'riot', 'coin', 'tsla', 'gme', 'amc', 'pltr', 'sofi', 'spy', 'vix']

interface RawArticle {
  headline:        string
  summary:         string
  source:          string
  url:             string
  datetime:        number   // unix seconds
  related_tickers: string[]
  category:        string
  source_api:      'finnhub' | 'polygon'
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

// ── Finnhub ───────────────────────────────────────────────────────────────────

async function fetchFinnhubNews(): Promise<RawArticle[]> {
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 3600
  const results: RawArticle[] = []
  for (const cat of ['general', 'forex', 'crypto']) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=${cat}&token=${FINNHUB_KEY}`
      )
      if (!res.ok) continue
      const items = await res.json() as Array<{
        headline: string; summary: string; source: string; url: string;
        datetime: number; related: string[]; category: string;
      }>
      results.push(
        ...items
          .filter(a => a.datetime >= cutoff)
          .slice(0, 15)
          .map(a => ({
            headline:        a.headline ?? '',
            summary:         a.summary ?? '',
            source:          a.source ?? '',
            url:             a.url ?? '',
            datetime:        a.datetime,
            related_tickers: a.related ?? [],
            category:        cat,
            source_api:      'finnhub' as const,
            relevance_score: 0,
          }))
      )
    } catch { /* skip failed category */ }
  }
  return results
}

// ── Polygon ───────────────────────────────────────────────────────────────────

async function fetchPolygonNews(): Promise<RawArticle[]> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const results: RawArticle[] = []
  for (const ticker of POLYGON_TICKERS) {
    try {
      const res = await fetch(
        `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=5&published_utc.gte=${cutoff}&apiKey=${POLYGON_KEY}`
      )
      if (!res.ok) continue
      const json = await res.json() as {
        results?: Array<{
          title: string; description: string;
          publisher: { name: string }; article_url: string;
          published_utc: string; tickers: string[];
        }>
      }
      results.push(
        ...(json.results ?? []).map(a => ({
          headline:        a.title ?? '',
          summary:         a.description ?? '',
          source:          a.publisher?.name ?? '',
          url:             a.article_url ?? '',
          datetime:        Math.floor(new Date(a.published_utc).getTime() / 1000),
          related_tickers: a.tickers ?? [ticker],
          category:        'stock',
          source_api:      'polygon' as const,
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
      for (const kw of WHEEL_KEYWORDS)  { if (text.includes(kw)) score += 10 }
      for (const kw of WHEEL_TICKERS)   { if (text.includes(kw)) score += 15 }
      if (a.related_tickers.length > 0)  score += 5
      const ageHours = (nowSec - a.datetime) / 3600
      if (ageHours < 6)  score += 15
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
Analyze these news articles and return ONLY a JSON object with no extra text or markdown:

${articleText}

Return exactly this JSON structure:
{
  "market_sentiment": "bullish|slightly_bullish|neutral|slightly_bearish|bearish",
  "sentiment_score": <integer -100 to 100>,
  "headline": "<punchy market headline, max 15 words>",
  "summary": "<2-3 sentence market summary>",
  "options_context": "<1-2 sentences on what this means for premium sellers>",
  "key_themes": ["<theme1>", "<theme2>", "<theme3>"],
  "wheel_relevant_context": "<1-2 sentences on MARA/RIOT/COIN/TSLA/GME/PLTR relevance>",
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
        model:      OPENROUTER_MODEL,
        messages:   [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    })
    if (!res.ok) return fallback
    const json    = await res.json()
    const content = (json.choices?.[0]?.message?.content ?? '') as string
    // Strip markdown code fences if model wraps in ```json ... ```
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    return JSON.parse(cleaned) as AIPulse
  } catch {
    return fallback
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase    = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const authHeader  = req.headers.get('Authorization') ?? ''
  const isCron      = CRON_SECRET !== '' && authHeader === `Bearer ${CRON_SECRET}`
  let   force       = false

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

  // Early return if pulse already exists for today (skip on force)
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

  const [finnhubNews, polygonNews] = await Promise.all([
    fetchFinnhubNews(),
    fetchPolygonNews(),
  ])

  const raw    = [...finnhubNews, ...polygonNews]
  const deduped = deduplicateArticles(raw)
  const scored  = scoreArticles(deduped)
  const top50   = scored.slice(0, 50)
  const top15   = scored.slice(0, 15)

  const aiResult = await generatePulse(top15)

  const durationMs = Date.now() - startMs

  const { error: upsertError } = await supabase.from('market_pulse').upsert({
    pulse_date:              today,
    market_sentiment:        aiResult.market_sentiment,
    sentiment_score:         aiResult.sentiment_score,
    headline:                aiResult.headline,
    summary:                 aiResult.summary,
    options_context:         aiResult.options_context,
    key_themes:              aiResult.key_themes,
    source_articles:         top15.slice(0, 20).map(a => ({
      title: a.headline, source: a.source, url: a.url,
      datetime: a.datetime, tickers: a.related_tickers,
    })),
    mentioned_tickers:       [...new Set(top50.flatMap(a => a.related_tickers))],
    wheel_relevant_context:  aiResult.wheel_relevant_context,
    vix_context:             aiResult.vix_context,
    model_used:              OPENROUTER_MODEL,
    generated_at:            new Date().toISOString(),
    generation_duration_ms:  durationMs,
    news_articles_fetched:   raw.length,
    news_articles_used:      top15.length,
  }, { onConflict: 'pulse_date' })

  if (upsertError) {
    console.error('market_pulse upsert failed:', upsertError.message)
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // On force-regenerate, delete previous news rows for today first
  if (force) {
    await supabase.from('market_news').delete().eq('pulse_date', today)
  }

  if (top50.length > 0) {
    const { error: newsError } = await supabase.from('market_news').insert(
      top50.map(a => ({
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
    articles_stored:  top50.length,
    duration_ms:      durationMs,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-market-pulse/index.ts
git commit -m "feat: add generate-market-pulse edge function"
```

---

## Task 4: useMarketPulse Hook

**Files:**
- Create: `src/hooks/useMarketPulse.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useMarketPulse.ts`:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMarketPulse.ts
git commit -m "feat: add useMarketPulse hook with SGT weekend detection"
```

---

## Task 5: MarketPulseCard Component

**Files:**
- Create: `src/components/MarketPulseCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/MarketPulseCard.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MarketPulseCard.tsx
git commit -m "feat: add MarketPulseCard component with 3-tab layout"
```

---

## Task 6: Dashboard Integration

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Add import for hook and card**

At the top of `src/pages/Dashboard.tsx`, add after the existing imports:

```tsx
import { useMarketPulse } from '../hooks/useMarketPulse'
import { MarketPulseCard } from '../components/MarketPulseCard'
```

- [ ] **Step 2: Wire the hook inside RealDashboard**

In the `RealDashboard` function, after the existing hook calls (around line 107), add:

```tsx
const { pulse, allArticles, watchlistArticles, isLoading: pulseLoading, isWeekend } = useMarketPulse(tickers)
```

- [ ] **Step 3: Add refetch of market-pulse queries**

In the `handleRefresh` callback's `Promise.all`, add:

```tsx
queryClient.refetchQueries({ queryKey: ['market-pulse'] }),
queryClient.refetchQueries({ queryKey: ['market-news'] }),
```

The full updated `handleRefresh` becomes:

```tsx
const handleRefresh = useCallback(async () => {
  await Promise.all([
    queryClient.refetchQueries({ queryKey: ['watchlist'] }),
    queryClient.refetchQueries({ queryKey: ['dashboard-intelligence'] }),
    queryClient.refetchQueries({ queryKey: ['open-positions-for-greeks'] }),
    queryClient.refetchQueries({ queryKey: ['portfolio-greeks'] }),
    queryClient.refetchQueries({ queryKey: ['market-pulse'] }),
    queryClient.refetchQueries({ queryKey: ['market-news'] }),
  ]);
}, [queryClient]);
```

- [ ] **Step 4: Insert the card in the JSX**

Between the `PortfolioGreeksDashboard` FeatureGate block and the `MonthlyPnLChart` FeatureGate block, insert:

```tsx
        {/* AI Market Pulse */}
        <FeatureGate feature="market_pulse" blurHeight={180}>
          <MarketPulseCard
            pulse={pulse}
            allArticles={allArticles}
            watchlistArticles={watchlistArticles}
            isLoading={pulseLoading}
            isWeekend={isWeekend}
          />
        </FeatureGate>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Start dev server and verify card renders**

```bash
npm run dev
```

Open the dashboard. The card should show one of the three states:
- If it's a weekend (SGT): CalendarOff icon with "Markets closed" message
- If no pulse exists yet: Clock icon with "Market pulse generating" message
- If pulse exists: 3-tab card with sentiment, headline, news

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: integrate MarketPulseCard into Dashboard"
```

---

## Task 7: AdminPage Pulse Tab

**Files:**
- Modify: `src/pages/AdminPage.tsx`

- [ ] **Step 1: Add import for useQuery, useMutation, supabase**

At the top of `src/pages/AdminPage.tsx`, add to imports. The file already imports from various hooks. Add:

```tsx
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
```

Note: Check whether `useQuery`, `useMutation`, and `supabase` are already imported; only add what is missing. The Lucide icons `TrendingUp`, `TrendingDown`, `Minus` are new additions needed by PulseTab's sentiment display.

- [ ] **Step 2: Update the tab union type**

Find the `useState` that controls `activeTab`. Change:

```tsx
// Before:
const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'health'>('users')
```

To:

```tsx
// After:
const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'health' | 'pulse'>('users')
```

- [ ] **Step 3: Add the Pulse tab button**

Find the tab buttons render loop. It maps over `['users', 'audit', 'health'] as const`. Change to:

```tsx
{(['users', 'audit', 'health', 'pulse'] as const).map(tab => (
```

- [ ] **Step 4: Add the tab content render**

Find where `{activeTab === 'health' && <HealthTab />}` is rendered. Add immediately after:

```tsx
{activeTab === 'pulse' && <PulseTab />}
```

- [ ] **Step 5: Add the PulseTab component**

Add this component to `src/pages/AdminPage.tsx` (after the `HealthTab` component):

```tsx
// ── PulseTab ──────────────────────────────────────────────────────────────────

interface PulseAdminResult {
  pulse_date:       string
  market_sentiment: string
  headline:         string
  articles_fetched: number
  articles_stored:  number
  duration_ms:      number
}

interface LastPulseRow {
  pulse_date:             string
  market_sentiment:       string
  headline:               string
  generation_duration_ms: number | null
  news_articles_used:     number | null
  generated_at:           string | null
}

const PULSE_SENTIMENT_COLOR: Record<string, string> = {
  bullish:          '#22c55e',
  slightly_bullish: '#14b8a6',
  neutral:          'var(--ph-text-3)',
  slightly_bearish: '#f59e0b',
  bearish:          '#ef4444',
}

function PulseSentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === 'bullish' || sentiment === 'slightly_bullish')   return <TrendingUp size={12} />
  if (sentiment === 'bearish' || sentiment === 'slightly_bearish')  return <TrendingDown size={12} />
  return <Minus size={12} />
}

function PulseTab() {
  const [triggerResult, setTriggerResult] = useState<PulseAdminResult | null>(null)
  const [triggerError,  setTriggerError]  = useState<string | null>(null)

  const lastPulseQuery = useQuery({
    queryKey: ['admin-market-pulse'],
    queryFn:  async (): Promise<LastPulseRow | null> => {
      const { data, error } = await supabase
        .from('market_pulse')
        .select('pulse_date, market_sentiment, headline, generation_duration_ms, news_articles_used, generated_at')
        .order('pulse_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 30 * 1000,
  })

  const trigger = useMutation({
    mutationFn: async (force: boolean): Promise<PulseAdminResult> => {
      const { data, error } = await supabase.functions.invoke('generate-market-pulse', {
        body: { force },
      })
      if (error) throw error
      return data as PulseAdminResult
    },
    onSuccess: (data) => {
      setTriggerError(null)
      setTriggerResult(data)
    },
    onError: (err: Error) => {
      setTriggerError(err.message)
    },
  })

  const latest = lastPulseQuery.data
  const sentimentColor = PULSE_SENTIMENT_COLOR[latest?.market_sentiment ?? 'neutral'] ?? 'var(--ph-text-3)'

  return (
    <div>
      {/* Last generated pulse */}
      <div style={{
        padding: 20, marginBottom: 16,
        background: 'rgba(13,27,53,0.4)',
        border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12,
      }}>
        <div style={{ fontSize: 11, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Last generated pulse
        </div>
        {lastPulseQuery.error ? (
          <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>
            Query error: {(lastPulseQuery.error as Error).message}
          </p>
        ) : latest ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: sentimentColor, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'capitalize' }}>
                <PulseSentimentIcon sentiment={latest.market_sentiment} />
                {latest.market_sentiment.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ph-text-3)' }}>
                {latest.pulse_date}
                {latest.generated_at ? ` · ${timeAgo(latest.generated_at)}` : ''}
              </span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.5 }}>
              {latest.headline}
            </p>
            <div style={{ display: 'flex', gap: 20 }}>
              {([
                { label: 'Articles used',  value: String(latest.news_articles_used ?? '—') },
                { label: 'Duration',       value: latest.generation_duration_ms != null ? `${(latest.generation_duration_ms / 1000).toFixed(1)}s` : '—' },
              ] as const).map(stat => (
                <div key={stat.label}>
                  <div style={{ fontSize: 10, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{stat.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ph-text-1)', fontFamily: 'JetBrains Mono, monospace' }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ph-text-3)' }}>
            {lastPulseQuery.isLoading ? 'Loading…' : 'No pulse generated yet.'}
          </p>
        )}
      </div>

      {/* Inline result from last trigger */}
      {triggerResult && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(0,229,196,0.05)', border: '1px solid rgba(0,229,196,0.15)',
          fontSize: 13, color: 'var(--ph-text-2)',
        }}>
          <span style={{ fontWeight: 600, color: '#00e5c4', marginRight: 8 }}>
            {triggerResult.market_sentiment?.replace(/_/g, ' ')}
          </span>
          {triggerResult.headline}
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ph-text-3)' }}>
            {triggerResult.articles_stored} articles · {(triggerResult.duration_ms / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {trigger.isError && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, color: '#ef4444',
        }}>
          {triggerError ?? 'Trigger failed. Ensure the edge function is deployed and secrets are set.'}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => trigger.mutate(false)}
          disabled={trigger.isPending}
          style={{
            padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
            background: '#00e5c4', color: '#0f1923',
            border: 'none', fontSize: 13, fontWeight: 600,
            opacity: trigger.isPending ? 0.6 : 1,
          }}
        >
          {trigger.isPending ? 'Generating…' : "Generate today's pulse"}
        </button>
        <button
          onClick={() => trigger.mutate(true)}
          disabled={trigger.isPending}
          style={{
            padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(0,229,196,0.25)',
            color: 'var(--ph-text-1)',
            fontSize: 13, fontWeight: 500,
            opacity: trigger.isPending ? 0.6 : 1,
          }}
        >
          Force regenerate
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Start dev server and verify admin tab**

```bash
npm run dev
```

Navigate to `/admin` (requires superuser tier). Click the "pulse" tab. Verify:
- Last pulse card shows if a pulse exists
- "Generate today's pulse" button is visible
- Clicking it calls the edge function (may fail until Task 8 is complete)

- [ ] **Step 8: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "feat: add pulse tab to AdminPage"
```

---

## Task 8: Deploy, Configure, and Verify

- [ ] **Step 1: Deploy the edge function**

```bash
npx supabase functions deploy generate-market-pulse --project-ref jzxdxcchmuyqbaccfpok
```

Expected output includes: `Deployed generate-market-pulse`

- [ ] **Step 2: Set secrets in Supabase dashboard**

Go to: **Supabase Dashboard → Edge Functions → generate-market-pulse → Secrets**

Set the following secrets (values must not have quotes):
- `OPENROUTER_API_KEY` — your OpenRouter API key (starts with `sk-or-v1-`)
- `OPENROUTER_MODEL` — `mistralai/mistral-7b-instruct:free` (or another model)
- `MARKET_PULSE_CRON_SECRET` — the random secret you generated in Task 1 Step 4
- `FINNHUB_API_KEY` — existing Finnhub key (already set in other functions; check it's set here too)
- `POLYGON_API_KEY` — existing Polygon key (same note as Finnhub)

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.

- [ ] **Step 3: Trigger a manual test via AdminPage**

Open the dashboard at `/admin`, go to the **Pulse** tab, and click **"Generate today's pulse"**. Expected: result card appears showing sentiment + headline.

If the function returns an error, check logs:

```bash
npx supabase functions logs generate-market-pulse --project-ref jzxdxcchmuyqbaccfpok
```

- [ ] **Step 4: Verify data was written to DB**

Run this in the Supabase SQL editor:

```sql
SELECT pulse_date, market_sentiment, headline, news_articles_fetched, news_articles_used, generation_duration_ms
FROM market_pulse ORDER BY pulse_date DESC LIMIT 3;

SELECT COUNT(*) AS article_count, pulse_date
FROM market_news GROUP BY pulse_date ORDER BY pulse_date DESC LIMIT 3;
```

Expected: `market_pulse` has a row for today; `market_news` has ≥1 rows for today.

- [ ] **Step 5: Verify Dashboard card renders**

Open the dashboard. Confirm:
- If today is a weekday (SGT): the 3-tab card renders with the AI pulse
- "Market pulse" tab shows sentiment badge, headline, summary, options context, wheel context, VIX, themes
- "All news" tab lists articles
- "Your tickers" tab filters by watchlist (empty state if no watchlist tickers match)

- [ ] **Step 6: Verify feature gate**

Log out, create a free-tier account or log in as one. Confirm the card is blurred / gated.

- [ ] **Step 7: Verify cron is active**

```sql
SELECT jobname, schedule, active, jobid FROM cron.job WHERE jobname = 'generate-market-pulse-daily';
```

Expected: `active = true`, `schedule = '30 0 * * 1-5'`

---

## Checklist

- [ ] SQL migration run in Supabase (market_pulse + market_news tables, RLS, indexes, cron)
- [ ] Edge function deployed
- [ ] Secrets set: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `MARKET_PULSE_CRON_SECRET`, `FINNHUB_API_KEY`, `POLYGON_API_KEY`
- [ ] Manual trigger test succeeds (via AdminPage Pulse tab)
- [ ] `market_pulse` row exists for today
- [ ] `market_news` articles exist for today
- [ ] Dashboard card renders all 3 tabs
- [ ] Watchlist tab filters correctly
- [ ] Weekend state correct on Sat/Sun SGT
- [ ] Feature gated — free users see blur
- [ ] Cron active in `cron.job`
