import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
  auth: YahooCrumb | null,
  dbg: string[],
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
    if (!res.ok) {
      dbg.push(`  quote API HTTP ${res.status}`)
      return result
    }
    const json = await res.json()
    const quotes: any[] = json?.quoteResponse?.result ?? []
    dbg.push(`  quote API returned ${quotes.length} quotes`)
    for (const q of quotes) {
      result.set(q.symbol, {
        strike: 0,
        bid:              q.bid ?? undefined,
        ask:              q.ask ?? undefined,
        lastPrice:        q.regularMarketPrice ?? undefined,
        impliedVolatility: q.impliedVolatility ?? undefined,
        volume:           q.regularMarketVolume ?? undefined,
        openInterest:     q.openInterest ?? undefined,
      })
    }
  } catch (err) {
    dbg.push(`  quote API error: ${err instanceof Error ? err.message : String(err)}`)
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
  dbg: string[],
): Promise<YahooOptionSet | null> {
  const targetDate = new Date(expiryUnix * 1000).toISOString().split('T')[0]

  const data = await yahooFetch(ticker, expiryUnix, auth)
  if (!data) { dbg.push(`  yahoo fetch1 returned null`); return null }

  const result = data?.optionChain?.result?.[0]
  const options: YahooOptionSet[] = result?.options ?? []
  const chain = options[0] ?? null

  if (!chain) { dbg.push(`  no options array in result`); return null }

  // If Yahoo returned the correct expiry, we're done
  const returnedDate = new Date(chain.expirationDate * 1000).toISOString().split('T')[0]
  if (returnedDate === targetDate) return chain

  // Yahoo returned a different expiry — find the correct timestamp from expirationDates
  const allDates: number[] = result?.expirationDates ?? []
  const allDateStrs = allDates.map(ts => new Date(ts * 1000).toISOString().split('T')[0])
  dbg.push(`  mismatch: got ${returnedDate}, want ${targetDate}; available: [${allDateStrs.join(',')}]`)
  const correctTs = allDates.find(ts => new Date(ts * 1000).toISOString().split('T')[0] === targetDate)

  if (!correctTs) {
    dbg.push(`  target date not in expirationDates`)
    return null
  }

  dbg.push(`  retrying with correctTs=${correctTs}`)
  const data2 = await yahooFetch(ticker, correctTs, auth)
  return data2?.optionChain?.result?.[0]?.options?.[0] ?? null
}

