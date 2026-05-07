import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { FREE_FEATURES_LIST, PRO_FEATURES_LIST } from '../lib/featureConfig'

const SUPPORT_EMAIL = 'premiumhuntersupport@gmail.com'

export function UpgradePage() {
  const { tier } = useSubscription()
  const navigate = useNavigate()
  const [emailCopied, setEmailCopied] = useState(false)

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL)
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 2000)
  }

  const handleEmailClick = () => {
    const subject = encodeURIComponent('Premium Hunter — Pro Access Request')
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to request Pro access to Premium Hunter.\n\nMy account email: \n\nA bit about how I plan to use it:\n\nThanks`
    )
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
            Upgrade to Pro
          </h1>
          <p style={{
            margin: 0, fontSize: 15, color: 'var(--ph-text-2)',
            lineHeight: 1.6, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto',
          }}>
            Get full access to the Premium Hunter toolkit — IV screener, live tracker,
            portfolio analytics, Greeks, and AI picks.
          </p>
        </div>

        {/* Pricing cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 20, marginBottom: 40,
        }}>
          {/* Free card */}
          <div style={{
            background: 'rgba(13,27,53,0.5)',
            border: '1px solid rgba(0,229,196,0.08)',
            borderRadius: 12, padding: '28px 24px',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Free</div>
            <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 4 }}>
              $0
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ph-text-2)', marginLeft: 4 }}>
                forever
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Practice the wheel strategy risk-free with virtual money.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
              {FREE_FEATURES_LIST.map((f, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: '#14b8a6', flexShrink: 0 }}>✓</span>
                  <span style={{ color: 'var(--ph-text-2)' }}>{f}</span>
                </li>
              ))}
            </ul>
            <button disabled style={{
              width: '100%', padding: 10,
              background: 'transparent',
              border: '1px solid rgba(0,229,196,0.12)',
              borderRadius: 8, fontSize: 13,
              color: 'var(--ph-text-3)', cursor: 'not-allowed',
            }}>
              {tier === 'free' ? '✓ Your current plan' : 'Free plan'}
            </button>
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
            <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 4 }}>
              $399
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ph-text-2)', marginLeft: 4 }}>
                / year
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Everything you need to trade the wheel professionally.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
              {PRO_FEATURES_LIST.map((f, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: i === 0 ? 'transparent' : '#14b8a6', flexShrink: 0 }}>
                    {i === 0 ? '·' : '✓'}
                  </span>
                  <span style={{
                    color: i === 0 ? 'var(--ph-text-1)' : 'var(--ph-text-2)',
                    fontWeight: i === 0 ? 500 : 400,
                  }}>
                    {f}
                  </span>
                </li>
              ))}
            </ul>
            {tier === 'pro' ? (
              <button disabled style={{
                width: '100%', padding: 11, background: 'transparent',
                border: '1px solid rgba(0,229,196,0.12)', borderRadius: 8,
                fontSize: 13, color: 'var(--ph-text-3)', cursor: 'not-allowed',
              }}>
                ✓ Your current plan
              </button>
            ) : (
              <button onClick={handleEmailClick} style={{
                width: '100%', padding: 11,
                background: '#14b8a6', color: '#0f1923',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Request Pro access →
              </button>
            )}
          </div>
        </div>

        {/* How to get Pro */}
        {tier !== 'pro' && tier !== 'superuser' && (
          <div style={{
            background: 'rgba(13,27,53,0.5)',
            border: '1px solid rgba(0,229,196,0.08)',
            borderRadius: 12, padding: '28px 20px',
            textAlign: 'center', marginBottom: 32,
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, fontFamily: 'Syne, sans-serif' }}>
              How to get Pro access
            </h2>
            <p style={{
              margin: '0 0 24px', fontSize: 14, color: 'var(--ph-text-2)',
              lineHeight: 1.7, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto',
            }}>
              We're onboarding Pro users personally right now. Send us an email and we'll get
              you set up — usually within a few hours.
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: 'rgba(13,27,53,0.8)',
              border: '1px solid rgba(0,229,196,0.15)',
              borderRadius: 8, marginBottom: 20,
              maxWidth: 420, marginLeft: 'auto', marginRight: 'auto',
              boxSizing: 'border-box', overflow: 'hidden',
            }}>
              <span style={{
                fontSize: 13, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace',
                flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {SUPPORT_EMAIL}
              </span>
              <button onClick={handleCopyEmail} style={{
                padding: '3px 10px', flexShrink: 0,
                background: emailCopied ? 'rgba(20,184,166,0.15)' : 'rgba(0,229,196,0.06)',
                border: '1px solid rgba(0,229,196,0.15)',
                borderRadius: 4, fontSize: 11,
                color: emailCopied ? '#14b8a6' : 'var(--ph-text-2)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}>
                {emailCopied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleEmailClick} style={{
                padding: '11px 28px', background: '#14b8a6', color: '#0f1923',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                ✉ Send us an email
              </button>
              <button onClick={handleCopyEmail} style={{
                padding: '11px 22px', background: 'transparent',
                border: '1px solid rgba(0,229,196,0.2)',
                borderRadius: 8, fontSize: 14, cursor: 'pointer', color: 'var(--ph-text-1)',
              }}>
                {emailCopied ? 'Copied ✓' : 'Copy email address'}
              </button>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--ph-text-3)', lineHeight: 1.6 }}>
              Include your account email and we'll activate Pro access for you directly.
            </p>
          </div>
        )}

        {/* FAQ */}
        <div style={{
          background: 'rgba(13,27,53,0.5)',
          border: '1px solid rgba(0,229,196,0.08)',
          borderRadius: 12, padding: '24px 20px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>
            Questions
          </h3>
          {[
            {
              q: 'How quickly will I get Pro access?',
              a: 'Usually within a few hours of your email. We activate access manually and confirm by reply.',
            },
            {
              q: 'Can I use paper trading on the free plan forever?',
              a: 'Yes. Paper trading is always free. Practice the wheel with $100,000 in virtual money for as long as you want.',
            },
            {
              q: 'Is there a trial?',
              a: "Email us and mention you'd like to try Pro first — we're happy to set up trial access so you can see the full toolkit before committing.",
            },
            {
              q: 'What payment methods are accepted?',
              a: "We'll sort this out over email. We're flexible while we onboard early users.",
            },
            {
              q: 'Is this financial advice?',
              a: 'No. Premium Hunter is a tracking and analysis tool only. It does not provide financial advice, recommendations, or trading signals.',
            },
          ].map(({ q, a }, i, arr) => (
            <div key={i} style={{
              padding: '12px 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(0,229,196,0.08)' : 'none',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>{q}</div>
              <div style={{ fontSize: 13, color: 'var(--ph-text-2)', lineHeight: 1.6 }}>{a}</div>
            </div>
          ))}
        </div>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none',
            color: 'var(--ph-text-3)', fontSize: 13, cursor: 'pointer',
          }}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
