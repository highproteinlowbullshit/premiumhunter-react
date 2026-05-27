# Yahoo Finance Options IV & Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace HV-proxy IV with real market-implied IV from Yahoo Finance for all 488 screener tickers, and add actual bid/ask contract pricing for open positions to drive accurate unrealized P&L and close modal suggestions.

**Architecture:** Two phases sharing the same Yahoo Finance options API pattern. Phase 1 adds ATM IV to the existing 244-batch nightly cron (`calculate-iv-rank`), storing `current_iv` in `iv_snapshots` — this feeds the IV screener, Black-Scholes Greeks, and all IV-dependent features. Phase 2 adds a new edge function (`fetch-option-prices`) on a 20-minute market-hours cron, storing per-contract bid/ask in a new `option_price_snapshots` table — this feeds the open positions unrealized P&L and the close modal.

**Tech Stack:** Deno (edge functions), Supabase (Postgres + pg_cron + RLS), React Query, Yahoo Finance v7 options API (unofficial, no API key), TypeScript

---

## File Structure

**Create:**
- `supabase/migrations/20260527_yahoo_finance_options.sql` — adds `current_iv` column to `iv_snapshots`; creates `option_price_snapshots` table with RLS
- `supabase/functions/fetch-option-prices/index.ts` — new cron-only edge function that queries all open positions and fetches contract-level bid/ask from Yahoo Finance

**Modify:**
- `supabase/functions/calculate-iv-rank/index.ts` — adds `fetchYahooATMIV()` and calls it in `processTicker()`; updates `iv_hv_ratio` to real IV/HV; updates upsert to include `current_iv`
- `src/types/index.ts` — adds `optionBid?: number | null` and `optionAsk?: number | null` to `WheelPosition`
- `src/lib/blackScholes.ts` — adds `'yahoo_snapshot'` to the `PositionGreeks['ivSource']` union
- `src/hooks/usePortfolioGreeks.ts` — reads `current_iv` from `iv_snapshots`, uses it as `impliedVolatility` (falling back to `current_hv` then estimate), sets `ivSource` to `'yahoo_snapshot'`
- `src/hooks/usePositions.ts` — after fetching positions, queries `option_price_snapshots` for open positions and patches `currentPrice`, `optionBid`, `optionAsk` from the snapshot
- `src/pages/WheelTracker.tsx` — `ClosePositionModal` initialises closing price to snapshot mid and shows Bid/Ask hint

---

## Task 1: SQL Migrations

**Files:**
- Create: `supabase/migrations/20260527_yahoo_finance_options.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260527_yahoo_finance_options.sql

-- Phase 1: real IV column alongside HV in iv_snapshots
ALTER TABLE iv_snapshots
  ADD COLUMN IF NOT EXISTS current_iv numeric;  -- integer %, e.g. 35 = 35% (matches current_hv scale)

-- Phase 2: per-contract option price snapshots (global market data, not per-user)
CREATE TABLE IF NOT EXISTS option_price_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker          text        NOT NULL,
  strike          numeric     NOT NULL,
  expiry          date        NOT NULL,
  contract_type   text        NOT NULL CHECK (contract_type IN ('call', 'put')),
  snapshot_date   date        NOT NULL,
  snapshot_time   timestamptz NOT NULL DEFAULT now(),
  bid             numeric,
  ask             numeric,
  mid             numeric,
  last_price      numeric,
  implied_volatility numeric,  -- integer %, e.g. 35 = 35%
  volume          integer,
  open_interest   integer,
  UNIQUE (ticker, strike, expiry, contract_type, snapshot_date)
);

ALTER TABLE option_price_snapshots ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read market data (no user-specific rows)
CREATE POLICY "authenticated_read_option_prices"
  ON option_price_snapshots FOR SELECT
  TO authenticated USING (true);

-- Index for the join in usePositions: lookup by (ticker, expiry, snapshot_date)
CREATE INDEX IF NOT EXISTS idx_option_prices_lookup
  ON option_price_snapshots (ticker, expiry, snapshot_date DESC);
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push --project-ref jzxdxcchmuyqbaccfpok
```

Expected output: `Applying migration 20260527_yahoo_finance_options.sql...`

- [ ] **Step 3: Verify both changes landed**

```bash
npx supabase db query "SELECT column_name FROM information_schema.columns WHERE table_name = 'iv_snapshots' AND column_name = 'current_iv';" --project-ref jzxdxcchmuyqbaccfpok

npx supabase db query "SELECT table_name FROM information_schema.tables WHERE table_name = 'option_price_snapshots';" --project-ref jzxdxcchmuyqbaccfpok
```

