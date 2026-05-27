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

async function fetchYahooChain(
  ticker: string,
  expiryUnix: number,
  auth: YahooCrumb | null,
): Promise<YahooOptionSet | null> {
  try {
    const params = new URLSearchParams({ date: String(expiryUnix) })
    if (auth) params.set('crumb', auth.crumb)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?${params}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': UA,
          'Accept': 'application/json',
          ...(auth ? { 'Cookie': auth.cookie } : {}),
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

  const auth = await getYahooCrumb()
  if (!auth) console.warn('Could not obtain Yahoo crumb — requests may 401')

  const snapshots: SnapshotRow[] = []
  let groups_failed = 0

  for (const [, group] of groups) {
    const chain = await fetchYahooChain(group.ticker, group.expiryUnix, auth)

    if (!chain) {
      groups_failed++
      await delay(200)
      continue
    }

    const groupSnapshots: SnapshotRow[] = []
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
        console.error('Upsert failed for group:', group.ticker, group.expiry, upsertError)
        groups_failed++
      } else {
        snapshots.push(...groupSnapshots)
      }
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
    JSON.stringify({ success: true, snapshots: responseSnapshots, groups_failed }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
