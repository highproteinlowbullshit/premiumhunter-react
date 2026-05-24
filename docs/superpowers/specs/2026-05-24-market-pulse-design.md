# AI Market Pulse — Design Spec
**Date:** 2026-05-24
**Status:** Approved

---

## Overview

A shared daily market summary generated once every weekday morning and displayed on the dashboard for all Pro users. Ticker-specific news is filtered client-side per user using their watchlist. No per-user AI calls — total daily AI cost is one OpenRouter call regardless of user count.

---

## Architecture

```
pg_cron (0:30 UTC, Mon–Fri)
  └─▶ generate-market-pulse (edge function)
        ├─▶ Finnhub general/forex/crypto news
        ├─▶ Polygon ticker news (SPY, VIX, MARA, COIN, GME)
        ├─▶ Deduplicate + relevance score articles
        ├─▶ OpenRouter AI call → structured JSON pulse
        ├─▶ Upsert → market_pulse (one row/day)
        └─▶ Insert → market_news (up to 50 articles/day)

Dashboard (client)
  └─▶ useMarketPulse hook
        ├─▶ SELECT market_pulse WHERE pulse_date = today
        ├─▶ SELECT market_news WHERE pulse_date = today
        └─▶ Client-side filter by WatchlistContext tickers
              └─▶ MarketPulseCard (3 tabs: Pulse / All News / Your Tickers)
```

---

## Database Schema

### `market_pulse`
One row per trading day. Upserted on `pulse_date` conflict.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| pulse_date | DATE UNIQUE | e.g. 2026-05-24 |
| market_sentiment | TEXT | bullish / slightly_bullish / neutral / slightly_bearish / bearish |
| sentiment_score | INTEGER | -100 to +100 |
| headline | TEXT | ≤15 words, punchy |
| summary | TEXT | 2–3 sentences |
| options_context | TEXT | What conditions mean for premium sellers |
| key_themes | JSONB | string[] |
| source_articles | JSONB | top 20 articles as {title, source, url, datetime, tickers} |
| mentioned_tickers | JSONB | string[] of all tickers seen across articles |
| wheel_relevant_context | TEXT | MARA/RIOT/COIN/TSLA/etc. specific |
| vix_context | TEXT | One sentence on vol environment |
| model_used | TEXT | OpenRouter model ID |
| generated_at | TIMESTAMPTZ | |
| generation_duration_ms | INTEGER | |
| news_articles_fetched | INTEGER | |
| news_articles_used | INTEGER | |
| created_at | TIMESTAMPTZ | |

### `market_news`
Individual articles for client-side watchlist filtering. Up to 50 per day.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| pulse_date | DATE | FK reference date |
| headline | TEXT | |
| summary | TEXT | truncated to 500 chars |
| source | TEXT | |
| url | TEXT | |
| datetime | TIMESTAMPTZ | |
| related_tickers | JSONB | string[] — used for client-side filter |
| category | TEXT | general / forex / crypto / stock |
| relevance_score | INTEGER | 0–100, computed during processing |
| source_api | TEXT | finnhub / polygon |
| created_at | TIMESTAMPTZ | |

### RLS
- Both tables: authenticated users can SELECT
- Service role bypasses RLS for all writes (write policies included as documentation, not enforcement)
- Indexes: `pulse_date DESC` on both, GIN on `market_news.related_tickers`

---

## Edge Function: `generate-market-pulse`

### Auth
Accepts `Authorization: Bearer <MARKET_PULSE_CRON_SECRET>` for cron calls.  
For manual admin triggers, accepts the user's Supabase JWT (superuser tier checked server-side).

### Flow
1. Check if today's pulse exists → return early unless `?force=true`
2. Fetch Finnhub news (general, forex, crypto — top 15 per category)
3. Fetch Polygon news (SPY, VIX, MARA, COIN, GME — top 5 each)
4. Deduplicate on first 60 chars of headline
5. Score relevance (keywords, wheel tickers, recency boost)
6. Send top 15 articles to OpenRouter → structured JSON
7. Upsert `market_pulse`, insert top 50 articles into `market_news`

### OpenRouter config
- Model: `OPENROUTER_MODEL` env var, default `mistralai/mistral-7b-instruct:free`
- max_tokens: 600, temperature: 0.3
- Fallback pulse stored if AI call fails (no crash)

### Secrets required
```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=mistralai/mistral-7b-instruct:free
MARKET_PULSE_CRON_SECRET=<random>
FINNHUB_API_KEY=<existing>
POLYGON_API_KEY=<existing>
SUPABASE_URL=<auto-injected>
SUPABASE_SERVICE_ROLE_KEY=<auto-injected>
```

---

## Cron Schedule