Expected: one row each.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260527_yahoo_finance_options.sql
git commit -m "feat: add current_iv column and option_price_snapshots table"
```

---

## Task 2: Yahoo ATM IV in calculate-iv-rank Edge Function

**Files:**
- Modify: `supabase/functions/calculate-iv-rank/index.ts`

Context: This function already fetches Polygon OHLCV and computes HV. We add `fetchYahooATMIV()` which runs in parallel with the OHLCV fetch inside `processTicker()`. The current price from OHLCV is used to find the ATM strike. Yahoo returns IV as a decimal (0.32 = 32%); we convert to integer % (32) to match `current_hv` scale. The `iv_hv_ratio` is updated from `hv30/hv60` (a momentum proxy) to `current_iv / current_hv` (the actual volatility risk premium signal). If Yahoo fails for any ticker, `current_iv` is stored as `null` — the screener continues to work using `current_hv` as fallback.

- [ ] **Step 1: Add `fetchYahooATMIV` after the existing `fetchATMOptionsData` function (around line 270)**

Insert this block after the closing `}` of `fetchATMOptionsData`:

```typescript
// ── Yahoo Finance: fetch ATM implied volatility ────────────────────────────
// Returns integer % (e.g. 35 = 35%) or null on any failure.
// Yahoo returns IV as a decimal (0.35 = 35%) — we multiply by 100 and round.
// Uses the nearest available expiry, targeting 21–49 DTE where possible.
async function fetchYahooATMIV(
  ticker: string,
  currentPrice: number,
): Promise<number | null> {
  if (currentPrice <= 0) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PremiumHunter/1.0)',
          'Accept': 'application/json',
        },
      },
    )
    clearTimeout(timer)
    if (!res.ok) return null

    const data = await res.json()
    const result = data?.optionChain?.result?.[0]
    if (!result) return null

    // Prefer an expiry in the 21–49 DTE window; fall back to nearest if none
    const today = Date.now() / 1000
    const expirationDates: number[] = result.expirationDates ?? []
    const preferred = expirationDates.find(ts => {
      const daysOut = (ts - today) / 86400
      return daysOut >= 21 && daysOut <= 49
    })
    const targetExpiry = preferred ?? expirationDates[0]
    if (!targetExpiry) return null

    // options[] is ordered by expiry; find the one matching targetExpiry
    const optionSet = (result.options ?? []).find(
      (o: { expirationDate: number }) => o.expirationDate === targetExpiry,
    )
    if (!optionSet) return null

    type YContract = { strike: number; impliedVolatility?: number; bid?: number; ask?: number }
    const calls: YContract[] = optionSet.calls ?? []
    const puts:  YContract[] = optionSet.puts  ?? []

    // ATM = strike closest to current price across both sides
    const allStrikes = [...new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])]
    if (allStrikes.length === 0) return null
    const atmStrike = allStrikes.reduce((best, s) =>
      Math.abs(s - currentPrice) < Math.abs(best - currentPrice) ? s : best,
      allStrikes[0],
    )

    const atmCall = calls.find(c => c.strike === atmStrike)
    const atmPut  = puts.find(p  => p.strike === atmStrike)

    const callIV = atmCall?.impliedVolatility ?? null
    const putIV  = atmPut?.impliedVolatility  ?? null

    if (callIV == null && putIV == null) return null
    const iv = callIV != null && putIV != null
      ? (callIV + putIV) / 2
      : (callIV ?? putIV!)

    // Clamp to sane range — Yahoo occasionally returns 0.0001 (de-listed) or >5.0 (data error)
    if (iv < 0.05 || iv > 5.0) return null
    return Math.round(iv * 100)
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Update `processTicker()` to call `fetchYahooATMIV` in parallel with OHLCV**

Find this block in `processTicker()` (around line 405):

```typescript
    const [ohlcv, earningsDate] = await Promise.all([
      fetchOHLCV(ticker, polygonKey),
      finnhubKey ? fetchEarningsDate(ticker, finnhubKey) : Promise.resolve(null),
    ])
```

Replace with:

```typescript
    const [ohlcv, earningsDate, yahooIV] = await Promise.all([
      fetchOHLCV(ticker, polygonKey),
      finnhubKey ? fetchEarningsDate(ticker, finnhubKey) : Promise.resolve(null),
      fetchYahooATMIV(ticker, 0), // price unknown until OHLCV resolves; fetched with placeholder, updated below
    ])
    const { closes, timestamps, lastClose, prevClose, lastVolume } = ohlcv
```

