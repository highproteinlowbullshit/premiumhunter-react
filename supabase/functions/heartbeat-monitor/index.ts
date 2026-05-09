import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET         = Deno.env.get('CRON_SECRET') ?? ''
const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY') ?? ''
const ALERT_EMAIL_TO      = Deno.env.get('ALERT_EMAIL_TO') ?? 'branyzp@gmail.com'
const ALERT_EMAIL_FROM    = Deno.env.get('ALERT_EMAIL_FROM') ?? 'PremiumHunter Alerts <alerts@premiumhunter.app>'

const TICKERS_EXPECTED    = 488
const WARNING_THRESHOLD   = 0.90  // <90% coverage → warning
const CRITICAL_THRESHOLD  = 0.50  // <50% coverage → critical
const STALE_WARN_HOURS    = 30    // >30h old → warning
const STALE_CRIT_HOURS    = 48    // >48h old → critical

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const authHeader = req.headers.get('Authorization') ?? ''
  const isCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`
  let triggeredBy = 'cron'
  let forceAlert  = false

  if (!isCron) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: sub } = await supabase
      .from('subscriptions').select('tier').eq('user_id', user.id).single()
    if (sub?.tier !== 'superuser') {
      return new Response(JSON.stringify({ error: 'Superuser access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    triggeredBy = 'manual'
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      forceAlert = body.force_alert === true
    }
  }

  const now = new Date()

  // ── 1. Latest snapshot coverage ───────────────────────────────────────────
  // The 244 nightly batches span midnight UTC (23:00–03:03), so they write to
  // two consecutive calendar dates. Count distinct tickers across both to get
  // an accurate picture of total coverage.
  const { data: latestSnap } = await supabase
    .from('iv_snapshots')
    .select('snapshot_date')
    .eq('calculation_success', true)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestDate = latestSnap?.snapshot_date ?? null
  let tickersCovered = 0

  if (latestDate) {
    const prevDate = new Date(latestDate + 'T00:00:00Z')
    prevDate.setUTCDate(prevDate.getUTCDate() - 1)
    const prevDateStr = prevDate.toISOString().split('T')[0]

    const { count } = await supabase
      .from('iv_snapshots')
      .select('ticker', { count: 'exact', head: true })
      .in('snapshot_date', [latestDate, prevDateStr])
      .eq('calculation_success', true)
    tickersCovered = count ?? 0
  }

  // ── 2. Cron activity in the last 26 hours ─────────────────────────────────
  const since = new Date(now.getTime() - 26 * 3_600_000).toISOString()
  const { data: recentLogs } = await supabase
    .from('cron_run_logs')
    .select('*')
    .gte('started_at', since)
    .order('started_at', { ascending: false })

  const totalRuns  = recentLogs?.length ?? 0
  const failedRuns = recentLogs?.filter(
    (r: Record<string, number>) => (r.stocks_failed ?? 0) > (r.stocks_succeeded ?? 0)
  ).length ?? 0
  const lastRunAt     = (recentLogs?.[0] as Record<string, string> | undefined)?.completed_at ?? null
  const errorSamples: string[] = (recentLogs ?? [])
    .flatMap((r: Record<string, unknown>) => (r.errors as string[] | null) ?? [])
    .slice(0, 5)

  // ── 3. Determine status ───────────────────────────────────────────────────
  const hoursSinceLastData = latestDate
    ? (now.getTime() - new Date(latestDate + 'T00:00:00Z').getTime()) / 3_600_000
    : Infinity
  const coveragePct = tickersCovered / TICKERS_EXPECTED
  const issues: string[] = []
  let status: 'ok' | 'warning' | 'critical' = 'ok'

  const escalate = (s: 'warning' | 'critical') => {
    if (s === 'critical' || status === 'ok') status = s
  }

  if (!latestDate || hoursSinceLastData > STALE_CRIT_HOURS) {
    escalate('critical')
    issues.push('No iv_snapshots data found in the last 48 hours')
  } else if (hoursSinceLastData > STALE_WARN_HOURS) {
    escalate('warning')
    issues.push(`Snapshot is ${Math.round(hoursSinceLastData)}h old — expected ≤26h`)
  }

  if (coveragePct < CRITICAL_THRESHOLD) {
    escalate('critical')
    issues.push(`Critical: only ${tickersCovered}/${TICKERS_EXPECTED} tickers covered (${(coveragePct * 100).toFixed(1)}%)`)
  } else if (coveragePct < WARNING_THRESHOLD) {
    escalate('warning')
    issues.push(`Low coverage: ${tickersCovered}/${TICKERS_EXPECTED} tickers (${(coveragePct * 100).toFixed(1)}%)`)
  }

  if (totalRuns === 0) {
    escalate('warning')
    issues.push('No cron activity in the last 26 hours')
  } else if (failedRuns > 0 && failedRuns / totalRuns > 0.30) {
    escalate('warning')
    issues.push(`${failedRuns}/${totalRuns} cron batches had a majority of failures`)
  }

  const message = status === 'ok'
    ? `All systems normal. ${tickersCovered}/${TICKERS_EXPECTED} tickers covered as of ${latestDate}.`
    : issues.join('; ')

  // ── 4. Send alert email ───────────────────────────────────────────────────
  let alertSent = false
  if ((status !== 'ok' || forceAlert) && RESEND_API_KEY) {
    alertSent = await sendAlert({
      status, message, latestDate, tickersCovered, coveragePct,
      totalRuns, failedRuns, lastRunAt, errorSamples,
    })
  }

  // ── 5. Persist result ─────────────────────────────────────────────────────
  const { error: insertError } = await supabase.from('heartbeat_log').insert({
    checked_at:       now.toISOString(),
    status,
    snapshot_date:    latestDate,
    tickers_covered:  tickersCovered,
    tickers_expected: TICKERS_EXPECTED,
    coverage_pct:     parseFloat((coveragePct * 100).toFixed(2)),
    total_runs:       totalRuns,
    failed_runs:      failedRuns,
    last_run_at:      lastRunAt,
    alert_sent:       alertSent,
    triggered_by:     triggeredBy,
    message,
    details:          { issues, errorSamples },
  })
  if (insertError) {
    console.error('heartbeat_log insert failed:', insertError.message)
    return new Response(JSON.stringify({ error: `DB insert failed: ${insertError.message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({
    status, message, alert_sent: alertSent,
    tickers_covered:       tickersCovered,
    tickers_expected:      TICKERS_EXPECTED,
    coverage_pct:          parseFloat((coveragePct * 100).toFixed(2)),
    latest_snapshot_date:  latestDate,
    cron_runs_last_26h:    totalRuns,
    failed_runs:           failedRuns,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})

// ── Email ─────────────────────────────────────────────────────────────────────

interface AlertParams {
  status: string
  message: string
  latestDate: string | null
  tickersCovered: number
  coveragePct: number
  totalRuns: number
  failedRuns: number
  lastRunAt: string | null
  errorSamples: string[]
}

async function sendAlert(p: AlertParams): Promise<boolean> {
  const emoji       = p.status === 'critical' ? '🔴' : '🟡'
  const accentColor = p.status === 'critical' ? '#ef4444' : '#f59e0b'
  const subject     = `${emoji} PremiumHunter ${p.status.toUpperCase()}: ${p.message.slice(0, 80)}`

  const errorsBlock = p.errorSamples.length > 0 ? `
    <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:12px;margin-top:16px;">
      <p style="margin:0 0 8px;font-weight:600;color:#ef4444;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Error Samples</p>
      ${p.errorSamples.map(e => `<p style="margin:3px 0;font-size:12px;font-family:monospace;color:#fca5a5;">${e}</p>`).join('')}
    </div>` : ''

  const html = `
<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto;background:#0a1628;color:#e2e8f0;padding:28px;border-radius:12px;border:1px solid rgba(0,229,196,.1);">
  <div style="border-left:4px solid ${accentColor};padding-left:16px;margin-bottom:24px;">
    <h2 style="margin:0 0 6px;color:${accentColor};font-size:18px;">${emoji} Data Pipeline ${p.status.toUpperCase()}</h2>
    <p style="margin:0;color:#64748b;font-size:12px;">${new Date().toUTCString()}</p>
  </div>
  <p style="font-size:14px;line-height:1.7;color:#cbd5e1;">${p.message}</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
    <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
      <td style="padding:9px 0;color:#64748b;">Latest snapshot</td>
      <td style="padding:9px 0;font-family:monospace;">${p.latestDate ?? 'None'}</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
      <td style="padding:9px 0;color:#64748b;">Ticker coverage</td>
      <td style="padding:9px 0;">${p.tickersCovered}&thinsp;/&thinsp;${TICKERS_EXPECTED} <span style="color:#64748b;">(${(p.coveragePct * 100).toFixed(1)}%)</span></td>
    </tr>
    <tr style="border-bottom:1px solid rgba(255,255,255,.06);">
      <td style="padding:9px 0;color:#64748b;">Cron runs (26 h)</td>
      <td style="padding:9px 0;">${p.totalRuns} total <span style="color:${p.failedRuns > 0 ? '#f59e0b' : '#64748b'};">${p.failedRuns} with issues</span></td>
    </tr>
    <tr>
      <td style="padding:9px 0;color:#64748b;">Last batch completed</td>
      <td style="padding:9px 0;font-family:monospace;">${p.lastRunAt ?? 'Unknown'}</td>
    </tr>
  </table>
  ${errorsBlock}
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:#475569;">
    Sent automatically by the PremiumHunter heartbeat monitor · runs daily at 08:00 UTC
  </div>
</div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: ALERT_EMAIL_FROM, to: [ALERT_EMAIL_TO], subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}
