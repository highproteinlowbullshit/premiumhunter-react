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
  'AISP','RGTI','QBTS','KULR','HIMS',
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

async function fetchWithRetry(url: string, headers: Record<string, string> = {}, maxRetries = 3, timeoutMs = 15000): Promise<Response> {
  let lastError: Error = new Error('Unknown error')
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      const response = await fetch(url, { signal: controller.signal, headers })
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
    `?adjusted=true&sort=asc&limit=500`

  const res = await fetchWithRetry(url, { Authorization: `Bearer ${polygonKey}` })
  if (!res.ok) throw new Error(`Polygon ${ticker}: HTTP ${res.status}`)

  const json = await res.json()
  const results: Array<{ c: number; t: number }> = json.results ?? []

  if (results.length < 83) {
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

  // Guard: should not happen after 83-bar minimum, but protects DB from sentinel values
  if (hvSeries.length === 0) {
    return { iv_rank: 50, iv_percentile: 50, current_hv: 0, hv_30: 0, hv_52wk_high: 0, hv_52wk_low: 0, iv_hv_ratio: 1.0, weekly_history: [] }
  }

  const currentHV = hvSeries[hvSeries.length - 1] ?? 0
  const hv52wkHigh = hvSeries.reduce((a, b) => Math.max(a, b), -Infinity)
  const hv52wkLow = hvSeries.reduce((a, b) => Math.min(a, b), Infinity)

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
    const i = totalPoints === 1 ? 0 : Math.round(p * (hvSeries.length - 1) / (totalPoints - 1))
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
  // Auth: Bearer token must match CRON_SECRET (a plain string, not a JWT)
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (cronSecret === '' || token !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const polygonKey = Deno.env.get('POLYGON_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')

  if (!polygonKey || !supabaseUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing env vars: POLYGON_API_KEY or SUPABASE_URL' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)
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

  // Awaited run log (non-fatal if it fails)
  try {
    const { error: logError } = await supabase.from('cron_run_logs').insert({
      function_name: 'calculate-iv-rank',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      stocks_processed: STOCK_TICKERS.length,
      stocks_succeeded: successCount,
      stocks_failed: results.length - successCount,
      errors: errors.length > 0 ? errors : null,
    })
    if (logError) console.warn('cron_run_logs write failed:', logError)
  } catch (err) {
    console.warn('cron_run_logs write threw:', err)
  }

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