Wait — `fetchYahooATMIV` needs `currentPrice` to find the ATM strike. We can't run it in parallel with `fetchOHLCV` since we need the price first. Run it sequentially after OHLCV instead:

Replace that block with:

```typescript
    const [ohlcv, earningsDate] = await Promise.all([
      fetchOHLCV(ticker, polygonKey),
      finnhubKey ? fetchEarningsDate(ticker, finnhubKey) : Promise.resolve(null),
    ])
    const { closes, timestamps, lastClose, prevClose, lastVolume } = ohlcv

    // Yahoo IV uses current price from OHLCV to identify ATM strike — run after OHLCV
    const yahooIV = await fetchYahooATMIV(ticker, lastClose ?? 0)
```

- [ ] **Step 3: Update the `iv_hv_ratio` computation and add `current_iv` to the return value**

Find this block in `processTicker()`:

```typescript
    const ivData = computeIVRank(closes, timestamps)
    const priceChangePct =
```

Replace with:

```typescript
    const ivData = computeIVRank(closes, timestamps)

    // Real IV/HV ratio: how much the market is paying above realized vol.
    // >1.0 = options rich (good for sellers). Replaces the old HV30/HV60 momentum proxy.
    const realIvHvRatio = yahooIV != null && ivData.current_hv != null && ivData.current_hv > 0
      ? parseFloat((yahooIV / ivData.current_hv).toFixed(2))
      : ivData.iv_hv_ratio  // fall back to HV30/HV60 if Yahoo failed

    const priceChangePct =
```

- [ ] **Step 4: Update the return statement in `processTicker()` to include `current_iv` and the corrected `iv_hv_ratio`**

Find the return object inside `processTicker()`:

```typescript
    return {
      ...base, ...ivData,
      current_price: lastClose,
      prev_close: prevClose,
      price_change_pct: priceChangePct,
      volume: lastVolume ? Math.round(lastVolume) : null,
      earnings_date: earningsDate,
      put_call_skew: optionsData.put_call_skew,
      atm_open_interest: optionsData.atm_open_interest,
      calculation_success: true,
    }
```

Replace with:

```typescript
    return {
      ...base, ...ivData,
      current_iv: yahooIV,           // real ATM IV in integer % (null if Yahoo unavailable)
      iv_hv_ratio: realIvHvRatio,    // real IV/HV ratio when Yahoo available
      current_price: lastClose,
      prev_close: prevClose,
      price_change_pct: priceChangePct,
      volume: lastVolume ? Math.round(lastVolume) : null,
      earnings_date: earningsDate,
      put_call_skew: optionsData.put_call_skew,
      atm_open_interest: optionsData.atm_open_interest,
      calculation_success: true,
    }
```

- [ ] **Step 5: Add `current_iv` to the `IVSnapshot` interface at the top of the file (around line 92)**

Find:

```typescript
  data_source: string
  calculation_success: boolean
  error_message: string | null
```

Insert before `data_source`:

```typescript
  current_iv: number | null     // real ATM IV from Yahoo Finance in integer %; null if unavailable
```

- [ ] **Step 6: Update the console log in `processTicker` to show Yahoo IV**

Find:

```typescript
          console.log(`  ✓ ${ticker}: IV Rank ${result.value.iv_rank}, HV30 ${result.value.current_hv}%${skewStr}${oiStr}`)
```

Replace with:

```typescript
          const ivStr = result.value.current_iv != null ? ` IV ${result.value.current_iv}%` : ''
          console.log(`  ✓ ${ticker}: IV Rank ${result.value.iv_rank}, HV30 ${result.value.current_hv}%${ivStr}${skewStr}${oiStr}`)
```

- [ ] **Step 7: Deploy the updated edge function**

```bash
npx supabase functions deploy calculate-iv-rank --project-ref jzxdxcchmuyqbaccfpok
```

Expected: `Deployed Functions on project jzxdxcchmuyqbaccfpok: calculate-iv-rank`

- [ ] **Step 8: Smoke-test by triggering one batch manually**

The edge function auth requires the CRON_SECRET. Check it:

```bash
npx supabase secrets list --project-ref jzxdxcchmuyqbaccfpok | grep CRON_SECRET
```

Then trigger batch 0 (GME + MARA):