```sql
SELECT cron.schedule(
  'generate-market-pulse-daily',
  '30 0 * * 1-5',   -- 00:30 UTC = 08:30 SGT Mon–Fri
  $$ SELECT net.http_post(
    url := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/generate-market-pulse',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <MARKET_PULSE_CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ); $$
);
```

---

## Hook: `useMarketPulse`

```ts
useMarketPulse(watchlistTickers: string[])
// Returns: { pulse, allArticles, watchlistArticles, isLoading, isAvailable, isWeekend }
```

- Fetches `market_pulse` and `market_news` for today
- Weekend detection uses SGT (UTC+8): checks if current SGT date is Saturday or Sunday
- `watchlistArticles` filtered client-side from `allArticles` — no extra query
- Watchlist tickers come from `useWatchlistContext()` in Dashboard, passed as prop
- `staleTime: 30 * 60 * 1000`, `refetchInterval: 30 * 60 * 1000`

---

## Component: `MarketPulseCard`

### Icons (Lucide — no emojis)
| Element | Icon |
|---------|------|
| Card header | `<Newspaper />` |
| Bullish sentiment | `<TrendingUp />` |
| Bearish sentiment | `<TrendingDown />` |
| Neutral sentiment | `<Minus />` |
| Slightly bullish | `<TrendingUp size={14} />` (dimmed) |
| Slightly bearish | `<TrendingDown size={14} />` (dimmed) |
| Options context label | `<Settings2 size={11} />` |
| Wheel stocks label | `<Target size={11} />` |
| VIX context label | `<BarChart2 size={11} />` |
| Weekend state | `<CalendarOff />` |
| Generating state | `<Clock />` |
| Article external link | `<ExternalLink size={10} />` |

### States
1. **Loading** — skeleton placeholders
2. **Weekend** — `<CalendarOff />` + "Markets closed. AI Market Pulse resumes Monday."
3. **No pulse yet** — `<Clock />` + "Market pulse generating... check back shortly."
4. **Loaded** — full 3-tab card

### Tabs
- **Market pulse** — sentiment badge, headline, summary, options context box, wheel stocks box, VIX line, key theme chips, footer (model + article count + "Not financial advice")
- **All news (N)** — scrollable article list, relevance-sorted
- **Your tickers (N)** — same list filtered to watchlist, empty state if none

### Sentiment colours
| Value | Colour |
|-------|--------|
| bullish | `#22c55e` |
| slightly_bullish | `#14b8a6` |
| neutral | `var(--ph-text-3)` |
| slightly_bearish | `#f59e0b` |
| bearish | `#ef4444` |

---

## Dashboard Integration

**Position:** between `<PortfolioGreeksDashboard>` and `<MonthlyPnLChart>`

```tsx
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

Watchlist tickers from existing `useWatchlistContext()` — no additional query.

---

## Feature Config

```ts
// FEATURES
market_pulse: 'pro',

// FEATURE_LABELS
market_pulse: 'AI Market Pulse with daily news',
```

---

## Admin Panel

New **"Market Pulse"** tab added to `AdminPage` alongside users / audit / health.

Uses `supabase.functions.invoke('generate-market-pulse', { body: { force } })` — attaches user JWT automatically, edge function validates superuser tier.

Displays:
- Last generated pulse (date, sentiment, headline, duration, article count)
- "Generate today's pulse" button
- "Force regenerate" button
- Result panel showing sentiment + headline after trigger

---

## New Files

| Path | Purpose |
|------|---------|
| `supabase/functions/generate-market-pulse/index.ts` | Edge function |
| `src/hooks/useMarketPulse.ts` | Data hook |
| `src/components/MarketPulseCard.tsx` | Dashboard card |

## Modified Files

| Path | Change |
|------|--------|
| `src/lib/featureConfig.ts` | Add `market_pulse: 'pro'` |
| `src/pages/Dashboard.tsx` | Wire hook + card |
| `src/pages/AdminPage.tsx` | Add Market Pulse tab |

## SQL to Run

1. Create `market_pulse` table + RLS + indexes
2. Create `market_news` table + RLS + indexes
3. Schedule `generate-market-pulse-daily` cron

---

## Checklist

- [ ] SQL migration run in Supabase
- [ ] Edge function deployed
- [ ] Secrets set: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `MARKET_PULSE_CRON_SECRET`
- [ ] Manual trigger test succeeds
- [ ] `market_pulse` row exists for today
- [ ] `market_news` articles exist for today
- [ ] Dashboard card renders all 3 tabs
- [ ] Watchlist tab filters correctly
- [ ] Weekend state correct on Sat/Sun SGT
- [ ] Feature gated — free users see blur
- [ ] Cron active in `cron.job`
