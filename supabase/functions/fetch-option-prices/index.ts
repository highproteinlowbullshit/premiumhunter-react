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
  let fetched = 0
  let failed = 0

  for (const [, group] of groups) {
    console.log(`Fetching ${group.ticker} expiry ${group.expiry} (${group.contracts.length} contracts)`)
    const chain = await fetchYahooChain(group.ticker, group.expiryUnix)

    if (!chain) {
      failed++
      await delay(600)
      continue
    }

    for (const { strike, contract_type } of group.contracts) {
      const side: OptionContract[] = contract_type === 'call' ? chain.calls : chain.puts
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
