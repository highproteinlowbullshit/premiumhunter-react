†# Nightly IV Rank Edge Function Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move IV rank calculation from per-user frontend Polygon fetches to a nightly Supabase Edge Function, so the screener reads pre-calculated values instantly.

**Architecture:** The Edge Function ports the existing `calcHV()` HV-based algorithm (from `src/lib/polygon.ts`) into Deno, runs nightly Mon–Fri via pg_cron, and upserts into the existing `iv_snapshots` table using existing column names (`snapshot_date`, `current_hv`, `hv_30`, etc.). The screener already has a Supabase-first cache path — no data-flow changes needed. Frontend changes are: bump `SCREENER_CACHE_TTL` from 6h to 12h, and add a freshness badge in the screener header.

**Tech Stack:** Supabase Edge Functions (Deno 1.x), pg_cron, pg_net, Polygon.io `/v2/aggs/` endpoint, React/TypeScript frontend

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260408_iv_rank_cron.sql` | **Create** | `cron_run_logs` table + monitoring columns on `iv_snapshots` |
| `supabase/functions/calculate-iv-rank/index.ts` | **Create** | The Edge Function |
| `src/hooks/useMarketData.ts` | **Modify** (1 line) | Bump `SCREENER_CACHE_TTL` to 12 h |
| `src/pages/Screener.tsx` | **Modify** | Add freshness badge hook + inline component to header |

---

## Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/20260408_iv_rank_cron.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260408_iv_rank_cron.sql

-- ── Monitoring columns on iv_snapshots ────────────────────────────────────────
-- These are optional metadata columns. The Edge Function writes them;
-- the frontend ignores them. Safe to add with IF NOT EXISTS.
ALTER TABLE iv_snapshots
  ADD COLUMN IF NOT EXISTS current_price       DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS data_source         TEXT DEFAULT 'frontend_live',
  ADD COLUMN IF NOT EXISTS calculation_success BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS error_message       TEXT;

-- ── cron_run_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cron_run_logs (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name    TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,
  duration_seconds DECIMAL(8,2),
  stocks_processed INTEGER DEFAULT 0,
  stocks_succeeded INTEGER DEFAULT 0,
  stocks_failed    INTEGER DEFAULT 0,
  errors           TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_function_started
  ON cron_run_logs (function_name, started_at DESC);

-- RLS: authenticated users can SELECT (for the freshness indicator in the UI)
-- Service role (used by the Edge Function) bypasses RLS automatically.
ALTER TABLE cron_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cron logs"
  ON cron_run_logs FOR SELECT
  USING (auth.role() = 'authenticated');
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → paste and run the file contents.

Verify: `SELECT column_name FROM information_schema.columns WHERE table_name = 'iv_snapshots' AND column_name = 'data_source';` should return 1 row. `SELECT COUNT(*) FROM cron_run_logs;` should return 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260408_iv_rank_cron.sql
git commit -m "feat: add cron_run_logs table and iv_snapshots monitoring columns"
```

---

## Task 2: Supabase CLI Setup

**Files:** none (CLI config only)

- [ ] **Step 1: Check if Supabase CLI is initialized**

```bash
ls supabase/config.toml 2>/dev/null && echo "Already initialized" || echo "Need to init"
```

- [ ] **Step 2: If not initialized, run init**

```bash
supabase init
```

This creates `supabase/config.toml`. If it already exists, skip this step.

- [ ] **Step 3: Link to your Supabase project**

Get your project ref from Supabase Dashboard → Settings → General → Reference ID.

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

You'll be prompted for the database password. Find it at Dashboard → Settings → Database → Database password.

- [ ] **Step 4: Verify link**

```bash
supabase status
```

Expected: shows your project URL and anon/service role keys.

- [ ] **Step 5: Commit config.toml if newly created**

```bash
git add supabase/config.toml
git commit -m "chore: initialize supabase CLI config"
```

---

## Task 3: Edge Function — Scaffold + HV Algorithm

**Files:**
- Create: `supabase/functions/calculate-iv-rank/index.ts`

