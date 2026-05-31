// supabase/functions/fetch-yahoo-iv/index.ts
// Yahoo-only IV pass — runs ~1hr after calculate-iv-rank finishes (04:00–08:03 UTC).
// Reads current_price from the existing iv_snapshots row (written by Polygon cron),
// fetches real ATM IV from Yahoo Finance, and updates current_iv + iv_rank.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Must stay in sync with calculate-iv-rank/index.ts and src/lib/stockList.ts
const STOCK_TICKERS = [
  // Meme / momentum (batches 0–3)
  'GME','MARA','SOFI','RIVN','COIN','HOOD','AMC','PLTR','RBLX','SNAP',
  'UBER','LYFT','IONQ','SMCI','NVAX','TLRY','RIOT','CLSK','MSTR','WULF',
  // Growth tech (batches 4–7)
  'TSLA','NVDA','AMD','META','NFLX','SHOP','XYZ','ROKU','NET','DDOG',
  'CRWD','SNOW','ZM','DOCN','MDB','BILL','AFRM','UPST','OPEN','ABNB',
  // Large-cap blue chip (batches 8–10)
  'AAPL','MSFT','GOOGL','AMZN','JPM','BAC','GS','XOM','CVX','DIS',
  'NKE','BA','F','GM','PFE',
  // Core ETFs (batches 11–12)
  'SPY','QQQ','IWM','GLD','SLV','TLT','XLE','XLF','ARKK','SOXL',
  // Speculative / AI / quantum (batches 13–14)
  'LCID','ACHR','CLOV','BBAI','SOUN','AISP','RGTI','QBTS','KULR','HIMS',
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
  'ANET','MANH','EPAM','CELH','RBRK','CWAN','MGNI','MQ','ASAN','ESTC',
  'SWKS','QRVO','MPWR','ONTO','FORM','ENTG','WOLF','AXON','KTOS','PSTG',
  'STX','KEYS','AEHR','ACMR','PATH',
  // Financials (batches 38–48)
  'V','MA','AXP','COF','SYF','TOST','MS','C','WFC','SCHW',
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
  'COP','EOG','SLB','HAL','MPC','VLO','PSX','OXY','DVN','APA',
  'CHRD','BKR','FANG','CTRA','SM','MTDR','ENPH','SEDG','RUN','PLUG',
  'FCEL','CHPT','BLNK','FSLR','BE','WMB','KMI','OKE','LNG','VALE',
  // Utilities (batches 73–74)
  'NEE','DUK','SO','D','EXC','AEP','PCG','ED','ETR','PEG',
  // Industrials (batches 75–81)
  'GE','HON','MMM','ETN','EMR','ROK','PH','ITW','DOV','IR',
  'TT','JCI','AME','ROP','CARR','OTIS','CAT','DE','PCAR','CMI',
  'LMT','NOC','GD','RTX','LDOS','BAH','UPS','FDX','CHRW','XPO',
  'SAIA','ODFL','JBHT','WM','RSG',
  // Materials (batches 82–84)
  'FCX','NEM','GOLD','AA','MP','RS','CLF','STLD','NUE','CE',
  'DOW','LYB','PPG','SHW','ALB',
  // Real Estate (batches 85–86)
  'AMT','PLD','EQIX','SPG','O','VICI','WPC','CBRE','WELL','IRM',
  // Telecom & Media (batches 87–89)
  'TMUS','VZ','T','CMCSA','WBD','SPOT','TTWO','EA','NWSA','FOXA',
  'NYT','IAC','RDDT','PINS','SIRI',
  // Telecom/Media, Automotive, International ADRs (batches 90–95)
  'LYV','BILI','TME','TM','STLA','LEA','BWA','APTV','BABA','JD',
  'PDD','BIDU','FUTU','NIO','XPEV','LI','SAP','RIO','BHP','ITUB',
  'BBD','GRAB','SONY','UBS','TD','RY','WIT','SAN','CPRT','KMX',
  // Misc / additional (batches 96–97)
  'CINF','WRB','ERIE','RLI','ALGM','LSCC','MTSI','CRUS',
]

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type YahooCrumb = { crumb: string; cookie: string }

