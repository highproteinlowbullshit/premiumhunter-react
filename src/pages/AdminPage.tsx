import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import { useAdminData, type AdminUser, type AuditLogEntry } from '../hooks/useAdminData'
import { useHeartbeatLog, type HeartbeatEntry, type HeartbeatResult } from '../hooks/useHeartbeatLog'
import { PageLoader } from '../components/PageLoader'
import { CURRENT_DISCLAIMER_VERSION } from '../lib/disclaimer'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// ── DisclaimerBadge ───────────────────────────────────────────────────────────

function DisclaimerBadge({ version }: { version: string | null }) {
  if (!version) {
    return (
      <span style={{
        fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
        color: '#ef4444', background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.25)', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 3,
      }}>
        <X size={10} /> None
      </span>
    )
  }
  if (version === CURRENT_DISCLAIMER_VERSION) {
    return (
      <span style={{
        fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
        color: '#00d68f', background: 'rgba(0,214,143,0.1)',
        border: '1px solid rgba(0,214,143,0.25)', whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 3,
      }}>
        <Check size={10} /> {version}
      </span>
    )
  }
  return (
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
      color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
      border: '1px solid rgba(245,158,11,0.25)', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      <AlertTriangle size={10} /> {version}
    </span>
  )
}

// ── TierBadge ─────────────────────────────────────────────────────────────────

