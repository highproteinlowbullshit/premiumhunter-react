import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    if (body?.ticker) singleContract = body
  } catch {
    // no body — fetch all open positions
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const today = new Date().toISOString().split('T')[0]

  type PosRow = { ticker: string; strategy: string; strike: number; expiry: string }
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

  type ContractNeed = { strike: number; contract_type: 'call' | 'put' }
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

  const snapshots: SnapshotRow[] = []
  let groups_failed = 0

  for (const [, group] of groups) {
    const chain = await fetchYahooChain(group.ticker, group.expiryUnix)

    if (!chain) {
      groups_failed++
      await delay(200)
      continue
    }

    for (const { strike, contract_type } of group.contracts) {
      const side: OptionContract[] = contract_type === 'call' ? chain.calls : chain.puts
      const contract = side.find(c => Math.abs(c.strike - strike) < 0.50)

      if (!contract) {
        console.warn(`  No contract: ${group.ticker} ${contract_type} $${strike} exp ${group.expiry}`)
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
    }

    await delay(200)
  }

  if (snapshots.length > 0) {
    const { error: upsertError } = await db
      .from('option_price_snapshots')
      .upsert(snapshots, { onConflict: 'ticker,strike,expiry,contract_type,snapshot_date', ignoreDuplicates: false })

    if (upsertError) {
      console.error('Upsert failed:', upsertError)
      return new Response(JSON.stringify({ error: 'DB upsert failed', details: upsertError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
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
    JSON.stringify({ success: true, snapshots: responseSnapshots, groups_failed }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