async function getYahooCrumb(): Promise<YahooCrumb | null> {
  try {
    const initRes = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      redirect: 'follow',
    })
    const setCookies: string[] = typeof (initRes.headers as any).getSetCookie === 'function'
      ? (initRes.headers as any).getSetCookie()
      : [initRes.headers.get('set-cookie')].filter(Boolean)
    const cookieStr = setCookies.map((c: string) => c.split(';')[0]).join('; ')
    if (!cookieStr) return null
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': cookieStr },
    })
    if (!crumbRes.ok) return null
    const crumb = (await crumbRes.text()).trim()
    if (!crumb || crumb.includes('<') || crumb.length > 30) return null
    return { crumb, cookie: cookieStr }
  } catch (err) {
    console.warn('getYahooCrumb failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

// Reads from cron_secrets key 'yahoo_crumb_cache'. Shared with calculate-iv-rank
// so whichever batch runs first each day fetches a fresh crumb for all 488 batches.
async function getCachedYahooCrumb(
  supabase: ReturnType<typeof createClient>,
): Promise<YahooCrumb | null> {
  const { data } = await supabase
    .from('cron_secrets')
    .select('value')
    .eq('key', 'yahoo_crumb_cache')
    .single()

  if (data?.value) {
    try {
      const cached = JSON.parse(data.value) as { crumb: string; cookie: string; expires_at: string }
      if (new Date(cached.expires_at) > new Date()) {
        console.log('Yahoo crumb: cache hit')
        return { crumb: cached.crumb, cookie: cached.cookie }
      }
    } catch {
      // malformed — fall through
    }
  }

  console.log('Yahoo crumb: cache miss — fetching fresh')
  const fresh = await getYahooCrumb()
  if (!fresh) return null

  // 6-hour TTL covers both Polygon (23:00–03:03 UTC) and Yahoo (04:00–08:03 UTC) windows
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('cron_secrets')
    .upsert(
      { key: 'yahoo_crumb_cache', value: JSON.stringify({ ...fresh, expires_at: expiresAt }) },
      { onConflict: 'key' },
    )

  return fresh
}

async function fetchYahooATMIV(
  ticker: string,
  currentPrice: number,
  auth: YahooCrumb | null,
): Promise<number | null> {
  if (currentPrice <= 0) return null
  try {
    const baseHeaders = {
      'User-Agent': UA,
      'Accept': 'application/json',
      ...(auth ? { 'Cookie': auth.cookie } : {}),
    }
    const crumbParam = auth ? `crumb=${encodeURIComponent(auth.crumb)}` : ''

    const controller1 = new AbortController()
    const timer1 = setTimeout(() => controller1.abort(), 8000)
    const res1 = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}${crumbParam ? `?${crumbParam}` : ''}`,
      { signal: controller1.signal, headers: baseHeaders },
    )
    clearTimeout(timer1)
    if (!res1.ok) return null

    const data1 = await res1.json()
    const result1 = data1?.optionChain?.result?.[0]
    if (!result1) return null

    const nowSec = Date.now() / 1000
    const expirationDates: number[] = result1.expirationDates ?? []
    const preferred = expirationDates.find(ts => {
      const daysOut = (ts - nowSec) / 86400
      return daysOut >= 21 && daysOut <= 49
    })
    const targetExpiry = preferred ?? expirationDates[0]
    if (!targetExpiry) return null

    let optionSet = (result1.options ?? []).find(
      (o: { expirationDate: number }) => o.expirationDate === targetExpiry,
    )

    if (!optionSet && preferred) {
      const controller2 = new AbortController()
      const timer2 = setTimeout(() => controller2.abort(), 8000)
      const params = [crumbParam, `date=${preferred}`].filter(Boolean).join('&')
      const res2 = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?${params}`,
        { signal: controller2.signal, headers: baseHeaders },
      )
      clearTimeout(timer2)
      if (res2.ok) {
        const data2 = await res2.json()
        optionSet = data2?.optionChain?.result?.[0]?.options?.[0] ?? null
      }
    }

    if (!optionSet) return null

    type YContract = { strike: number; impliedVolatility?: number }
    const calls: YContract[] = optionSet.calls ?? []
    const puts:  YContract[] = optionSet.puts  ?? []

    const allStrikes = [...new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])]
    if (allStrikes.length === 0) return null
    const atmStrike = allStrikes.reduce((best, s) =>
      Math.abs(s - currentPrice) < Math.abs(best - currentPrice) ? s : best,
      allStrikes[0],
    )

    const callIV = calls.find(c => c.strike === atmStrike)?.impliedVolatility ?? null
    const putIV  = puts.find(p  => p.strike === atmStrike)?.impliedVolatility  ?? null

    if (callIV == null && putIV == null) return null
    const iv = callIV != null && putIV != null
      ? (callIV + putIV) / 2
      : (callIV ?? putIV!)

    if (iv < 0.05 || iv > 5.0) return null
    return Math.round(iv * 100)
  } catch {
    return null
  }
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (cronSecret === '' || token !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || serviceRoleKey === '') {
    return new Response(
      JSON.stringify({ error: 'Missing env vars' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const today = new Date().toISOString().split('T')[0]
  const startTime = Date.now()

  let batchIndex = 0
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.batchIndex === 'number' && body.batchIndex >= 0 && body.batchIndex <= 48) {
      batchIndex = body.batchIndex
    }
  } catch { /* no body */ }

  const tickers = STOCK_TICKERS.slice(batchIndex * 10, batchIndex * 10 + 10)
  console.log(`Yahoo IV — batch ${batchIndex}/48 (${tickers.join(', ')}) — ${new Date().toISOString()}`)

  const yahooCrumb = await getCachedYahooCrumb(supabase)
  if (!yahooCrumb) console.warn('Yahoo crumb unavailable — current_iv will be null for this batch')

  // Read existing Polygon rows to get current_price and HV range for iv_rank computation
  const { data: snapshots } = await supabase
    .from('iv_snapshots')
    .select('ticker, current_price, hv_52wk_high, hv_52wk_low')
    .in('ticker', tickers)
    .eq('snapshot_date', today)

  const snapshotMap = new Map(
    (snapshots ?? []).map(s => [s.ticker, s])
  )

  const results: Array<{ ticker: string; iv: number | null; rank: number | null; skipped: boolean }> = []
  const errors: string[] = []

  for (const ticker of tickers) {
    try {
      const snap = snapshotMap.get(ticker)
      if (!snap?.current_price) {
        console.warn(`  ${ticker}: no Polygon snapshot for ${today}, skipping`)
        results.push({ ticker, iv: null, rank: null, skipped: true })
        continue
      }

      const yahooIV = await fetchYahooATMIV(ticker, snap.current_price, yahooCrumb)

      if (yahooIV == null) {
        console.warn(`  ${ticker}: Yahoo IV unavailable`)
        results.push({ ticker, iv: null, rank: null, skipped: false })
        continue
      }

      // Recompute iv_rank using real ATM IV against HV 52-week range
      let newIvRank: number | null = null
      const hi = snap.hv_52wk_high
      const lo = snap.hv_52wk_low
      if (hi != null && lo != null && hi > lo) {
        newIvRank = Math.min(100, Math.max(0, Math.round(
          ((yahooIV - lo) / (hi - lo)) * 100
        )))
      }

      const updateFields: Record<string, unknown> = { current_iv: yahooIV }
      if (newIvRank != null) updateFields.iv_rank = newIvRank

      const { error: updateErr } = await supabase
        .from('iv_snapshots')
        .update(updateFields)
        .eq('ticker', ticker)
        .eq('snapshot_date', today)

      if (updateErr) {
        errors.push(`${ticker}: DB update failed — ${updateErr.message}`)
        results.push({ ticker, iv: yahooIV, rank: newIvRank, skipped: false })
        continue
      }

      console.log(`  ✓ ${ticker}: IV ${yahooIV}%${newIvRank != null ? `, rank ${newIvRank}` : ''}`)
      results.push({ ticker, iv: yahooIV, rank: newIvRank, skipped: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${ticker}: ${message}`)
      errors.push(`${ticker}: ${message}`)
      results.push({ ticker, iv: null, rank: null, skipped: false })
    }
  }

  const durationSeconds = (Date.now() - startTime) / 1000
  const successCount = results.filter(r => r.iv != null).length
  const skippedCount = results.filter(r => r.skipped).length

  try {
    await supabase.from('cron_run_logs').insert({
      function_name: 'fetch-yahoo-iv',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      stocks_processed: tickers.length,
      stocks_succeeded: successCount,
      stocks_failed: results.length - successCount - skippedCount,
      errors: errors.length > 0 ? errors : null,
    })
  } catch { /* non-fatal */ }

  console.log(`Done in ${durationSeconds.toFixed(1)}s — ${successCount}/${tickers.length} IV updated`)

  return new Response(
    JSON.stringify({
      success: true,
      duration_seconds: durationSeconds,
      stocks_processed: tickers.length,
      stocks_succeeded: successCount,
      stocks_skipped: skippedCount,
      stocks_failed: results.length - successCount - skippedCount,
      errors: errors.length > 0 ? errors : null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