```bash
curl -s -X POST \
  https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/calculate-iv-rank \
  -H "Authorization: Bearer $(npx supabase secrets list --project-ref jzxdxcchmuyqbaccfpok | grep '^CRON_SECRET' | awk '{print $2}')" \
  -H "Content-Type: application/json" \
  -d '{"batchIndex": 0}' | jq .
```

Expected output includes `"stocks_succeeded": 2` and no errors. Then verify the DB:

```bash
npx supabase db query "SELECT ticker, current_hv, current_iv, iv_hv_ratio, snapshot_date FROM iv_snapshots WHERE ticker IN ('GME','MARA') ORDER BY snapshot_date DESC LIMIT 2;" --project-ref jzxdxcchmuyqbaccfpok
```

Expected: `current_iv` is a non-null integer (e.g. 145 for MARA), `iv_hv_ratio` reflects real IV/HV.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/calculate-iv-rank/index.ts
git commit -m "feat: add Yahoo Finance ATM IV to iv-rank cron; update iv_hv_ratio to real IV/HV"
```

---

## Task 3: Update usePortfolioGreeks to Use Real IV

**Files:**
- Modify: `src/lib/blackScholes.ts:250`
- Modify: `src/hooks/usePortfolioGreeks.ts`

Context: `usePortfolioGreeks` currently reads `current_hv` from `iv_snapshots` and passes it as `impliedVolatility` to `calculatePositionGreeks`. We now read `current_iv` and prefer it; `current_hv` stays as fallback. The `ivSource` discriminant union needs `'yahoo_snapshot'` added so consumers can tell which source was used.

- [ ] **Step 1: Add `'yahoo_snapshot'` to the `ivSource` union in `src/lib/blackScholes.ts`**

Find (line ~250):

```typescript
  ivSource: 'polygon_live' | 'supabase_cache' | 'estimated'
```

Replace with:

```typescript
  ivSource: 'polygon_live' | 'yahoo_snapshot' | 'supabase_cache' | 'estimated'
```

- [ ] **Step 2: Update the `iv_snapshots` select query in `usePortfolioGreeks.ts`**

Find (around line 54):

```typescript
        .select('ticker, current_hv, hv_30, current_price, iv_rank, iv_hv_ratio, earnings_date')
```

Replace with:

```typescript
        .select('ticker, current_iv, current_hv, hv_30, current_price, iv_rank, iv_hv_ratio, earnings_date')
```

- [ ] **Step 3: Update the `ivMap` type annotation to include `current_iv`**

Find (around line 81):

```typescript
  const ivMap = useMemo(
    () => new Map((ivData ?? []).map((d: { ticker: string; current_hv: number | null; hv_30: number | null; current_price: number | null; iv_rank: number | null; iv_hv_ratio: number | null; earnings_date: string | null }) => [d.ticker, d])),
    [ivData],
  )
```

Replace with:

```typescript
  const ivMap = useMemo(
    () => new Map((ivData ?? []).map((d: { ticker: string; current_iv: number | null; current_hv: number | null; hv_30: number | null; current_price: number | null; iv_rank: number | null; iv_hv_ratio: number | null; earnings_date: string | null }) => [d.ticker, d])),
    [ivData],
  )
```

- [ ] **Step 4: Update the IV resolution logic inside `greeksQuery.queryFn`**

Find (around line 108):

```typescript
        const hv30Raw = iv?.current_hv ?? iv?.hv_30
        const impliedVolatility = hv30Raw != null && Number(hv30Raw) > 0
          ? Number(hv30Raw) / 100
          : estimateVolatility(pos.ticker)

        const ivSource: PositionGreeks['ivSource'] =
          hv30Raw ? 'supabase_cache'
          : 'estimated'
