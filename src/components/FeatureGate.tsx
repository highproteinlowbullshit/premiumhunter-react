import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Lock } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import type { FeatureKey } from '../lib/featureConfig'
import { PageLoader } from './PageLoader'

function UnlockButton() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/upgrade')}
      style={{
        padding: '9px 22px',
        background: '#14b8a6',
        color: '#0f1923',
        border: 'none',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 2px 12px rgba(20,184,166,0.35)',
      }}
    >
      <Lock size={13} strokeWidth={2.5} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6, marginTop: -1 }} />
      Unlock with Pro
    </button>
  )
}

function LockCard() {
  const navigate = useNavigate()
  return (
    <div style={{
      background: 'rgba(13,27,53,0.5)',
      border: '1px solid rgba(0,229,196,0.08)',
      borderRadius: 12,
      padding: '36px 24px',
      textAlign: 'center',
    }}>
      <Lock size={28} strokeWidth={1.5} style={{ marginBottom: 12, color: '#14b8a6' }} />
      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--ph-text-1)' }}>
        Pro feature
      </h3>
      <p style={{
        margin: '0 0 20px', fontSize: 13, color: 'var(--ph-text-2)',
        lineHeight: 1.6, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto',
      }}>
        Upgrade to Pro to unlock this and the complete Premium Hunter toolkit.
      </p>
      <button
        onClick={() => navigate('/upgrade')}
        style={{
          padding: '10px 28px', background: '#14b8a6', color: '#0f1923',
          border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Get Pro access →
      </button>
    </div>
  )
}

interface FeatureGateProps {
  feature: FeatureKey
  children: React.ReactNode
  mode?: 'blur' | 'lock' | 'hide'
  blurHeight?: number
  fallback?: React.ReactNode
}

export function FeatureGate({
  feature,
  children,
  mode = 'blur',
  blurHeight = 120,
  fallback,
}: FeatureGateProps) {
  const { can, isSuperuser, isLoading } = useSubscription()

  if (isSuperuser) return <>{children}</>
  if (isLoading) return <>{children}</>
  if (can(feature)) return <>{children}</>
  if (fallback) return <>{fallback}</>
  if (mode === 'hide') return null
  if (mode === 'lock') return <LockCard />

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', minHeight: blurHeight }}>
      <div style={{
        filter: 'blur(5px)', pointerEvents: 'none',
        userSelect: 'none', opacity: 0.45, minHeight: blurHeight,
      }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start', paddingTop: 48, gap: 10,
        background: 'rgba(10, 18, 26, 0.72)', borderRadius: 8,
      }}>
        <UnlockButton />
      </div>
    </div>
  )
}

interface TierRouteProps {
  requires: 'pro' | 'superuser'
  children: React.ReactNode
}

export function TierRoute({ requires, children }: TierRouteProps) {
  const { hasTier, isSuperuser, isLoading } = useSubscription()
  const navigate = useNavigate()
  const shouldRedirect = !isLoading && !isSuperuser && !hasTier(requires)

  useEffect(() => {
    if (shouldRedirect) {
      navigate('/upgrade', { replace: true, state: { from: window.location.pathname } })
    }
  }, [shouldRedirect, navigate])

  if (isLoading) return <PageLoader />
  if (shouldRedirect) return null
  return <>{children}</>
}
