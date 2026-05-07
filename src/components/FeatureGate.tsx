import { useSubscription, type Tier } from '../hooks/useSubscription'
import { useNavigate } from 'react-router-dom'

interface FeatureGateProps {
  requires: Tier
  children: React.ReactNode
  fallback?: React.ReactNode
  mode?: 'lock' | 'blur' | 'hide'
  featureName?: string
  description?: string
}

export function FeatureGate({
  requires,
  children,
  fallback,
  mode = 'lock',
  featureName,
  description,
}: FeatureGateProps) {
  const { canAccess, isLoading, isSuperuser } = useSubscription()
  const navigate = useNavigate()

  if (isSuperuser) return <>{children}</>
  if (isLoading) return null
  if (canAccess(requires)) return <>{children}</>
  if (fallback) return <>{fallback}</>

  const tierLabel = requires === 'pro' ? 'Pro' : 'Premium'
  const price = requires === 'pro' ? '$15/month' : '$29/month'

  if (mode === 'lock') {
    return (
      <div style={{
        background: 'rgba(13,27,53,0.5)',
        border: '1px solid rgba(0,229,196,0.08)',
        borderRadius: 12,
        padding: '28px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--ph-text-1)' }}>
          {featureName ?? 'This feature'} is {tierLabel} only
        </h3>
        <p style={{
          margin: '0 0 20px', fontSize: 13, color: 'var(--ph-text-2)',
          lineHeight: 1.6, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto',
        }}>
          {description ?? `Upgrade to ${tierLabel} for ${price} to unlock this feature.`}
        </p>
        <button
          onClick={() => navigate('/upgrade')}
          style={{
            padding: '10px 24px', background: '#00e5c4', color: '#0d1b35',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Upgrade to {tierLabel} →
        </button>
        <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--ph-text-3)' }}>
          {price} · Cancel anytime
        </p>
      </div>
    )
  }

  if (mode === 'blur') {
    return (
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.5 }}>
          {children}
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10,
          background: 'rgba(13, 27, 53, 0.8)', borderRadius: 8,
        }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <span style={{ fontSize: 13, color: 'var(--ph-text-2)', fontFamily: 'DM Sans, sans-serif' }}>
            {featureName ?? tierLabel + ' feature'}
          </span>
          <button
            onClick={() => navigate('/upgrade')}
            style={{
              padding: '8px 20px', background: '#00e5c4', color: '#0d1b35',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Unlock with {tierLabel}
          </button>
        </div>
      </div>
    )
  }

  return null
}

interface InlineGateProps {
  requires: Tier
  children: React.ReactNode
  limitReached: boolean
  featureName: string
}

export function InlineGate({ requires, children, limitReached, featureName }: InlineGateProps) {
  const { canAccess, isSuperuser } = useSubscription()
  const navigate = useNavigate()

  if (isSuperuser || canAccess(requires) || !limitReached) return <>{children}</>

  const tierLabel = requires === 'pro' ? 'Pro' : 'Premium'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: 'rgba(0,229,196,0.06)',
      border: '1px solid rgba(0,229,196,0.2)',
      borderRadius: 8,
    }}>
      <span style={{ fontSize: 14 }}>🔒</span>
      <span style={{ fontSize: 13, color: 'var(--ph-text-2)' }}>{featureName} limit reached</span>
      <button
        onClick={() => navigate('/upgrade')}
        style={{
          marginLeft: 'auto', padding: '4px 12px', background: '#00e5c4',
          color: '#0d1b35', border: 'none', borderRadius: 6,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Upgrade to {tierLabel}
      </button>
    </div>
  )
}
