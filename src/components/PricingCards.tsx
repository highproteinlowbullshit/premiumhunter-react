import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import { FREE_FEATURES_LIST, PRO_FEATURES_LIST } from '../lib/featureConfig'

const SUPPORT_EMAIL = 'premiumhuntersupport@gmail.com'

interface PricingCardsProps {
  isLanding?: boolean
}

export function PricingCards({ isLanding = false }: PricingCardsProps) {
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const handleEmailClick = () => {
    const subject = encodeURIComponent('Premium Hunter — Pro Access Request')
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to request Pro access to Premium Hunter.\n\nMy account email: \n\nA bit about how I plan to use it:\n\nThanks`
    )
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
      gap: 20,
    }}>
      {/* Free card */}
      <div style={{
        background: 'rgba(13,27,53,0.5)',
        border: '1px solid rgba(0,229,196,0.08)',
        borderRadius: 12, padding: '28px 24px',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#e8f0fe' }}>Free</div>
        <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 4, color: '#e8f0fe' }}>
          $0
          <span style={{ fontSize: 14, fontWeight: 400, color: '#9ab4d4', marginLeft: 4 }}>
            forever
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#9ab4d4', lineHeight: 1.5, margin: '0 0 20px' }}>
          Practice the wheel strategy risk-free with virtual money.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
          {FREE_FEATURES_LIST.map((f, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13 }}>
              <Check size={13} style={{ color: '#14b8a6', flexShrink: 0 }} />
              <span style={{ color: '#9ab4d4' }}>{f}</span>
            </li>
          ))}
        </ul>
        {isLanding ? (
          <button
            onClick={() => navigate('/signup')}
            style={{
              width: '100%', padding: 11,
              background: 'transparent',
              border: '1px solid rgba(0,229,196,0.25)',
              borderRadius: 8, fontSize: 14, fontWeight: 600,
              color: '#14b8a6', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(20,184,166,0.08)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            Get started free →
          </button>
        ) : (
          <button disabled style={{
            width: '100%', padding: 10,
            background: 'transparent',
            border: '1px solid rgba(0,229,196,0.12)',
            borderRadius: 8, fontSize: 13,
            color: '#4a6a8a', cursor: 'not-allowed',
          }}>
            {tier === 'free' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Your current plan</span> : 'Free plan'}
          </button>
        )}
      </div>

      {/* Pro card */}
      <div style={{
        background: 'rgba(13,27,53,0.5)',
        border: '2px solid #14b8a6',
        borderRadius: 12, padding: '28px 24px',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
          padding: '3px 16px', borderRadius: 20,
          background: '#14b8a6', color: '#0f1923',
          fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          Full access
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#14b8a6' }}>Pro</div>
        <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 4, color: '#e8f0fe' }}>
          $399
          <span style={{ fontSize: 14, fontWeight: 400, color: '#9ab4d4', marginLeft: 4 }}>
            / year
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#9ab4d4', lineHeight: 1.5, margin: '0 0 20px' }}>
          Everything you need to trade the wheel professionally.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
          {PRO_FEATURES_LIST.map((f, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13 }}>
              {i === 0
                ? <span style={{ width: 13, flexShrink: 0 }} />
                : <Check size={13} style={{ color: '#14b8a6', flexShrink: 0 }} />
              }
              <span style={{
                color: i === 0 ? '#e8f0fe' : '#9ab4d4',
                fontWeight: i === 0 ? 500 : 400,
              }}>
                {f}
              </span>
            </li>
          ))}
        </ul>
        {!isLanding && tier === 'pro' ? (
          <button disabled style={{
            width: '100%', padding: 11, background: 'transparent',
            border: '1px solid rgba(0,229,196,0.12)', borderRadius: 8,
            fontSize: 13, color: '#4a6a8a', cursor: 'not-allowed',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Your current plan</span>
          </button>
        ) : (
          <button
            onClick={handleEmailClick}
            style={{
              width: '100%', padding: 11,
              background: '#14b8a6', color: '#0f1923',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            Request Pro access →
          </button>
        )}
      </div>
    </div>
  )
}