- [ ] **Step 1: Scaffold the function directory**

```bash
supabase functions new calculate-iv-rank
```

This creates `supabase/functions/calculate-iv-rank/index.ts` with a boilerplate handler.

- [ ] **Step 2: Replace the entire file with the Edge Function**

The algorithm below is a direct port of `polygon.ts`'s `calcHV()` + `getIVData()` — same math, same output values. Column names match the existing `iv_snapshots` schema exactly.

```typescript
// supabase/functions/calculate-iv-rank/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Stock list — must stay in sync with src/lib/stockList.ts ──────────────
const STOCK_TICKERS = [
  'GME','MARA','SOFI','RIVN','COIN','HOOD','AMC','PLTR','RBLX','SNAP',
  'UBER','LYFT','IONQ','SMCI','NVAX','TLRY','RIOT','CLSK','MSTR','WULF',
  'TSLA','NVDA','AMD','META','NFLX','SHOP','SQ','ROKU','NET','DDOG',
  'CRWD','SNOW','ZM','DOCN','MDB','BILL','AFRM','UPST','OPEN','ABNB',
  'AAPL','MSFT','GOOGL','AMZN','JPM','BAC','GS','XOM','CVX','DIS',
  'NKE','BA','F','GM','PFE','SPY','QQQ','IWM','GLD','SLV',
  'TLT','XLE','XLF','ARKK','SOXL','LCID','NKLA','CLOV','BBAI','SOUN',
  'RGTI','QBTS','KULR','HIMS','AISP',
]

// ── Types ─────────────────────────────────────────────────────────────────
interface IVDataPoint {
  week: string
  date: string
  ivRank: number
  iv: number
}

interface IVSnapshot {
  ticker: string
  snapshot_date: string
  iv_rank: number | null
  iv_percentile: number | null
  current_hv: number | null
  hv_30: number | null
  hv_52wk_high: number | null
  hv_52wk_low: number | null
  iv_hv_ratio: number | null
  weekly_history: IVDataPoint[] | null
  current_price: number | null
  data_source: string
  calculation_success: boolean
  error_message: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 15000): Promise<Response> {
  let lastError: Error = new Error('Unknown error')
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '10')
        console.warn(`Rate limited, waiting ${retryAfter}s`)
        await delay(retryAfter * 1000)
        continue
      }
      if (response.status >= 500) {
        await delay(1000 * Math.pow(2, attempt))
        continue
      }
      return response
    } catch (err) {
      lastError = err as Error
      if (attempt < maxRetries - 1) await delay(1000 * Math.pow(2, attempt))
    }
  }
  throw lastError
}

// Exact port of src/lib/polygon.ts calcHV — DO NOT diverge from this formula.
// Returns HV as integer % (e.g. 85 = 85% annualised vol).
function calcHV(closes: number[], window: number): number {
  if (closes.length < window + 1) return 0
  const slice = closes.slice(-(window + 1))
  const returns: number[] = []
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]))
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1)
  return Math.round(Math.sqrt(Math.max(0, variance) * 252) * 100)
}

// ── Polygon: fetch 1yr + 35d of daily OHLCV ───────────────────────────────
async function fetchOHLCV(
  ticker: string,
  polygonKey: string
): Promise<{ closes: number[]; timestamps: number[]; lastClose: number | null }> {
  const to = new Date()
  const from = new Date(to)
  from.setFullYear(from.getFullYear() - 1)
  from.setDate(from.getDate() - 35)
  const toStr = to.toISOString().split('T')[0]
  const fromStr = from.toISOString().split('T')[0]

  const url =
    `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}` +
    `?adjusted=true&sort=asc&limit=500&apiKey=${polygonKey}`

  const res = await fetchWithRetry(url)
  if (!res.ok) throw new Error(`Polygon ${ticker}: HTTP ${res.status}`)

  const json = await res.json()
  const results: Array<{ c: number; t: number }> = json.results ?? []

  if (results.length < 65) {
    throw new Error(`Insufficient data for ${ticker}: only ${results.length} bars`)
  }

  const closes = results.map(r => r.c)
  const timestamps = results.map(r => r.t)
  return { closes, timestamps, lastClose: closes[closes.length - 1] ?? null }
}

// ── Compute IV rank — exact port of getIVData in polygon.ts ───────────────
function computeIVRank(
  closes: number[],
  timestamps: number[]
): Pick<IVSnapshot, 'iv_rank' | 'iv_percentile' | 'current_hv' | 'hv_30' | 'hv_52wk_high' | 'hv_52wk_low' | 'iv_hv_ratio' | 'weekly_history'> {
  // Rolling 30-day HV series (one value per trading day after bootstrap)
  const hvSeries: number[] = []
  for (let i = 31; i <= closes.length; i++) {
    hvSeries.push(calcHV(closes.slice(i - 31, i), 30))
  }

  const currentHV = hvSeries[hvSeries.length - 1] ?? 0
  const hv52wkHigh = Math.max(...hvSeries)
  const hv52wkLow = Math.min(...hvSeries)

  const ivRank =
    hv52wkHigh > hv52wkLow
      ? Math.round(((currentHV - hv52wkLow) / (hv52wkHigh - hv52wkLow)) * 100)
      : 50

  const belowCount = hvSeries.filter(v => v <= currentHV).length
  const ivPercentile = Math.round((belowCount / hvSeries.length) * 100)

  const hv60 = calcHV(closes, 60)
  const ivHvRatio = hv60 > 0 ? parseFloat((currentHV / hv60).toFixed(2)) : 1.0

  // 52 weekly data points for chart (used by Watchlist + Stock Detail pages)
  const weeklyHistory: IVDataPoint[] = []
  const totalPoints = Math.min(52, hvSeries.length)
  for (let p = 0; p < totalPoints; p++) {
    const i = Math.round(p * (hvSeries.length - 1) / Math.max(totalPoints - 1, 1))
    const tsIndex = 31 + i
    const ts = timestamps[tsIndex] ?? Date.now()
    const weekHV = hvSeries[i]
    const weekIVRank =
      hv52wkHigh > hv52wkLow
        ? Math.min(100, Math.max(0, Math.round(((weekHV - hv52wkLow) / (hv52wkHigh - hv52wkLow)) * 100)))
        : 50
    weeklyHistory.push({
      week: `W${p + 1}`,
      date: new Date(ts).toISOString().split('T')[0],
      ivRank: weekIVRank,
      iv: weekHV,
    })
  }

  return {
    iv_rank: Math.min(100, Math.max(0, ivRank)),
    iv_percentile: Math.min(100, Math.max(0, ivPercentile)),
    current_hv: currentHV,
    hv_30: currentHV,
    hv_52wk_high: hv52wkHigh,
    hv_52wk_low: hv52wkLow,
    iv_hv_ratio: ivHvRatio,
    weekly_history: weeklyHistory,
  }
}

// ── Process one ticker ─────────────────────────────────────────────────────
async function processTicker(
  ticker: string,
  polygonKey: string,
  today: string
): Promise<IVSnapshot> {
  const base: IVSnapshot = {
    ticker,
    snapshot_date: today,
    iv_rank: null, iv_percentile: null,
    current_hv: null, hv_30: null,
    hv_52wk_high: null, hv_52wk_low: null,
    iv_hv_ratio: null, weekly_history: null,
    current_price: null,
    data_source: 'edge_function',
    calculation_success: false,
    error_message: null,
  }

  try {
    const { closes, timestamps, lastClose } = await fetchOHLCV(ticker, polygonKey)
    const ivData = computeIVRank(closes, timestamps)
    return { ...base, ...ivData, current_price: lastClose, calculation_success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${ticker}: ${message}`)
    return { ...base, error_message: message }
  }
}

// ── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  // Auth: Bearer token must be the service role key
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader.includes(serviceKey) || serviceKey === '') {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const polygonKey = Deno.env.get('POLYGON_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!polygonKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing env vars: POLYGON_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const today = new Date().toISOString().split('T')[0]
  const startTime = Date.now()

  console.log(`IV rank calculation — ${STOCK_TICKERS.length} tickers — ${new Date().toISOString()}`)

  const results: IVSnapshot[] = []
  const errors: string[] = []
  const BATCH_SIZE = 5
  const BATCH_DELAY_MS = 2500

  for (let i = 0; i < STOCK_TICKERS.length; i += BATCH_SIZE) {
    const batch = STOCK_TICKERS.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(STOCK_TICKERS.length / BATCH_SIZE)
    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`)

    const settled = await Promise.allSettled(
      batch.map(ticker => processTicker(ticker, polygonKey, today))
    )

    settled.forEach((result, idx) => {
      const ticker = batch[idx]
      if (result.status === 'fulfilled') {
        results.push(result.value)
        if (result.value.calculation_success) {
          console.log(`  ✓ ${ticker}: IV Rank ${result.value.iv_rank}, HV30 ${result.value.current_hv}%`)
        } else {
          errors.push(`${ticker}: ${result.value.error_message}`)
        }
      } else {
        errors.push(`${ticker}: ${result.reason}`)
      }
    })

    if (i + BATCH_SIZE < STOCK_TICKERS.length) {
      await delay(BATCH_DELAY_MS)
    }
  }

  // Bulk upsert using existing unique constraint (ticker, snapshot_date)
  const { error: upsertError } = await supabase
    .from('iv_snapshots')
    .upsert(results, { onConflict: 'ticker,snapshot_date', ignoreDuplicates: false })

  if (upsertError) {
    console.error('Upsert failed:', upsertError)
    return new Response(
      JSON.stringify({ error: 'Database write failed', details: upsertError }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const successCount = results.filter(r => r.calculation_success).length
  const durationSeconds = (Date.now() - startTime) / 1000

  // Fire-and-forget run log (non-fatal if it fails)
  supabase.from('cron_run_logs').insert({
    function_name: 'calculate-iv-rank',
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    duration_seconds: durationSeconds,
    stocks_processed: STOCK_TICKERS.length,
    stocks_succeeded: successCount,
    stocks_failed: results.length - successCount,
    errors: errors.length > 0 ? errors : null,
  }).then(({ error }) => { if (error) console.warn('cron_run_logs write failed:', error) })

  console.log(`Done in ${durationSeconds.toFixed(1)}s — ${successCount}/${STOCK_TICKERS.length} succeeded`)

  return new Response(
    JSON.stringify({
      success: true,
      duration_seconds: durationSeconds,
      stocks_processed: STOCK_TICKERS.length,
      stocks_succeeded: successCount,
      stocks_failed: results.length - successCount,
      errors: errors.length > 0 ? errors : null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/calculate-iv-rank/index.ts
git commit -m "feat: add calculate-iv-rank edge function (HV-based)"
```

---

## Task 4: Set Secrets and Deploy

**Files:** none (CLI commands only)

- [ ] **Step 1: Set the Polygon API key as a Supabase secret**

```bash
supabase secrets set POLYGON_API_KEY=your_polygon_api_key_here
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically inside Edge Functions — do not set them manually.

- [ ] **Step 2: Deploy the function**

```bash
supabase functions deploy calculate-iv-rank --no-verify-jwt
```

`--no-verify-jwt` is required because the function uses its own auth check (service role key in the Authorization header) rather than Supabase JWT auth.

Expected output:
```
Deploying Function calculate-iv-rank
Done: calculate-iv-rank
```

- [ ] **Step 3: Get your project URL and service role key**

Go to Supabase Dashboard → Settings → API. Copy:
- `Project URL` → e.g. `https://abcdefgh.supabase.co`
- `service_role` key (under "Project API keys")

- [ ] **Step 4: Test with curl**

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/calculate-iv-rank \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (after ~3 minutes):
```json
{
  "success": true,
  "duration_seconds": 180.4,
  "stocks_processed": 75,
  "stocks_succeeded": 73,
  "stocks_failed": 2,
  "errors": null
}
```

- [ ] **Step 5: Check logs in dashboard**

Supabase Dashboard → Edge Functions → `calculate-iv-rank` → Logs. Confirm each batch logged, and `✓` entries appear for most tickers.

- [ ] **Step 6: Verify data was written**

In Supabase SQL Editor:
```sql
SELECT ticker, snapshot_date, iv_rank, current_hv, data_source
FROM iv_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND data_source = 'edge_function'
ORDER BY iv_rank DESC
LIMIT 10;
```

Expected: rows for ~70+ tickers with today's date.

---

## Task 5: Schedule the Cron Job

**Files:** none (SQL commands in Supabase Dashboard)

- [ ] **Step 1: Enable pg_cron extension**

Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable.

Also enable `pg_net` the same way (required for HTTP calls from cron).

- [ ] **Step 2: Set database-level settings for the cron job**

Run in Supabase SQL Editor — replace the placeholders with your actual values:

```sql
ALTER DATABASE postgres
  SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';

ALTER DATABASE postgres
  SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

- [ ] **Step 3: Schedule the nightly cron job**

Run in Supabase SQL Editor:

```sql
SELECT cron.schedule(
  'nightly-iv-rank-calculation',
  '0 23 * * 1-5',
  $$
  SELECT net.http_post(
    url    := current_setting('app.settings.supabase_url') || '/functions/v1/calculate-iv-rank',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body   := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Schedule `'0 23 * * 1-5'` = Mon–Fri at 11 PM UTC (6–7 PM ET, after market close).

- [ ] **Step 4: Verify the schedule was created**

```sql
SELECT jobname, schedule, command FROM cron.job;
```

Expected: one row with `nightly-iv-rank-calculation`.

- [ ] **Step 5: Commit a SQL reference file**

```bash
# Create a reference file so the cron setup is documented in the repo
cat > supabase/cron-setup.sql << 'EOF'
-- Run these commands once in Supabase SQL Editor after enabling pg_cron + pg_net.
-- Replace placeholders with actual values from Dashboard > Settings > API.

ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

SELECT cron.schedule(
  'nightly-iv-rank-calculation',
  '0 23 * * 1-5',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/calculate-iv-rank',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
EOF

git add supabase/cron-setup.sql
git commit -m "docs: add cron setup reference SQL"
```

---

## Task 6: Frontend — Extend Cache TTL

**Files:**
- Modify: `src/hooks/useMarketData.ts:16`

- [ ] **Step 1: Change `SCREENER_CACHE_TTL` from 6 hours to 12 hours**

In `src/hooks/useMarketData.ts`, line 16:

```typescript
// Before:
const SCREENER_CACHE_TTL = 6 * 60 * 60 * 1000;

// After:
const SCREENER_CACHE_TTL = 12 * 60 * 60 * 1000;
```

With the cron running nightly, IV data is valid all day. 12h means a user who loaded the screener at 8 AM won't refetch until 8 PM — safe since the next update is at 11 PM UTC.

- [ ] **Step 2: Also update the localStorage key version to bust stale 6h caches**

In `src/hooks/useMarketData.ts`, line 17:

```typescript
// Before:
const SCREENER_LS_KEY = 'ph_screener_v1';

// After:
const SCREENER_LS_KEY = 'ph_screener_v2';
```

This ensures users with a stale `v1` cache (6h TTL) don't carry over stale entries — the `v2` key starts fresh.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMarketData.ts
git commit -m "feat: extend screener cache TTL to 12h now that cron pre-calculates IV nightly"
```

---

## Task 7: Frontend — IV Data Freshness Indicator

**Files:**
- Modify: `src/pages/Screener.tsx`

This adds a small badge to the screener header showing when IV data was last calculated. It queries `cron_run_logs` for the latest run.

- [ ] **Step 1: Add the freshness query hook inside `Screener.tsx`**

Add this import at the top of `src/pages/Screener.tsx`, alongside existing imports:

```typescript
import { useEffect, useState } from 'react'; // already imported — no change needed
import { supabase } from '../lib/supabase';
```

Add this hook and helper **inside the file, before the main `Screener` component function**:

```typescript
// ── IV data freshness ─────────────────────────────────────────────────────

interface CronRunLog {
  completed_at: string;
  stocks_succeeded: number;
  stocks_failed: number;
}

function useIVFreshness() {
  const [lastRun, setLastRun] = useState<CronRunLog | null>(null);

  useEffect(() => {
    supabase
      .from('cron_run_logs')
      .select('completed_at, stocks_succeeded, stocks_failed')
      .eq('function_name', 'calculate-iv-rank')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setLastRun(data as CronRunLog); });
  }, []);

  return lastRun;
}

function IVFreshnessBadge({ lastRun }: { lastRun: CronRunLog | null }) {
  if (!lastRun) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4a6a8a' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a6a8a', flexShrink: 0 }} />
        IV data pending — first calculation runs tonight
      </span>
    );
  }

  const completedAt = new Date(lastRun.completed_at);
  const today = new Date();
  const isToday =
    completedAt.getDate() === today.getDate() &&
    completedAt.getMonth() === today.getMonth() &&
    completedAt.getFullYear() === today.getFullYear();
  const isYesterday = !isToday && today.getTime() - completedAt.getTime() < 48 * 60 * 60 * 1000;

  const timeStr = completedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ab4d4' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d68f', flexShrink: 0 }} />
        IV data from today's close ({timeStr})
      </span>
    );
  }
  if (isYesterday) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ab4d4' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f5c842', flexShrink: 0 }} />
        IV data from yesterday's close — updates tonight
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4a6a8a' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a6a8a', flexShrink: 0 }} />
      IV data may be stale — check cron schedule
    </span>
  );
}
```

- [ ] **Step 2: Wire the hook and badge inside the `Screener` component**

Inside the `Screener` function, add:

```typescript
const lastRun = useIVFreshness();
```

Then find the screener header in the JSX (the element containing "IV Rank Screener" text) and add `<IVFreshnessBadge lastRun={lastRun} />` below the title. The exact insertion point will vary based on the current header markup — place it as a sibling to the title heading, e.g.:

```tsx
{/* existing title heading */}
<h1 ...>IV Rank Screener</h1>
{/* add this line immediately after */}
<IVFreshnessBadge lastRun={lastRun} />
```

- [ ] **Step 3: Verify it renders without errors**

```bash
npm run dev
```

Open the screener page. Before the first cron run, the badge should show "IV data pending — first calculation runs tonight" in gray. After a manual test run (Task 4 Step 4), reload and it should show green.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Screener.tsx
git commit -m "feat: add IV data freshness badge to screener header"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Edge Function calculates IV rank for all 75 stocks ✓ (Task 3)
- [x] HV-based algorithm (approach A) — exact port of `calcHV()` ✓ (Task 3)
- [x] Writes to `iv_snapshots` with existing column names ✓ (Task 3)
- [x] `cron_run_logs` table created ✓ (Task 1)
- [x] pg_cron schedule Mon–Fri 11 PM UTC ✓ (Task 5)
- [x] Auth via service role key header ✓ (Task 3)
- [x] Batches of 5 with 2.5s delay ✓ (Task 3)
- [x] `POLYGON_API_KEY` set as secret ✓ (Task 4)
- [x] Manual curl test ✓ (Task 4)
- [x] Freshness indicator in screener header ✓ (Task 7)
- [x] Cache TTL extended to 12h ✓ (Task 6)
- [x] `weekly_history` JSONB populated (benefits Watchlist + Stock Detail) ✓ (Task 3)
- [x] localStorage cache key bumped to bust stale entries ✓ (Task 6)

### Items intentionally excluded (approach A decision)
- Admin manual trigger (Step 10 of original spec) — deferred. The curl command in Task 4 Step 4 serves this purpose for now.
- `supabase init` may not be needed if `config.toml` already exists — Task 2 Step 1 checks first.
