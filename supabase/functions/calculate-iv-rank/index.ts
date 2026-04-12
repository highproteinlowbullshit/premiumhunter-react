// supabase/functions/calculate-iv-rank/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Stock list — must stay in sync with src/lib/stockList.ts ──────────────
// 98 batches of 5 — all processed nightly via 98 separate pg_cron invocations
// (one per minute, 11:00 PM – 12:37 AM UTC). Each invocation gets batchIndex 0–97.
// Polygon free plan (5 req/min): each batch is one burst with no delay needed.
const STOCK_TICKERS = [
  // Meme / momentum (batches 0–3)
  'GME','MARA','SOFI','RIVN','COIN','HOOD','AMC','PLTR','RBLX','SNAP',
  'UBER','LYFT','IONQ','SMCI','NVAX','TLRY','RIOT','CLSK','MSTR','WULF',
  // Growth tech (batches 4–7)
  'TSLA','NVDA','AMD','META','NFLX','SHOP','SQ','ROKU','NET','DDOG',
  'CRWD','SNOW','ZM','DOCN','MDB','BILL','AFRM','UPST','OPEN','ABNB',
  // Large-cap blue chip (batches 8–10)
  'AAPL','MSFT','GOOGL','AMZN','JPM','BAC','GS','XOM','CVX','DIS',
  'NKE','BA','F','GM','PFE',
  // Core ETFs (batches 11–12)
  'SPY','QQQ','IWM','GLD','SLV','TLT','XLE','XLF','ARKK','SOXL',
  // Speculative / AI / quantum (batches 13–14)
  'LCID','NKLA','CLOV','BBAI','SOUN','AISP','RGTI','QBTS','KULR','HIMS',
  // Additional ETFs (batches 15–25)
  'TQQQ','SQQQ','SPXL','SPXS','UVXY','VXX','SMH','SOXX','XLK','XLV',
  'XLI','XLB','XLU','XLRE','XLC','XLY','XLP','GDX','GDXJ','USO',
  'XOP','IBIT','EEM','EFA','VTI','VOO','KWEB','FXI','BITO','JETS',
  'ARKW','ARKG','BOIL','LABU','LABD','FNGU','FNGD','HYG','LQD','IAU',
  'DIA','VIXY','SOXS','TECL','TECS','CURE','DPST','NAIL','MSOS','BOTZ',
  'ARKF',
  // Mega-cap tech (batches 25–38)
  'GOOG','ORCL','CRM','ADBE','INTC','QCOM','AVGO','CSCO','TXN','MU',
  'ARM','MRVL','ON','KLAC','LRCX','AMAT','ASML','TSM','NOW','WDAY',
  'PANW','ZS','FTNT','OKTA','TEAM','HUBS','VEEV','GTLB','CFLT','MNDY',
  'APP','DUOL','TTD','ACN','IBM','DELL','HPQ','HPE','CDNS','SNPS',
  'ANSS','MANH','EPAM','CELH','RBRK','CWAN','MGNI','MQ','SMAR','ESTC',
  'SWKS','QRVO','MPWR','ONTO','FORM','ENTG','WOLF','AXON','KTOS','PSTG',
  'STX','KEYS','AEHR','ACMR','NOVA',
  // Financials (batches 38–48)
  'V','MA','AXP','COF','SYF','DFS','MS','C','WFC','SCHW',
  'BLK','AIG','MET','PRU','AFL','ALL','PGR','TRV','CB','MMC',
  'AON','USB','PNC','TFC','KEY','RF','CFG','HBAN','FITB','ALLY',
  'ICE','CME','CBOE','SPGI','MCO','LC','RJF','LNC','VOYA','EQH',
  'FNF','ACGL','PYPL','NU','MELI','OPFI','IBKR','NDAQ','HIG','WEX',
  // Healthcare & Biotech (batches 48–57)
  'UNH','JNJ','LLY','ABBV','MRK','BMY','AMGN','GILD','BIIB','REGN',
  'MRNA','VRTX','CVS','CI','HUM','MDT','BSX','EW','ISRG','SYK',
  'ZBH','DXCM','PODD','HOLX','ALGN','IRTC','RMD','BDX','BAX','INCY',
  'EXEL','JAZZ','ALNY','RARE','BMRN','ACAD','ARWR','TMO','DHR','ABT',
  'ILMN','CRSP','EDIT','AXSM','NUVL','RXRX','VCEL','PTGX','GEHC','GKOS',
  // Consumer / Retail / Restaurants (batches 58–66)
  'WMT','COST','TGT','HD','LOW','SBUX','MCD','CMG','YUM','DPZ',
  'LULU','ULTA','EL','TJX','ROST','BURL','ANF','AEO','PEP','KO',
  'MDLZ','HSY','GIS','TSN','ETSY','W','CHWY','EBAY','DASH','WING',
  'DRI','TXRH','SHAK','BROS','CAVA','PTON','BYND','DKNG','PENN','CZR',
  'STZ','MNST','TAP','SE',
  // Energy (batches 67–72)
  'COP','EOG','SLB','HAL','MPC','VLO','PSX','OXY','DVN','HES',
  'MRO','BKR','FANG','CTRA','SM','MTDR','ENPH','SEDG','RUN','PLUG',
  'FCEL','CHPT','BLNK','FSLR','BE','WMB','KMI','OKE','LNG','VALE',
  // Utilities (batches 73–74)
  'NEE','DUK','SO','D','EXC','AEP','PCG','ED','ETR','PEG',
  // Industrials (batches 75–81)
  'GE','HON','MMM','ETN','EMR','ROK','PH','ITW','DOV','IR',
  'TT','JCI','AME','ROP','CARR','OTIS','CAT','DE','PCAR','CMI',
  'LMT','NOC','GD','RTX','LDOS','BAH','UPS','FDX','CHRW','XPO',
  'SAIA','ODFL','JBHT','WM','RSG',
  // Materials (batches 82–84)
  'FCX','NEM','GOLD','AA','MP','X','CLF','STLD','NUE','CE',
  'DOW','LYB','PPG','SHW','ALB',
  // Real Estate (batches 85–86)
  'AMT','PLD','EQIX','SPG','O','VICI','WPC','CBRE','WELL','IRM',
  // Telecom & Media (batches 87–89)
  'TMUS','VZ','T','CMCSA','WBD','SPOT','TTWO','EA','PARA','FOXA',
  'NYT','IAC','RDDT','PINS','SIRI',
  // Telecom/Media, Automotive, International ADRs (batches 90–95)
  'LYV','BILI','TME','TM','STLA','LEA','BWA','APTV','BABA','JD',
  'PDD','BIDU','FUTU','NIO','XPEV','LI','SAP','RIO','BHP','ITUB',
  'BBD','GRAB','SONY','UBS','TD','RY','WIT','SAN','CPRT','KMX',
  // Misc / additional (batches 96–97)
  'CINF','WRB','ERIE','RLI','ALGM','LSCC','MTSI','CRUS',
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
  prev_close: number | null
  price_change_pct: number | null
  volume: number | null
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
): Promise<{
  closes: number[]
  timestamps: number[]
  lastClose: number | null
  prevClose: number | null
  lastVolume: number | null
}> {
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
  const results: Array<{ c: number; t: number; v: number }> = json.results ?? []

  if (results.length < 83) {
    throw new Error(`Insufficient data for ${ticker}: only ${results.length} bars`)
  }

  const closes = results.map(r => r.c)
  const timestamps = results.map(r => r.t)
  const lastClose = closes[closes.length - 1] ?? null
  const prevClose = closes[closes.length - 2] ?? null
  const lastVolume = results[results.length - 1]?.v ?? null
  return { closes, timestamps, lastClose, prevClose, lastVolume }
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
    current_price: null, prev_close: null,
    price_change_pct: null, volume: null,
    data_source: 'edge_function',
    calculation_success: false,
    error_message: null,
  }

  try {
    const { closes, timestamps, lastClose, prevClose, lastVolume } = await fetchOHLCV(ticker, polygonKey)
    const ivData = computeIVRank(closes, timestamps)
    const priceChangePct =
      prevClose && prevClose > 0 && lastClose
        ? parseFloat((((lastClose - prevClose) / prevClose) * 100).toFixed(4))
        : null
    return {
      ...base, ...ivData,
      current_price: lastClose,
      prev_close: prevClose,
      price_change_pct: priceChangePct,
      volume: lastVolume ? Math.round(lastVolume) : null,
      calculation_success: true,
    }
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!polygonKey || !supabaseUrl || serviceRoleKey === '') {
    return new Response(
      JSON.stringify({ error: 'Missing env vars: POLYGON_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const today = new Date().toISOString().split('T')[0]
  const startTime = Date.now()

  // batchIndex (0–14) selects which 5 tickers to process this invocation.
  // Each pg_cron entry passes its own batchIndex; curl tests can pass any value.
  let batchIndex = 0
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.batchIndex === 'number' && body.batchIndex >= 0 && body.batchIndex <= 97) {
      batchIndex = body.batchIndex
    }
  } catch { /* no body — default to 0 */ }
  const tickers = STOCK_TICKERS.slice(batchIndex * 5, batchIndex * 5 + 5)

  console.log(`IV rank — batch ${batchIndex}/97 (${tickers.join(', ')}) — ${new Date().toISOString()}`)

  const results: IVSnapshot[] = []
  const errors: string[] = []
  // 5 tickers per invocation = one Polygon burst, no delay needed
  const BATCH_SIZE = 5
  const BATCH_DELAY_MS = 0
  const totalBatches = 1

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
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

    if (i + BATCH_SIZE < tickers.length) {
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
      stocks_processed: tickers.length,
      stocks_succeeded: successCount,
      stocks_failed: results.length - successCount,
      errors: errors.length > 0 ? errors : null,
    })
    if (logError) console.warn('cron_run_logs write failed:', logError)
  } catch (err) {
    console.warn('cron_run_logs write threw:', err)
  }

  console.log(`Done in ${durationSeconds.toFixed(1)}s — ${successCount}/${tickers.length} succeeded`)

  return new Response(
    JSON.stringify({
      success: true,
      duration_seconds: durationSeconds,
      stocks_processed: tickers.length,
      stocks_succeeded: successCount,
      stocks_failed: results.length - successCount,
      errors: errors.length > 0 ? errors : null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