```

Replace with:

```typescript
        // Prefer real Yahoo IV; fall back to HV30; fall back to per-ticker estimate
        const yahooIVRaw = iv?.current_iv
        const hv30Raw    = iv?.current_hv ?? iv?.hv_30
        const impliedVolatility =
          yahooIVRaw != null && Number(yahooIVRaw) > 0
            ? Number(yahooIVRaw) / 100
            : hv30Raw != null && Number(hv30Raw) > 0
              ? Number(hv30Raw) / 100
              : estimateVolatility(pos.ticker)

        const ivSource: PositionGreeks['ivSource'] =
          yahooIVRaw != null && Number(yahooIVRaw) > 0 ? 'yahoo_snapshot'
          : hv30Raw ? 'supabase_cache'
          : 'estimated'
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/bran/Documents/Repositories/premiumhunter-react && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors related to `ivSource` or `current_iv`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/blackScholes.ts src/hooks/usePortfolioGreeks.ts
git commit -m "feat: use real Yahoo IV in portfolio Greeks; add yahoo_snapshot ivSource"
```

---

## Task 4: Create fetch-option-prices Edge Function

**Files:**
- Create: `supabase/functions/fetch-option-prices/index.ts`

Context: This is a cron-only edge function. It queries `wheel_positions` and `paper_positions` for all open positions across all users (via service role), groups by `(ticker, expiry)`, makes one Yahoo Finance call per group, extracts bid/ask/IV for each matching contract, and upserts into `option_price_snapshots`. It adds a 600ms delay between Yahoo calls to avoid rate-limiting. Auth is the cron secret stored in `OPTION_PRICES_CRON_SECRET`.

- [ ] **Step 1: Create the function file**

```typescript
// supabase/functions/fetch-option-prices/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET      = Deno.env.get('OPTION_PRICES_CRON_SECRET') ?? ''

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

type OptionContract = {
  strike: number
  impliedVolatility?: number
  bid?: number
  ask?: number
  lastPrice?: number
  volume?: number
  openInterest?: number
}

type YahooOptionSet = {
  expirationDate: number
  calls: OptionContract[]
  puts: OptionContract[]
}

