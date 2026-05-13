import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Mail } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'
import { PricingCards } from '../components/PricingCards'

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
        <div style={{ marginBottom: 40 }}>
          <PricingCards />
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
                {emailCopied ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Copied <Check size={11} /></span> : 'Copy'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleEmailClick} style={{
                padding: '11px 28px', background: '#14b8a6', color: '#0f1923',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> Send us an email</span>
              </button>
              <button onClick={handleCopyEmail} style={{
                padding: '11px 22px', background: 'transparent',
                border: '1px solid rgba(0,229,196,0.2)',
                borderRadius: 8, fontSize: 14, cursor: 'pointer', color: 'var(--ph-text-1)',
              }}>
                {emailCopied ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>Copied <Check size={11} /></span> : 'Copy email address'}
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
