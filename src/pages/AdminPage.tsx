import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { useAdminData, type AdminUser, type AuditLogEntry } from '../hooks/useAdminData'
import { PageLoader } from '../components/PageLoader'

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
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

// ── UsersTable ─────────────────────────────────────────────────────────────────

interface UsersTableProps {
  users: AdminUser[]
  isLoading: boolean
  searchQuery: string
  tierFilter: string
  onSelectUser: (u: AdminUser) => void
  onChangeTier: (userId: string, newTier: string) => void
}

function UsersTable({ users, isLoading, searchQuery, tierFilter, onSelectUser, onChangeTier }: UsersTableProps) {
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

  if (filtered.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ph-text-3)', fontSize: 13 }}>
        No users match the current filter.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '16%' }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,229,196,0.1)' }}>
            {['User', 'Tier', 'Status', 'Joined', 'Last seen', 'Pos.', 'Change tier'].map(col => (
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
                  <option value="premium">Premium</option>
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

function AuditLogTable({ logs, isLoading }: { logs: AuditLogEntry[]; isLoading: boolean }) {
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
  isSaving: boolean
}

function UserDetailPanel({ user, onClose, onChangeTier, onBanUser, onAddNote, isSaving }: UserDetailPanelProps) {
  const [newTier, setNewTier] = useState(user.tier)
  const [changeReason, setChangeReason] = useState('')
  const [banReason, setBanReason] = useState('')
  const [noteText, setNoteText] = useState(user.notes ?? '')

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
            {(['free', 'pro', 'premium', 'superuser'] as const).map(t => (
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
        </div>
      </div>
    </div>
  )
}

// ── AdminPage ──────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { isSuperuser, isLoading: subLoading } = useSubscription()
  const { users, auditLog, changeTier, banUser, addNote } = useAdminData()
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users')

  if (subLoading) return <PageLoader />
  if (!isSuperuser) return <Navigate to="/dashboard" replace />

  const allUsers = users.data ?? []
  const tierCounts = { pro: 0, premium: 0, free: 0, superuser: 0 }
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
            { label: 'Premium', value: tierCounts.premium, color: '#8b5cf6' },
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
        {(['users', 'audit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', border: 'none', background: 'transparent',
              color: activeTab === tab ? '#00e5c4' : 'var(--ph-text-3)',
              borderBottom: activeTab === tab ? '2px solid #00e5c4' : '2px solid transparent',
              cursor: 'pointer', fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 400,
              textTransform: 'capitalize',
            }}
          >
            {tab === 'audit' ? 'Audit log' : `Users (${allUsers.length})`}
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
              <option value="premium">Premium</option>
              <option value="superuser">Superuser</option>
            </select>
          </div>
          <div style={{ background: 'rgba(13,27,53,0.4)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <UsersTable
              users={allUsers}
              isLoading={users.isLoading}
              searchQuery={searchQuery}
              tierFilter={tierFilter}
              onSelectUser={setSelectedUser}
              onChangeTier={(userId, newTier) =>
                changeTier.mutate({ userId, newTier, reason: 'Quick change from admin table' })
              }
            />
          </div>
        </>
      )}

      {/* Audit log tab */}
      {activeTab === 'audit' && (
        <div style={{ background: 'rgba(13,27,53,0.4)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12, overflow: 'hidden' }}>
          <AuditLogTable logs={auditLog.data ?? []} isLoading={auditLog.isLoading} />
        </div>
      )}

      {/* Detail panel */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onChangeTier={(newTier, reason) => changeTier.mutate({ userId: selectedUser.user_id, newTier, reason })}
          onBanUser={reason => banUser.mutate({ userId: selectedUser.user_id, reason })}
          onAddNote={note => addNote.mutate({ userId: selectedUser.user_id, note })}
          isSaving={changeTier.isPending || banUser.isPending || addNote.isPending}
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
