import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET      = Deno.env.get('OPTION_PRICES_CRON_SECRET') ?? ''

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type YahooCrumb = { crumb: string; cookie: string }

async function getYahooCrumb(): Promise<YahooCrumb | null> {
  try {
    const initRes = await fetch('https://fc.yahoo.com/', {
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      redirect: 'follow',
    })
    const setCookies: string[] = (initRes.headers as any).getAll?.('set-cookie') ??
      [initRes.headers.get('set-cookie')].filter(Boolean)
    const cookieStr = setCookies.map((c: string) => c.split(';')[0]).join('; ')

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

function buildOccSymbol(ticker: string, expiry: string, contract_type: 'call' | 'put', strike: number): string {
  const d = new Date(expiry + 'T00:00:00Z')
  const yy = String(d.getUTCFullYear()).slice(2)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const cp = contract_type === 'call' ? 'C' : 'P'
  const strikePadded = String(Math.round(strike * 1000)).padStart(8, '0')
  return `${ticker}${yy}${mm}${dd}${cp}${strikePadded}`
}

async function fetchContractQuotes(
  symbols: string[],
  auth: { crumb: string; cookie: string } | null,
): Promise<Map<string, OptionContract>> {
  const result = new Map<string, OptionContract>()
  if (symbols.length === 0) return result
  try {
    const crumbPart = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : ''
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=bid,ask,regularMarketPrice,impliedVolatility,regularMarketVolume,openInterest${crumbPart}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        ...(auth ? { 'Cookie': auth.cookie } : {}),
      },
    })
    clearTimeout(timer)
    if (!res.ok) { console.warn(`  quote API HTTP ${res.status}`); return result }
    const json = await res.json()
    const quotes: any[] = json?.quoteResponse?.result ?? []
    for (const q of quotes) {
      result.set(q.symbol, {
        strike: 0,
        bid:               q.bid ?? undefined,
        ask:               q.ask ?? undefined,
        lastPrice:         q.regularMarketPrice ?? undefined,
        impliedVolatility: q.impliedVolatility ?? undefined,
        volume:            q.regularMarketVolume ?? undefined,
        openInterest:      q.openInterest ?? undefined,
      })
    }
    console.log(`  quote API: ${quotes.length} quotes for [${symbols.join(',')}]`)
  } catch (err) {
    console.warn(`  quote API error: ${err instanceof Error ? err.message : String(err)}`)
  }
  return result
}

async function yahooFetch(
  ticker: string,
  dateParam: number | null,
  auth: YahooCrumb | null,
): Promise<any | null> {
  try {
    const qs = dateParam != null ? `date=${dateParam}` : ''
    const crumbPart = auth ? `${qs ? '&' : ''}crumb=${encodeURIComponent(auth.crumb)}` : ''
    const url = `https://query1.finance.yahoo.com/v7/finance/options/${ticker}${qs || crumbPart ? '?' : ''}${qs}${crumbPart}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json',
        ...(auth ? { 'Cookie': auth.cookie } : {}),
      },
    })
    clearTimeout(timer)
    if (!res.ok) {
      console.warn(`  Yahoo ${ticker} (${dateParam}): HTTP ${res.status}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn(`  Yahoo ${ticker} fetch failed:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

async function fetchYahooChain(
  ticker: string,
  expiryUnix: number,
  auth: YahooCrumb | null,
): Promise<YahooOptionSet | null> {
  const targetDate = new Date(expiryUnix * 1000).toISOString().split('T')[0]

  const data = await yahooFetch(ticker, expiryUnix, auth)
  if (!data) return null

  const result = data?.optionChain?.result?.[0]
  const options: YahooOptionSet[] = result?.options ?? []
  const chain = options[0] ?? null

  if (!chain) return null

  const returnedDate = new Date(chain.expirationDate * 1000).toISOString().split('T')[0]
  if (returnedDate === targetDate) return chain

  console.warn(`  ${ticker}: requested ${targetDate} but got ${returnedDate}, searching expirationDates`)
  const allDates: number[] = result?.expirationDates ?? []
  const correctTs = allDates.find(ts => new Date(ts * 1000).toISOString().split('T')[0] === targetDate)

  if (!correctTs) {
    console.warn(`  ${ticker}: ${targetDate} not found in expirationDates`)
    return null
  }

  const data2 = await yahooFetch(ticker, correctTs, auth)
  return data2?.optionChain?.result?.[0]?.options?.[0] ?? null
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
  if (paperResult.error) {
    console.error('paper_positions query failed:', paperResult.error)
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

  type ContractNeed = { strike: number; contract_type: 'call' | 'put' }
  const groups = new Map<string, { ticker: string; expiry: string; expiryUnix: number; contracts: ContractNeed[] }>()

  for (const pos of allPositions) {
    const contract_type: 'call' | 'put' = pos.strategy === 'CC' ? 'call' : 'put'
    const key = `${pos.ticker}:${pos.expiry}`
    if (!groups.has(key)) {
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

  type OptionSnapshot = {
    ticker: string
    strike: number
    expiry: string
    contract_type: 'call' | 'put'
    snapshot_date: string
    snapshot_time: string
    bid: number | null
    ask: number | null
    mid: number | null
    last_price: number | null
    implied_volatility: number | null
    volume: number | null
    open_interest: number | null
  }
  const snapshots: OptionSnapshot[] = []
  const auth = await getYahooCrumb()
  if (!auth) console.warn('Could not obtain Yahoo crumb — requests may 401')

  let fetched = 0
  let failed = 0

  for (const [, group] of groups) {
    console.log(`Fetching ${group.ticker} expiry ${group.expiry} (${group.contracts.length} contracts)`)
    const chain = await fetchYahooChain(group.ticker, group.expiryUnix, auth)

    if (!chain) {
      failed++
      await delay(600)
      continue
    }

    const chainEmpty = chain.calls.length === 0 && chain.puts.length === 0
    let quoteMap = new Map<string, OptionContract>()
    if (chainEmpty) {
      console.log(`  chain empty for ${group.ticker} ${group.expiry} — falling back to quote API`)
      const occSymbols = group.contracts.map(c =>
        buildOccSymbol(group.ticker, group.expiry, c.contract_type, c.strike)
      )
      quoteMap = await fetchContractQuotes(occSymbols, auth)
    }

    for (const { strike, contract_type } of group.contracts) {
      let contract: OptionContract | undefined

      if (chainEmpty) {
        const sym = buildOccSymbol(group.ticker, group.expiry, contract_type, strike)
        contract = quoteMap.get(sym)
        if (contract) contract = { ...contract, strike }
      } else {
        const side: OptionContract[] = contract_type === 'call' ? chain.calls : chain.puts
        contract = side.find(c => Math.abs(c.strike - strike) < 0.50)
      }

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
        ? Math.round(contract.impliedVolatility * 100)
        : null
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

    await delay(600)
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