type SnapshotRow = {
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

type PosRow = { ticker: string; strategy: string; strike: number; expiry: string }
type ContractNeed = { strike: number; contract_type: 'call' | 'put' }

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth: validate user JWT
  const authHeader = req.headers.get('Authorization') ?? ''
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await anonClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse optional single-contract body
  let singleContract: { ticker: string; strike: number; expiry: string; strategy: string } | null = null
  try {
    const body = await req.json()
    if (body?.ticker) {
      singleContract = body
      if (
        typeof singleContract.strike !== 'number' ||
        typeof singleContract.expiry !== 'string' ||
        typeof singleContract.strategy !== 'string'
      ) {
        return new Response(JSON.stringify({ error: 'Invalid body: strike must be number, expiry and strategy must be strings' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  } catch {
    // no body — fetch all open positions
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = new Date().toISOString().split('T')[0]

  let positions: PosRow[] = []

  if (singleContract) {
    positions = [{
      ticker: singleContract.ticker,
      strategy: singleContract.strategy,
      strike: singleContract.strike,
      expiry: singleContract.expiry,
    }]
  } else {
    const { data, error } = await db
      .from('wheel_positions')
      .select('ticker, strategy, strike, expiry')
      .eq('user_id', user.id)
      .eq('status', 'open')

    if (error) {
      console.error('wheel_positions query failed:', error)
      return new Response(JSON.stringify({ error: 'DB query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    positions = data ?? []
  }

  if (positions.length === 0) {
    return new Response(
      JSON.stringify({ success: true, snapshots: [], groups_failed: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const groups = new Map<string, { ticker: string; expiry: string; expiryUnix: number; contracts: ContractNeed[] }>()

  for (const pos of positions) {
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
    if (!alreadyHave) group.contracts.push({ strike: pos.strike, contract_type })
  }

  const dbg: string[] = []
  const auth = await getYahooCrumb()
  if (!auth) dbg.push('WARN: crumb failed — proceeding without auth')
  else dbg.push(`OK: crumb obtained (len=${auth.crumb.length})`)

  const snapshots: SnapshotRow[] = []
  let groups_failed = 0

  for (const [, group] of groups) {
    dbg.push(`Fetching ${group.ticker} exp=${group.expiry} unix=${group.expiryUnix}`)
    const chain = await fetchYahooChain(group.ticker, group.expiryUnix, auth, dbg)

    if (!chain) {
      dbg.push(`  FAIL: no chain returned for ${group.ticker}`)
      groups_failed++
      await delay(200)
      continue
    }

    dbg.push(`  chain expiry=${new Date(chain.expirationDate * 1000).toISOString().split('T')[0]} calls=${chain.calls.length} puts=${chain.puts.length}`)

    // If chain came back empty (after-hours), fall back to individual contract quote API
    const chainEmpty = chain.calls.length === 0 && chain.puts.length === 0
    let quoteMap = new Map<string, OptionContract>()
    if (chainEmpty) {
      dbg.push(`  chain empty — falling back to quote API`)
      const occSymbols = group.contracts.map(c =>
        buildOccSymbol(group.ticker, group.expiry, c.contract_type, c.strike)
      )
      quoteMap = await fetchContractQuotes(occSymbols, auth, dbg)
    }

    const groupSnapshots: SnapshotRow[] = []
    for (const { strike, contract_type } of group.contracts) {
      let contract: OptionContract | undefined

      if (chainEmpty) {
        const sym = buildOccSymbol(group.ticker, group.expiry, contract_type, strike)
        contract = quoteMap.get(sym)
        if (contract) contract = { ...contract, strike }
      } else {
        const side: OptionContract[] = contract_type === 'call' ? chain.calls : chain.puts
        contract = side.find(c => Math.abs(c.strike - strike) < 0.50)
        if (!contract) {
          const available = side.map(c => c.strike).sort((a, b) => Number(a) - Number(b))
          dbg.push(`  NO MATCH: ${group.ticker} ${contract_type} $${strike} — avail: [${available.join(',')}]`)
          continue
        }
      }

      if (!contract) {
        dbg.push(`  NO MATCH: ${group.ticker} ${contract_type} $${strike} (quote API returned nothing)`)
        continue
      }

      dbg.push(`  MATCH: ${group.ticker} ${contract_type} $${strike} bid=${contract.bid} ask=${contract.ask} last=${contract.lastPrice}`)

      const bid = (contract.bid != null && contract.bid > 0) ? contract.bid : null
      const ask = (contract.ask != null && contract.ask > 0) ? contract.ask : null
      const mid = (contract.lastPrice != null && contract.lastPrice > 0) ? contract.lastPrice : null
      const iv = contract.impliedVolatility != null
        ? Math.round(contract.impliedVolatility * 100)
        : null
      const ivClean = iv != null && iv >= 5 && iv <= 500 ? iv : null

      groupSnapshots.push({
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
    }

    if (groupSnapshots.length > 0) {
      const { error: upsertError } = await db
        .from('option_price_snapshots')
        .upsert(groupSnapshots, { onConflict: 'ticker,strike,expiry,contract_type,snapshot_date', ignoreDuplicates: false })

      if (upsertError) {
        dbg.push(`  UPSERT ERROR: ${JSON.stringify(upsertError)}`)
        groups_failed++
      } else {
        dbg.push(`  UPSERTED ${groupSnapshots.length} rows`)
        snapshots.push(...groupSnapshots)
      }
    } else {
      dbg.push(`  no snapshots to upsert for ${group.ticker}`)
    }

    await delay(200)
  }

  // Return the compact shape the client needs
  const responseSnapshots = snapshots.map(s => ({
    ticker:        s.ticker,
    strike:        s.strike,
    expiry:        s.expiry,
    contract_type: s.contract_type,
    bid:           s.bid,
    ask:           s.ask,
    mid:           s.mid,
  }))

  return new Response(
    JSON.stringify({ success: true, snapshots: responseSnapshots, groups_failed, debug: dbg }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
