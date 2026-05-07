import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'

const PRO_FEATURES = [
  'Full 200-stock IV screener',
  'IV trend & IV/HV ratio columns',
  'Top 5 CSP & CC picks',
  'Unlimited wheel positions',
  'Portfolio & benchmark tabs',
  'Monthly income chart',
  'Watchlist up to 50 tickers',
  'Dashboard command centre',
]

const PREMIUM_FEATURES = [
  'Everything in Pro',
  'Portfolio Greeks dashboard',
  'Theta decay projection chart',
  'Delta, vega & gamma tracking',
  'Greeks summary bar',
  'Advanced position analytics',
]

export function UpgradePage() {
  const navigate = useNavigate()
  const { tier } = useSubscription()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 700, color: 'var(--ph-text-1)' }}>
          Upgrade Premium Hunter
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--ph-text-2)', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          Unlock the full toolkit for systematic options income — IV screener, portfolio Greeks, and more.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Pro */}
        <div style={{
          background: 'rgba(13,27,53,0.6)',
          border: `1px solid ${tier === 'pro' ? '#00e5c4' : 'rgba(0,229,196,0.15)'}`,
          borderRadius: 16, padding: 28,
          position: 'relative',
        }}>
          {tier === 'pro' && (
            <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#00e5c4', color: '#0d1b35', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>
              CURRENT PLAN
            </div>
          )}
          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600, color: '#00e5c4', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pro</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--ph-text-1)' }}>$15</span>
            <span style={{ fontSize: 14, color: 'var(--ph-text-3)' }}>/month</span>
          </div>
          <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PRO_FEATURES.map(f => (
              <li key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--ph-text-2)' }}>
                <span style={{ color: '#00e5c4', flexShrink: 0 }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => { /* wire to Stripe checkout */ }}
            disabled={tier === 'pro' || tier === 'premium' || tier === 'superuser'}
            style={{
              width: '100%', padding: '12px', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: tier === 'pro' ? 'rgba(0,229,196,0.1)' : '#00e5c4',
              color: tier === 'pro' ? '#00e5c4' : '#0d1b35',
            }}
          >
            {tier === 'free' ? 'Upgrade to Pro' : tier === 'pro' ? 'Current plan' : 'Included in your plan'}
          </button>
        </div>

        {/* Premium */}
        <div style={{
          background: 'rgba(13,27,53,0.6)',
          border: `2px solid ${tier === 'premium' ? '#8b5cf6' : 'rgba(139,92,246,0.4)'}`,
          borderRadius: 16, padding: 28,
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#8b5cf6', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>
            {tier === 'premium' ? 'CURRENT PLAN' : 'MOST POPULAR'}
          </div>
          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Premium</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--ph-text-1)' }}>$29</span>
            <span style={{ fontSize: 14, color: 'var(--ph-text-3)' }}>/month</span>
          </div>
          <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PREMIUM_FEATURES.map(f => (
              <li key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--ph-text-2)' }}>
                <span style={{ color: '#8b5cf6', flexShrink: 0 }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => { /* wire to Stripe checkout */ }}
            disabled={tier === 'premium' || tier === 'superuser'}
            style={{
              width: '100%', padding: '12px', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: tier === 'premium' ? 'rgba(139,92,246,0.1)' : '#8b5cf6',
              color: tier === 'premium' ? '#8b5cf6' : '#fff',
            }}
          >
            {tier === 'free' ? 'Upgrade to Premium' : tier === 'pro' ? 'Upgrade to Premium' : tier === 'premium' ? 'Current plan' : 'Included in your plan'}
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'transparent', border: 'none', color: 'var(--ph-text-3)', cursor: 'pointer', fontSize: 13 }}
        >
          ← Go back
        </button>
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ph-text-3)' }}>
          All plans include a 7-day free trial · Cancel anytime · No hidden fees
        </p>
      </div>
    </div>
  )
}