async function fetchYahooChain(
  ticker: string,
  expiryUnix: number,
): Promise<YahooOptionSet | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?date=${expiryUnix}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PremiumHunter/1.0)',
          'Accept': 'application/json',
        },
      },
    )
    clearTimeout(timer)
    if (!res.ok) {
      console.warn(`  Yahoo ${ticker} (${expiryUnix}): HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const options: YahooOptionSet[] = data?.optionChain?.result?.[0]?.options ?? []
    // Yahoo returns the chain for the nearest expiry to the requested date
    return options[0] ?? null
  } catch (err) {
    console.warn(`  Yahoo ${ticker} fetch failed:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (CRON_SECRET === '' || token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = new Date().toISOString().split('T')[0]
  const startTime = Date.now()

  // Fetch open positions from both real and paper tables
  const [realResult, paperResult] = await Promise.all([
    supabase
      .from('wheel_positions')
      .select('ticker, strategy, strike, expiry')
      .eq('status', 'open'),
    supabase
      .from('paper_positions')
      .select('ticker, strategy, strike, expiry')
      .eq('status', 'open'),
  ])

  if (realResult.error) {
    console.error('wheel_positions query failed:', realResult.error)
    return new Response(JSON.stringify({ error: 'DB query failed' }), { status: 500 })
  }

  type PosRow = { ticker: string; strategy: string; strike: number; expiry: string }
  const allPositions: PosRow[] = [
    ...(realResult.data ?? []),
    ...(paperResult.data ?? []),
  ]

  if (allPositions.length === 0) {
    return new Response(JSON.stringify({ message: 'No open positions', duration_seconds: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Deduplicate: group unique (ticker, expiry) pairs
  // For each group collect which (strike, contract_type) we need
  type ContractNeed = { strike: number; contract_type: 'call' | 'put' }
  const groups = new Map<string, { ticker: string; expiry: string; expiryUnix: number; contracts: ContractNeed[] }>()

  for (const pos of allPositions) {
    const contract_type: 'call' | 'put' = pos.strategy === 'CC' ? 'call' : 'put'
    const key = `${pos.ticker}:${pos.expiry}`
    if (!groups.has(key)) {
      // Convert YYYY-MM-DD to Unix timestamp (noon UTC to avoid DST edge cases)
      const expiryUnix = Math.floor(new Date(pos.expiry + 'T12:00:00Z').getTime() / 1000)
      groups.set(key, { ticker: pos.ticker, expiry: pos.expiry, expiryUnix, contracts: [] })
    }
    const group = groups.get(key)!
    const alreadyHave = group.contracts.some(
      c => c.strike === pos.strike && c.contract_type === contract_type,
    )
    if (!alreadyHave) {
      group.contracts.push({ strike: pos.strike, contract_type })
    }
  }

  const snapshots: object[] = []
  let fetched = 0
  let failed = 0

  for (const [, group] of groups) {
    console.log(`Fetching ${group.ticker} expiry ${group.expiry} (${group.contracts.length} contracts)`)
    const chain = await fetchYahooChain(group.ticker, group.expiryUnix)

    if (!chain) {
      failed++
      // Add delay even on failure to avoid hammering Yahoo
      await delay(600)
      continue
    }

    for (const { strike, contract_type } of group.contracts) {
      const side: OptionContract[] = contract_type === 'call' ? chain.calls : chain.puts
      // Yahoo uses exact strike values; find the closest match within $0.50 tolerance
      const contract = side.find(c => Math.abs(c.strike - strike) < 0.50)

      if (!contract) {
        console.warn(`  No contract found: ${group.ticker} ${contract_type} $${strike} exp ${group.expiry}`)
        continue
      }

      const bid = contract.bid ?? null
      const ask = contract.ask ?? null
      const mid = bid != null && ask != null
        ? Math.round(((bid + ask) / 2) * 100) / 100
        : contract.lastPrice ?? null
      const iv = contract.impliedVolatility != null
        ? Math.round(contract.impliedVolatility * 100)  // decimal → integer %
        : null

      // Guard: skip if IV is clearly bad data
      const ivClean = iv != null && iv >= 5 && iv <= 500 ? iv : null

      snapshots.push({
        ticker:             group.ticker,
        strike,
        expiry:             group.expiry,
        contract_type,
        snapshot_date:      today,
        snapshot_time:      new Date().toISOString(),
        bid,
        ask,
        mid,
        last_price:         contract.lastPrice ?? null,
        implied_volatility: ivClean,
        volume:             contract.volume ?? null,
        open_interest:      contract.openInterest ?? null,
      })
      fetched++
    }

    await delay(600) // ~1.5 req/sec — respectful to Yahoo's unofficial endpoint
  }

  if (snapshots.length > 0) {
    const { error: upsertError } = await supabase
      .from('option_price_snapshots')
      .upsert(snapshots, { onConflict: 'ticker,strike,expiry,contract_type,snapshot_date', ignoreDuplicates: false })

    if (upsertError) {
      console.error('Upsert failed:', upsertError)
      return new Response(JSON.stringify({ error: 'DB upsert failed', details: upsertError }), { status: 500 })
    }
  }

  const duration = (Date.now() - startTime) / 1000
  console.log(`Done in ${duration.toFixed(1)}s — ${fetched} contracts fetched, ${failed} groups failed`)

  return new Response(
    JSON.stringify({
      success: true,
      duration_seconds: duration,
      contracts_fetched: fetched,
      groups_failed: failed,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
```

- [ ] **Step 2: Set the cron secret for this function**

Generate a secret:
```bash
openssl rand -hex 32
```

Copy the output (e.g. `a3f9...`). Set it:

```bash
npx supabase secrets set OPTION_PRICES_CRON_SECRET=<paste-output-here> --project-ref jzxdxcchmuyqbaccfpok
```

Note the value — you'll need it for the pg_cron job in Task 5.

- [ ] **Step 3: Deploy the function**

```bash
npx supabase functions deploy fetch-option-prices --project-ref jzxdxcchmuyqbaccfpok
```

Expected: `Deployed Functions on project jzxdxcchmuyqbaccfpok: fetch-option-prices`

- [ ] **Step 4: Smoke-test manually**

```bash
curl -s -X POST \
  https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-option-prices \
  -H "Authorization: Bearer <OPTION_PRICES_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

Expected response example:
```json
{ "success": true, "duration_seconds": 12.3, "contracts_fetched": 8, "groups_failed": 0 }
```

Then verify DB:

```bash
npx supabase db query "SELECT ticker, strike, expiry, contract_type, bid, ask, mid, implied_volatility FROM option_price_snapshots WHERE snapshot_date = CURRENT_DATE LIMIT 10;" --project-ref jzxdxcchmuyqbaccfpok
```

Expected: rows with real bid/ask values, `mid = (bid+ask)/2`, `implied_volatility` in integer %.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/fetch-option-prices/index.ts
git commit -m "feat: add fetch-option-prices edge function for contract-level bid/ask from Yahoo Finance"
```

---

## Task 5: Configure 20-Minute Cron for fetch-option-prices

**Files:**
- Modify: Supabase database (pg_cron configuration via SQL)

Context: The cron runs every 20 minutes during market hours Mon–Fri. `*/20 13-21 * * 1-5` covers 13:00–21:59 UTC which is 9am–5:59pm ET in EDT (summer) and 8am–4:59pm ET in EST (winter) — slightly wider than market hours, which is acceptable. The OPTION_PRICES_CRON_SECRET must match what was set in Task 4.

- [ ] **Step 1: Create the cron job**

Run this SQL (replace `<OPTION_PRICES_CRON_SECRET>` with the actual secret from Task 4):

```bash
npx supabase db query "
SELECT cron.schedule(
  'fetch-option-prices',
  '*/20 13-21 * * 1-5',
  \$\$
  SELECT net.http_post(
    url     := 'https://jzxdxcchmuyqbaccfpok.supabase.co/functions/v1/fetch-option-prices',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <OPTION_PRICES_CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  \$\$
);
" --project-ref jzxdxcchmuyqbaccfpok
```

- [ ] **Step 2: Verify the cron job is registered**

```bash
npx supabase db query "SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'fetch-option-prices';" --project-ref jzxdxcchmuyqbaccfpok
```

Expected: one row with `active = true`.

- [ ] **Step 3: Commit** (no code change — just confirming the infrastructure is set)

```bash
git commit --allow-empty -m "chore: register fetch-option-prices pg_cron job (20-min market hours)"
```

---

## Task 6: Update usePositions to Use Snapshot Pricing for Open Positions

**Files:**
- Modify: `src/types/index.ts:24-37`
- Modify: `src/hooks/usePositions.ts`

Context: `usePositions` fetches all wheel positions. For open positions, `currentPrice` is currently a 60% rough estimate of the premium. We now enrich it with the actual mid price from `option_price_snapshots`. We also surface `optionBid` and `optionAsk` on the position so the close modal can show them. The snapshot lookup is a secondary query, so if it fails, positions still load with the 60% fallback.

- [ ] **Step 1: Add optional bid/ask fields to `WheelPosition` in `src/types/index.ts`**

Find:

```typescript
export interface WheelPosition {
  id: string;
  ticker: string;
  strategy: WheelStrategy;
  strike: number;
  expiry: string;
  premiumCollected: number;
  currentPrice: number; // current option price (or closing price when closed)
  daysToExpiry: number;
  status: PositionStatus;
  openedAt: string;
  closedAt?: string;
  contracts: number;
}
```

Replace with:

```typescript
export interface WheelPosition {
  id: string;
  ticker: string;
  strategy: WheelStrategy;
  strike: number;
  expiry: string;
  premiumCollected: number;
  currentPrice: number;    // option mid from snapshot when available; 60% estimate otherwise
  optionBid?: number | null;
  optionAsk?: number | null;
  daysToExpiry: number;
  status: PositionStatus;
  openedAt: string;
  closedAt?: string;
  contracts: number;
}
```

- [ ] **Step 2: Add a snapshot enrichment step in `usePositions` after positions are fetched**

In `src/hooks/usePositions.ts`, find the `queryFn` of the main positions query (around line 74). After the positions are fetched and mapped via `dbToPosition`, add this enrichment block:

Find the queryFn return (currently something like):
```typescript
      if (error) throw error;
      return (data ?? []).map(dbToPosition)
```

Replace with:

```typescript
      if (error) throw error;
      const positions = (data ?? []).map(dbToPosition)

      // Enrich open positions with real bid/ask from option_price_snapshots
      const openPositions = positions.filter(p => p.status === 'open')
      if (openPositions.length > 0) {
        const tickers = [...new Set(openPositions.map(p => p.ticker))]
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
        const { data: snapshots } = await supabase
          .from('option_price_snapshots')
          .select('ticker, strike, expiry, contract_type, mid, bid, ask')
          .in('ticker', tickers)
          .gte('snapshot_date', yesterday)
          .order('snapshot_time', { ascending: false })

        // Build map keyed by "ticker:expiry:strike:contract_type" — take most recent per key
        const snapMap = new Map<string, { mid: number | null; bid: number | null; ask: number | null }>()
        for (const s of snapshots ?? []) {
          const key = `${s.ticker}:${s.expiry}:${s.strike}:${s.contract_type}`
          if (!snapMap.has(key)) snapMap.set(key, { mid: s.mid, bid: s.bid, ask: s.ask })
        }

        for (const pos of positions) {
          if (pos.status !== 'open') continue
          const contract_type = pos.strategy === 'CC' ? 'call' : 'put'
          const key = `${pos.ticker}:${pos.expiry}:${pos.strike}:${contract_type}`
          const snap = snapMap.get(key)
          if (snap) {
            if (snap.mid != null) pos.currentPrice = snap.mid
            pos.optionBid = snap.bid ?? null
            pos.optionAsk = snap.ask ?? null
          }
        }
      }

      return positions
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/bran/Documents/Repositories/premiumhunter-react && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `optionBid`, `optionAsk`, or `currentPrice`.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/usePositions.ts
git commit -m "feat: enrich open positions with bid/ask mid from option_price_snapshots"
```

---

## Task 7: Show Bid/Ask in ClosePositionModal

**Files:**
- Modify: `src/pages/WheelTracker.tsx:540-740`

Context: The `ClosePositionModal` component already has a "Closing Price" input. When a snapshot exists, we pre-fill the input with the bid/ask midpoint and show a "Market: Bid $X.XX / Ask $X.XX" hint below the label. The user can override the pre-fill with their actual fill price. The initial state uses the snapshot mid when available so the user sees a real number immediately rather than a blank field.

- [ ] **Step 1: Update `ClosePositionModal` initial `closingPrice` state to use snapshot mid**

Find (around line 547):

```typescript
  const [closingPrice, setClosingPrice] = useState('');
```

Replace with:

```typescript
  const snapshotMid = position.optionBid != null && position.optionAsk != null
    ? ((position.optionBid + position.optionAsk) / 2).toFixed(2)
    : null
  const [closingPrice, setClosingPrice] = useState(snapshotMid ?? '');
```

- [ ] **Step 2: Add the Bid/Ask hint below the "Closing Price" label**

Find (around line 678):

```typescript
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Closing Price <span style={{ color: '#6a8fb0' }}>(buy-back price per share)</span>
        </label>
        <div className="relative">
```

Replace the label with:

```tsx
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Closing Price <span style={{ color: '#6a8fb0' }}>(buy-back price per share)</span>
        </label>
        {position.optionBid != null && position.optionAsk != null && (
          <p className="text-xs mb-2" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
            Market (end of day):{' '}
            <span style={{ color: '#ff8fa3', fontFamily: 'JetBrains Mono, monospace' }}>
              Bid ${position.optionBid.toFixed(2)}
            </span>
            {' / '}
            <span style={{ color: '#ff8fa3', fontFamily: 'JetBrains Mono, monospace' }}>
              Ask ${position.optionAsk.toFixed(2)}
            </span>
            {snapshotMid && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={() => setClosingPrice(snapshotMid)}
                  style={{ color: '#00e5c4', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif' }}
                >
                  use mid ${snapshotMid}
                </button>
              </>
            )}
          </p>
        )}
        <div className="relative">
```

- [ ] **Step 3: Verify TypeScript compiles and the modal renders**

```bash
cd /Users/bran/Documents/Repositories/premiumhunter-react && npx tsc --noEmit 2>&1 | head -20
```

Start the dev server and open an open position in WheelTracker. Click "Close". Verify:
- If a snapshot exists for this contract: closing price input is pre-filled with mid, Bid/Ask hint is visible
- If no snapshot: closing price input is blank (same as before), no hint shown
- "use mid" button updates the input to the mid value

```bash
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/WheelTracker.tsx
git commit -m "feat: pre-fill close modal with bid/ask mid from Yahoo Finance snapshot"
```

---

## Self-Review

**Spec coverage check:**
- Real IV for 488 screener tickers ✅ Task 2 (Yahoo ATM IV in calculate-iv-rank)
- IV flows into Black-Scholes Greeks ✅ Task 3 (usePortfolioGreeks reads current_iv)
- IV flows into dashboard/portfolio/screener ✅ All existing consumers of `iv_rank`, `iv_hv_ratio` automatically get better data — no additional changes needed since they read from `iv_snapshots`
- Bid/ask for open positions ✅ Task 4 (fetch-option-prices), Task 6 (usePositions enrichment)
- Bid/ask in close modal ✅ Task 7
- 20-min cron during market hours ✅ Task 5
- Fallback to Black-Scholes when no snapshot ✅ usePositions keeps 60% estimate when no snapshot; usePortfolioGreeks falls back to HV then estimate

**Placeholder scan:** None found.

**Type consistency:**
- `current_iv` is `number | null` throughout (DB, IVSnapshot interface, select query, map type)
- `optionBid` / `optionAsk` are `number | null | undefined` — optional on `WheelPosition`, populated from snapshot or left undefined
- `contract_type` is `'call' | 'put'` in both the DB check constraint and all TypeScript usages
- `ivSource` union extended consistently in blackScholes.ts and used in usePortfolioGreeks.ts