function TierBadge({ tier, large = false }: { tier: string; large?: boolean }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    free:      { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: 'Free' },
    pro:       { color: '#00e5c4', bg: 'rgba(0,229,196,0.12)',   label: 'Pro' },
    premium:   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'Premium' },
    superuser: { color: '#f5c842', bg: 'rgba(245,200,66,0.12)', label: 'Superuser' },
  }
  const c = config[tier] ?? config.free
  return (
    <span style={{
      padding: large ? '4px 12px' : '2px 8px',
      fontSize: large ? 13 : 11,
      fontWeight: 600,
      color: c.color,
      background: c.bg,
      borderRadius: 20,
      border: `1px solid ${c.color}40`,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; border: string; label: string }> = {
    ok:       { color: '#00d68f', bg: 'rgba(0,214,143,0.1)',  border: 'rgba(0,214,143,0.3)',  label: 'OK'       },
    warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'WARNING'  },
    critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  label: 'CRITICAL' },
  }
  const c = cfg[status] ?? { color: 'var(--ph-text-3)', bg: 'transparent', border: 'rgba(0,229,196,0.1)', label: status }
  const Icon = status === 'ok' ? CheckCircle : status === 'warning' ? AlertTriangle : status === 'critical' ? XCircle : null
  return (
    <span style={{
      fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      letterSpacing: '0.05em', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {Icon && <Icon size={10} />}{c.label}
    </span>
  )
}

// ── HealthTab ─────────────────────────────────────────────────────────────────

function HealthTab() {
  const { log, runCheck } = useHeartbeatLog()
  const [lastResult, setLastResult] = useState<HeartbeatResult | null>(null)

  const entries: HeartbeatEntry[] = log.data ?? []
  const latest = entries[0]

  const handleRun = async (forceAlert: boolean) => {
    try {
      const result = await runCheck.mutateAsync(forceAlert)
      setLastResult(result)
    } catch {
      // error surfaced via runCheck.isError
    }
  }

  return (
    <div>
      {/* ── Latest status card ────────────────────────────────────────── */}
      <div style={{
        padding: 20,
        background: 'rgba(13,27,53,0.4)',
        border: '1px solid rgba(0,229,196,0.08)',
        borderRadius: 12, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Last heartbeat check
            </div>
            {log.error ? (
              <p style={{ margin: 0, fontSize: 12, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
                Query error: {(log.error as Error).message}
              </p>
            ) : latest ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <StatusBadge status={latest.status} />
                  <span style={{ fontSize: 12, color: 'var(--ph-text-3)' }}>
                    {timeAgo(latest.checked_at)} · {latest.triggered_by}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.6 }}>
                  {latest.message}
                </p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ph-text-3)' }}>
                {log.isLoading ? 'Loading…' : 'No checks run yet. Click "Run Check Now" to start.'}
              </p>
            )}
          </div>

          {latest && (
            <div style={{ display: 'flex', gap: 20, flexShrink: 0, flexWrap: 'wrap' }}>
              {([
                { label: 'Coverage',       value: `${latest.tickers_covered ?? 0}/${latest.tickers_expected}`, sub: `${latest.coverage_pct ?? 0}%` },
                { label: 'Cron runs 26h',  value: String(latest.total_runs ?? 0),  sub: `${latest.failed_runs ?? 0} w/ issues` },
                { label: 'Snapshot date',  value: latest.snapshot_date ?? '—',      sub: '' },
              ] as const).map(stat => (
                <div key={stat.label} style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--ph-text-3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ph-text-1)', fontFamily: 'JetBrains Mono, monospace' }}>{stat.value}</div>
                  {stat.sub && <div style={{ fontSize: 11, color: 'var(--ph-text-3)' }}>{stat.sub}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coverage bar */}
        {latest?.coverage_pct != null && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: 'var(--ph-text-3)' }}>
              <span>Ticker coverage</span>
              <span>{latest.coverage_pct}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${Math.min(latest.coverage_pct, 100)}%`,
                background: latest.coverage_pct >= 90 ? '#14b8a6' : latest.coverage_pct >= 50 ? '#f59e0b' : '#ef4444',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Inline result after manual run ────────────────────────────── */}
      {lastResult && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: lastResult.status === 'ok'       ? 'rgba(0,214,143,0.06)'
                    : lastResult.status === 'critical' ? 'rgba(239,68,68,0.06)'
                                                       : 'rgba(245,158,11,0.06)',
          border: `1px solid ${
            lastResult.status === 'ok'       ? 'rgba(0,214,143,0.2)'
          : lastResult.status === 'critical' ? 'rgba(239,68,68,0.2)'
                                             : 'rgba(245,158,11,0.2)'}`,
        }}>
          <StatusBadge status={lastResult.status} />
          <span style={{ fontSize: 13, color: 'var(--ph-text-2)', flex: 1 }}>{lastResult.message}</span>
          {lastResult.alert_sent && (
            <span style={{ fontSize: 11, color: '#14b8a6', flexShrink: 0 }}>Alert email sent ✓</span>
          )}
        </div>
      )}

      {runCheck.isError && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, color: '#ef4444',
        }}>
          Check failed. Ensure the edge function is deployed and SUPABASE_SERVICE_ROLE_KEY is set.
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleRun(false)}
          disabled={runCheck.isPending}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#14b8a6', color: '#0d1b35',
            fontSize: 13, fontWeight: 700,
            opacity: runCheck.isPending ? 0.6 : 1,
          }}
        >
          {runCheck.isPending ? 'Running…' : 'Run Check Now'}
        </button>
        <button
          onClick={() => handleRun(true)}
          disabled={runCheck.isPending}
          style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)',
            cursor: 'pointer',
            background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
            fontSize: 13, fontWeight: 600,
            opacity: runCheck.isPending ? 0.6 : 1,
          }}
        >
          Run + Send Test Alert
        </button>
        <span style={{ fontSize: 11, color: 'var(--ph-text-3)' }}>
          Scheduled: daily at 08:00 UTC · requires RESEND_API_KEY secret
        </span>
      </div>

      {/* ── History table ─────────────────────────────────────────────── */}
      <div style={{ background: 'rgba(13,27,53,0.4)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid rgba(0,229,196,0.08)',
          fontSize: 11, fontWeight: 600, color: 'var(--ph-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Recent Checks
        </div>
        {log.isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ph-text-3)', fontSize: 13 }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ph-text-3)', fontSize: 13 }}>No checks recorded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,229,196,0.08)' }}>
                  {['Time', 'Status', 'Coverage', 'Cron runs', 'Alert', 'By', 'Message'].map(col => (
                    <th key={col} style={{
                      padding: '8px 12px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: 'var(--ph-text-3)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid rgba(0,229,196,0.04)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ph-text-3)', whiteSpace: 'nowrap' }}>
                      {timeAgo(entry.checked_at)}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <StatusBadge status={entry.status} />
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--ph-text-2)', whiteSpace: 'nowrap' }}>
                      {entry.tickers_covered ?? '—'}/{entry.tickers_expected}
                      <span style={{ color: 'var(--ph-text-3)', marginLeft: 4 }}>({entry.coverage_pct ?? '—'}%)</span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ph-text-2)' }}>
                      {entry.total_runs ?? '—'}
                      {(entry.failed_runs ?? 0) > 0 && (
                        <span style={{ color: '#f59e0b', marginLeft: 6 }}>({entry.failed_runs} issues)</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>
                      {entry.alert_sent
                        ? <span style={{ color: '#14b8a6' }}>Sent</span>
                        : <span style={{ color: 'var(--ph-text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--ph-text-3)' }}>
                      {entry.triggered_by}
                    </td>
                    <td style={{
                      padding: '8px 12px', fontSize: 12, color: 'var(--ph-text-3)',
                      maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.message ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PulseTab ──────────────────────────────────────────────────────────────────

interface PulseAdminResult {
  pulse_date:       string
  market_sentiment: string
  headline:         string
  articles_fetched: number
  articles_stored:  number
  duration_ms:      number
}

interface LastPulseRow {
  pulse_date:             string
  market_sentiment:       string
  headline:               string
  generation_duration_ms: number | null
  news_articles_used:     number | null
  generated_at:           string | null
}

const PULSE_SENTIMENT_COLOR: Record<string, string> = {
  bullish:          '#22c55e',
  slightly_bullish: '#14b8a6',
  neutral:          'var(--ph-text-3)',
  slightly_bearish: '#f59e0b',
  bearish:          '#ef4444',
}

function PulseSentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === 'bullish' || sentiment === 'slightly_bullish') return <TrendingUp size={12} />
  if (sentiment === 'bearish' || sentiment === 'slightly_bearish') return <TrendingDown size={12} />
  return <Minus size={12} />
}

function PulseTab() {
  const queryClient = useQueryClient()
  const [triggerResult, setTriggerResult] = useState<PulseAdminResult | null>(null)
  const [triggerError,  setTriggerError]  = useState<string | null>(null)

  const lastPulseQuery = useQuery({
    queryKey: ['admin-market-pulse'],
    queryFn:  async (): Promise<LastPulseRow | null> => {
      const { data, error } = await supabase
        .from('market_pulse')
        .select('pulse_date, market_sentiment, headline, generation_duration_ms, news_articles_used, generated_at')
        .order('pulse_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    staleTime: 30 * 1000,
  })

  const trigger = useMutation({
    mutationFn: async (force: boolean): Promise<PulseAdminResult> => {
      const { data, error } = await supabase.functions.invoke('generate-market-pulse', {
        body: { force },
      })
      if (error) throw error
      return data as PulseAdminResult
    },
    onSuccess: (data) => {
      setTriggerError(null)
      setTriggerResult(data)
      void queryClient.invalidateQueries({ queryKey: ['admin-market-pulse'] })
    },
    onError: (err: Error) => {
      setTriggerError(err.message)
    },
  })

  const latest = lastPulseQuery.data
  const sentimentColor = PULSE_SENTIMENT_COLOR[latest?.market_sentiment ?? 'neutral'] ?? 'var(--ph-text-3)'

  return (
    <div>
      {/* Last generated pulse */}
      <div style={{
        padding: 20, marginBottom: 16,
        background: 'rgba(13,27,53,0.4)',
        border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12,
      }}>
        <div style={{ fontSize: 11, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Last generated pulse
        </div>
        {lastPulseQuery.error ? (
          <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>
            Query error: {(lastPulseQuery.error as Error).message}
          </p>
        ) : latest ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: sentimentColor, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'capitalize' }}>
                <PulseSentimentIcon sentiment={latest.market_sentiment} />
                {latest.market_sentiment.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 12, color: 'var(--ph-text-3)' }}>
                {latest.pulse_date}
                {latest.generated_at ? ` · ${timeAgo(latest.generated_at)}` : ''}
              </span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.5 }}>
              {latest.headline}
            </p>
            <div style={{ display: 'flex', gap: 20 }}>
              {([
                { label: 'Articles used',  value: String(latest.news_articles_used ?? '—') },
                { label: 'Duration',       value: latest.generation_duration_ms != null ? `${(latest.generation_duration_ms / 1000).toFixed(1)}s` : '—' },
              ] as const).map(stat => (
                <div key={stat.label}>
                  <div style={{ fontSize: 10, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{stat.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ph-text-1)', fontFamily: 'JetBrains Mono, monospace' }}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ph-text-3)' }}>
            {lastPulseQuery.isLoading ? 'Loading…' : 'No pulse generated yet.'}
          </p>
        )}
      </div>

      {/* Inline result from last trigger */}
      {triggerResult && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(0,229,196,0.05)', border: '1px solid rgba(0,229,196,0.15)',
          fontSize: 13, color: 'var(--ph-text-2)',
        }}>
          <span style={{ fontWeight: 600, color: '#00e5c4', marginRight: 8 }}>
            {triggerResult.market_sentiment?.replace(/_/g, ' ')}
          </span>
          {triggerResult.headline}
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ph-text-3)' }}>
            {triggerResult.articles_stored} articles · {(triggerResult.duration_ms / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {trigger.isError && (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, color: '#ef4444',
        }}>
          {triggerError ?? 'Trigger failed. Ensure the edge function is deployed and secrets are set.'}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => trigger.mutate(false)}
          disabled={trigger.isPending}
          style={{
            padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
            background: '#00e5c4', color: '#0f1923',
            border: 'none', fontSize: 13, fontWeight: 600,
            opacity: trigger.isPending ? 0.6 : 1,
          }}
        >
          {trigger.isPending ? 'Generating…' : "Generate today's pulse"}
        </button>
        <button
          onClick={() => trigger.mutate(true)}
          disabled={trigger.isPending}
          style={{
            padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(0,229,196,0.25)',
            color: 'var(--ph-text-1)',
            fontSize: 13, fontWeight: 500,
            opacity: trigger.isPending ? 0.6 : 1,
          }}
        >
          Force regenerate
        </button>
      </div>
    </div>
  )
}

// ── UsersTable ─────────────────────────────────────────────────────────────────

interface UsersTableProps {
  users: AdminUser[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  searchQuery: string
  tierFilter: string
  onSelectUser: (u: AdminUser) => void
  onChangeTier: (userId: string, newTier: string) => void
}

function UsersTable({ users, isLoading, isError, onRetry, searchQuery, tierFilter, onSelectUser, onChangeTier }: UsersTableProps) {
  const filtered = users.filter(u => {
    const matchesSearch = !searchQuery
      || u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      || u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTier = tierFilter === 'all' || u.tier === tierFilter
    return matchesSearch && matchesTier
  })

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ph-text-3)', fontSize: 13 }}>
        Loading users...
      </div>
    )
  }

  if (isError) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#ff4d6d', fontSize: 13, marginBottom: 12 }}>
          Failed to load users. Your session may have expired.
        </div>
        <button
          onClick={onRetry}
          style={{
            padding: '7px 18px', background: 'rgba(0,229,196,0.1)',
            border: '1px solid rgba(0,229,196,0.25)', borderRadius: 6,
            color: '#00e5c4', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ph-text-3)', fontSize: 13 }}>
        No users match the current filter.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '26%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,229,196,0.1)' }}>
            {['User', 'Tier', 'Status', 'Joined', 'Last seen', 'Pos.', 'Disclaimer', 'Change tier'].map(col => (
              <th key={col} style={{
                padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(user => (
            <tr
              key={user.user_id}
              onClick={() => onSelectUser(user)}
              style={{
                borderBottom: '1px solid rgba(0,229,196,0.05)',
                cursor: 'pointer',
                background: user.is_banned ? 'rgba(255,77,109,0.04)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,196,0.03)' }}
              onMouseLeave={e => { e.currentTarget.style.background = user.is_banned ? 'rgba(255,77,109,0.04)' : 'transparent' }}
            >
              <td style={{ padding: '10px 12px', overflow: 'hidden' }}>
                <div style={{ fontWeight: 500, color: 'var(--ph-text-1)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.display_name ?? user.email?.split('@')[0] ?? 'Unknown'}
                  </span>
                  {user.is_banned && (
                    <span style={{ fontSize: 10, color: '#ff4d6d', background: 'rgba(255,77,109,0.12)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
                      BANNED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ph-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </td>
              <td style={{ padding: '10px 12px' }}>
                <TierBadge tier={user.tier} />
                {user.manually_set_by && (
                  <div style={{ fontSize: 10, color: '#f5c842', marginTop: 2 }}>manual</div>
                )}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{
                  fontSize: 11,
                  color: ['active', 'superuser'].includes(user.status) ? '#00d68f'
                    : user.status === 'past_due' ? '#ff4d6d'
                    : 'var(--ph-text-3)',
                }}>
                  {user.status}
                </span>
                {user.current_period_end && (
                  <div style={{ fontSize: 10, color: 'var(--ph-text-3)' }}>
                    until {new Date(user.current_period_end).toLocaleDateString()}
                  </div>
                )}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ph-text-3)', whiteSpace: 'nowrap' }}>
                {new Date(user.signup_date).toLocaleDateString()}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ph-text-3)', whiteSpace: 'nowrap' }}>
                {user.last_seen_at ? timeAgo(user.last_seen_at) : 'Never'}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ph-text-2)' }}>
                {user.positions_count}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <DisclaimerBadge version={user.disclaimer_version} />
              </td>
              <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                <select
                  value={user.tier}
                  onChange={e => onChangeTier(user.user_id, e.target.value)}
                  style={{
                    padding: '4px 8px', fontSize: 11,
                    background: 'rgba(13,27,53,0.8)',
                    border: '1px solid rgba(0,229,196,0.15)',
                    borderRadius: 6, color: 'var(--ph-text-1)', cursor: 'pointer',
                  }}
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="superuser">Superuser</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── AuditLogTable ─────────────────────────────────────────────────────────────

function AuditLogTable({ logs, isLoading, totalCount, page, setPage }: {
  logs: AuditLogEntry[];
  isLoading: boolean;
  totalCount: number;
  page: number;
  setPage: (p: number) => void;
}) {
  const pageSize = 50
  const totalPages = Math.ceil(totalCount / pageSize)

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ph-text-3)', fontSize: 13 }}>Loading audit log...</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,229,196,0.1)' }}>
            {['Time', 'Action', 'Target', 'Change', 'Reason'].map(col => (
              <th key={col} style={{
                padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} style={{ borderBottom: '1px solid rgba(0,229,196,0.05)' }}>
              <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ph-text-3)', whiteSpace: 'nowrap' }}>
                {timeAgo(log.created_at)}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px',
                  background: 'rgba(0,229,196,0.06)',
                  border: '1px solid rgba(0,229,196,0.12)',
                  borderRadius: 4, color: 'var(--ph-text-2)',
                }}>
                  {log.action}
                </span>
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ph-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                {log.target_user_id ? `${log.target_user_id.slice(0, 8)}…` : '—'}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ph-text-2)' }}>
                {log.old_value && log.new_value
                  ? `${JSON.stringify(log.old_value)} → ${JSON.stringify(log.new_value)}`
                  : '—'}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ph-text-3)' }}>
                {log.reason ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '16px', gap: 12, background: 'rgba(13,27,53,0.2)',
          borderTop: '1px solid rgba(0,229,196,0.08)'
        }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: '4px 12px', background: 'rgba(13,27,53,0.8)', color: 'var(--ph-text-1)',
              border: '1px solid rgba(0,229,196,0.15)', borderRadius: 4, cursor: page === 1 ? 'not-allowed' : 'pointer',
              fontSize: 12, opacity: page === 1 ? 0.5 : 1
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: 12, color: 'var(--ph-text-3)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: '4px 12px', background: 'rgba(13,27,53,0.8)', color: 'var(--ph-text-1)',
              border: '1px solid rgba(0,229,196,0.15)', borderRadius: 4, cursor: page === totalPages ? 'not-allowed' : 'pointer',
              fontSize: 12, opacity: page === totalPages ? 0.5 : 1
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

// ── UserDetailPanel ────────────────────────────────────────────────────────────

interface UserDetailPanelProps {
  user: AdminUser
  onClose: () => void
  onChangeTier: (newTier: string, reason: string) => void
  onBanUser: (reason: string) => void
  onAddNote: (note: string) => void
  onDeleteUser: (reason: string) => void
  isSaving: boolean
}

function UserDetailPanel({ user, onClose, onChangeTier, onBanUser, onAddNote, onDeleteUser, isSaving }: UserDetailPanelProps) {
  const [newTier, setNewTier] = useState(user.tier)
  const [changeReason, setChangeReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [noteText, setNoteText] = useState(user.notes ?? '')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
      background: '#0a1628',
      border: '1px solid rgba(0,229,196,0.12)',
      borderRadius: '12px 0 0 12px',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
      zIndex: 200, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(0,229,196,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ph-text-1)' }}>
            {user.display_name ?? user.email?.split('@')[0] ?? 'Unknown'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ph-text-3)' }}>{user.email}</div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: 'var(--ph-text-3)',
          cursor: 'pointer', fontSize: 20, lineHeight: 1,
        }}>×</button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Quick stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8, marginBottom: 20,
          padding: '12px 16px',
          background: 'rgba(0,229,196,0.04)',
          border: '1px solid rgba(0,229,196,0.08)',
          borderRadius: 8,
        }}>
          {[
            { label: 'Tier', value: <TierBadge tier={user.tier} large /> },
            { label: 'Status', value: user.status },
            { label: 'Positions', value: String(user.positions_count) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--ph-text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ph-text-1)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Details</div>
          {[
            { label: 'User ID', value: user.user_id, mono: true },
            { label: 'Joined', value: new Date(user.signup_date).toLocaleDateString() },
            { label: 'Last seen', value: user.last_seen_at ? timeAgo(user.last_seen_at) : 'Never' },
            { label: 'Stripe ID', value: user.stripe_customer_id ?? 'No Stripe record', mono: true },
            { label: 'Period ends', value: user.current_period_end ? new Date(user.current_period_end).toLocaleDateString() : '—' },
            { label: 'Manual reason', value: user.manually_set_reason ?? '—' },
          ].map(({ label, value, mono }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '6px 0', borderBottom: '1px solid rgba(0,229,196,0.06)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--ph-text-3)', flexShrink: 0 }}>{label}</span>
              <span style={{
                fontSize: 12, color: 'var(--ph-text-1)', textAlign: 'right',
                fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
                maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Change tier */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Change tier</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {(['free', 'pro', 'superuser'] as const).map(t => (
              <button
                key={t}
                onClick={() => setNewTier(t)}
                style={{
                  padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${newTier === t ? '#00e5c4' : 'rgba(0,229,196,0.15)'}`,
                  borderRadius: 6,
                  background: newTier === t ? 'rgba(0,229,196,0.1)' : 'transparent',
                  color: newTier === t ? '#00e5c4' : 'var(--ph-text-3)',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Reason for change (required)"
            value={changeReason}
            onChange={e => setChangeReason(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', boxSizing: 'border-box',
              background: 'rgba(13,27,53,0.8)',
              border: '1px solid rgba(0,229,196,0.15)',
              borderRadius: 6, fontSize: 12, color: 'var(--ph-text-1)', marginBottom: 8,
            }}
          />
          <button
            onClick={() => { if (!changeReason.trim()) return; onChangeTier(newTier, changeReason); setChangeReason('') }}
            disabled={newTier === user.tier || !changeReason.trim() || isSaving}
            style={{
              width: '100%', padding: '8px', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: (newTier !== user.tier && changeReason.trim()) ? '#00e5c4' : 'rgba(0,229,196,0.06)',
              color: (newTier !== user.tier && changeReason.trim()) ? '#0d1b35' : 'var(--ph-text-3)',
            }}
          >
            {isSaving ? 'Saving…' : `Set to ${newTier}`}
          </button>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ph-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Admin notes</div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Notes about this user…"
            rows={3}
            style={{
              width: '100%', padding: '8px 10px', boxSizing: 'border-box',
              background: 'rgba(13,27,53,0.8)',
              border: '1px solid rgba(0,229,196,0.15)',
              borderRadius: 6, fontSize: 12, color: 'var(--ph-text-1)',
              resize: 'vertical',
            }}
          />
          <button
            onClick={() => onAddNote(noteText)}
            disabled={isSaving}
            style={{
              marginTop: 6, padding: '6px 16px',
              background: 'transparent',
              border: '1px solid rgba(0,229,196,0.15)',
              borderRadius: 6, fontSize: 12, color: 'var(--ph-text-3)', cursor: 'pointer',
            }}
          >
            Save note
          </button>
        </div>

        {/* Danger zone */}
        <div style={{
          padding: 16,
          background: 'rgba(255,77,109,0.04)',
          border: '1px solid rgba(255,77,109,0.2)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ff4d6d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Danger zone
          </div>
          <input
            type="text"
            placeholder="Ban reason (required)"
            value={banReason}
            onChange={e => setBanReason(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', boxSizing: 'border-box',
              background: 'rgba(13,27,53,0.8)',
              border: '1px solid rgba(255,77,109,0.3)',
              borderRadius: 6, fontSize: 12, color: 'var(--ph-text-1)', marginBottom: 8,
            }}
          />
          <button
            onClick={() => {
              if (!banReason.trim()) return
              if (confirm(`Ban ${user.email}? This will prevent them from logging in.`)) {
                onBanUser(banReason)
                setBanReason('')
              }
            }}
            disabled={!banReason.trim() || isSaving || user.is_banned}
            style={{
              width: '100%', padding: '8px',
              background: 'rgba(255,77,109,0.1)',
              color: '#ff4d6d',
              border: '1px solid rgba(255,77,109,0.3)',
              borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: banReason.trim() && !user.is_banned ? 'pointer' : 'not-allowed',
            }}
          >
            {user.is_banned ? 'Already banned' : 'Ban user'}
          </button>

          {/* Delete user */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,77,109,0.15)' }}>
            <div style={{ fontSize: 11, color: '#ff4d6d', marginBottom: 6 }}>
              Permanently delete this account and all their data. Type <strong>Delete</strong> to confirm.
            </div>
            <input
              type="text"
              placeholder="Delete"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                background: 'rgba(13,27,53,0.8)',
                border: '1px solid rgba(255,77,109,0.3)',
                borderRadius: 6, fontSize: 12, color: 'var(--ph-text-1)', marginBottom: 8,
              }}
            />
            <button
              onClick={() => {
                onDeleteUser('Deleted by admin')
                setDeleteConfirm('')
              }}
              disabled={deleteConfirm !== 'Delete' || isSaving}
              style={{
                width: '100%', padding: '8px',
                background: deleteConfirm === 'Delete' ? 'rgba(255,77,109,0.2)' : 'rgba(255,77,109,0.05)',
                color: '#ff4d6d',
                border: '1px solid rgba(255,77,109,0.4)',
                borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: deleteConfirm === 'Delete' && !isSaving ? 'pointer' : 'not-allowed',
                opacity: deleteConfirm === 'Delete' ? 1 : 0.5,
              }}
            >
              Delete account permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AdminPage ──────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { isSuperuser, isLoading: subLoading } = useSubscription()
  const { showToast } = useToast()

  const [auditPage, setAuditPage] = useState(1)
  const [auditAction, setAuditAction] = useState('')
  const [auditTarget, setAuditTarget] = useState('')
  const [auditTimeRange, setAuditTimeRange] = useState('all')

  const { users, auditLog, changeTier, banUser, addNote, deleteUser } = useAdminData(
    {
      action: auditAction,
      target_user_id: auditTarget,
      start_time: auditTimeRange === '24h' ? new Date(Date.now() - 86400000).toISOString() :
                  auditTimeRange === '7d' ? new Date(Date.now() - 604800000).toISOString() :
                  auditTimeRange === '30d' ? new Date(Date.now() - 2592000000).toISOString() : undefined,
      end_time: undefined
    },
    auditPage
  )
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'health' | 'pulse'>('users')

  if (subLoading) return <PageLoader />
  if (!isSuperuser) return <Navigate to="/dashboard" replace />

  const allUsers = users.data ?? []
  const tierCounts = { pro: 0, free: 0, superuser: 0 }
  allUsers.forEach(u => { if (u.tier in tierCounts) (tierCounts as any)[u.tier]++ })

  return (
    <div className="min-h-screen mesh-bg pt-20 pb-12 px-4 sm:px-6">
      <style>{`@keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ph-text-1)' }}>
            Admin Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ph-text-3)' }}>
            Premium Hunter user management
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: allUsers.length, color: 'var(--ph-text-1)' },
            { label: 'Pro', value: tierCounts.pro, color: '#00e5c4' },
            { label: 'Free', value: tierCounts.free, color: 'var(--ph-text-3)' },
          ].map(pill => (
            <div key={pill.label} style={{
              padding: '8px 16px', textAlign: 'center',
              background: 'rgba(13,27,53,0.6)',
              border: '1px solid rgba(0,229,196,0.08)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: pill.color }}>{pill.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ph-text-3)' }}>{pill.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,229,196,0.1)', marginBottom: 20 }}>
        {(['users', 'audit', 'health', 'pulse'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', border: 'none', background: 'transparent',
              color: activeTab === tab ? '#00e5c4' : 'var(--ph-text-3)',
              borderBottom: activeTab === tab ? '2px solid #00e5c4' : '2px solid transparent',
              cursor: 'pointer', fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === 'audit' ? 'Audit log' : tab === 'health' ? 'Health' : tab === 'pulse' ? 'Pulse' : `Users (${allUsers.length})`}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search by email or name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1, minWidth: 200, padding: '8px 12px',
                background: 'rgba(13,27,53,0.6)',
                border: '1px solid rgba(0,229,196,0.12)',
                borderRadius: 8, color: 'var(--ph-text-1)', fontSize: 13,
              }}
            />
            <select
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'rgba(13,27,53,0.6)',
                border: '1px solid rgba(0,229,196,0.12)',
                borderRadius: 8, color: 'var(--ph-text-1)', fontSize: 13,
              }}
            >
              <option value="all">All tiers</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="superuser">Superuser</option>
            </select>
          </div>
          <div style={{ background: 'rgba(13,27,53,0.4)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <UsersTable
              users={allUsers}
              isLoading={users.isLoading}
              isError={users.isError}
              onRetry={() => users.refetch()}
              searchQuery={searchQuery}
              tierFilter={tierFilter}
              onSelectUser={setSelectedUser}
              onChangeTier={(userId, newTier) =>
                changeTier.mutate({ userId, newTier, reason: 'Quick change from admin table' }, {
                  onSuccess: () => showToast(`Tier changed to ${newTier}`, 'success'),
                  onError: (err: unknown) => showToast(`Tier change failed: ${err instanceof Error ? err.message : String(err)}`, 'error'),
                })
              }
            />
          </div>
        </>
      )}

      {/* Audit log tab */}
      {activeTab === 'audit' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Filter by target user ID…"
              value={auditTarget}
              onChange={e => { setAuditTarget(e.target.value); setAuditPage(1); }}
              style={{
                flex: 1, minWidth: 200, padding: '8px 12px',
                background: 'rgba(13,27,53,0.6)',
                border: '1px solid rgba(0,229,196,0.12)',
                borderRadius: 8, color: 'var(--ph-text-1)', fontSize: 13,
              }}
            />
            <select
              value={auditAction}
              onChange={e => { setAuditAction(e.target.value); setAuditPage(1); }}
              style={{
                padding: '8px 12px',
                background: 'rgba(13,27,53,0.6)',
                border: '1px solid rgba(0,229,196,0.12)',
                borderRadius: 8, color: 'var(--ph-text-1)', fontSize: 13,
              }}
            >
              <option value="">All Actions</option>
              <option value="tier_change">Change Tier</option>
              <option value="ban_user">Ban User</option>
              <option value="add_note">Add Note</option>
            </select>
            <select
              value={auditTimeRange}
              onChange={e => { setAuditTimeRange(e.target.value); setAuditPage(1); }}
              style={{
                padding: '8px 12px',
                background: 'rgba(13,27,53,0.6)',
                border: '1px solid rgba(0,229,196,0.12)',
                borderRadius: 8, color: 'var(--ph-text-1)', fontSize: 13,
              }}
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <button
              onClick={() => { setAuditTarget(''); setAuditAction(''); setAuditTimeRange('all'); setAuditPage(1); }}
              style={{
                padding: '8px 12px', background: 'transparent',
                border: '1px solid rgba(0,229,196,0.15)', borderRadius: 8,
                color: 'var(--ph-text-3)', fontSize: 12, cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
          <div style={{ background: 'rgba(13,27,53,0.4)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <AuditLogTable
              logs={auditLog.data?.logs ?? []}
              isLoading={auditLog.isLoading}
              totalCount={auditLog.data?.totalCount ?? 0}
              page={auditPage}
              setPage={setAuditPage}
            />
          </div>
        </>
      )}

      {/* Health tab */}
      {activeTab === 'health' && <HealthTab />}

      {/* Pulse tab */}
      {activeTab === 'pulse' && <PulseTab />}

      {/* Detail panel */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onChangeTier={(newTier, reason) => changeTier.mutate({ userId: selectedUser.user_id, newTier, reason })}
          onBanUser={reason => banUser.mutate({ userId: selectedUser.user_id, reason }, {
            onSuccess: () => showToast('User banned', 'success'),
            onError: (err: unknown) => showToast(`Ban failed: ${err instanceof Error ? err.message : String(err)}`, 'error'),
          })}
          onAddNote={note => addNote.mutate({ userId: selectedUser.user_id, note })}
          onDeleteUser={reason => {
            deleteUser.mutate({ userId: selectedUser.user_id, reason }, {
              onSuccess: () => {
                setSelectedUser(null)
                showToast('User deleted successfully', 'success')
              },
              onError: (err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err)
                showToast(`Delete failed: ${msg}`, 'error')
              },
            })
          }}
          isSaving={changeTier.isPending || banUser.isPending || addNote.isPending || deleteUser.isPending}
        />
      )}

      {/* Overlay when panel is open */}
      {selectedUser && (
        <div
          onClick={() => setSelectedUser(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 199 }}
        />
      )}
      </div>
    </div>
  )
}
