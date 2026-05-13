import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useInView } from 'react-intersection-observer'
import { PricingCards } from '../components/PricingCards'

// ── Keyframes injected once ───────────────────────────────────────────────────
const LANDING_STYLES = `
  @keyframes lp-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }
  @keyframes lp-bounce {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50%       { transform: translateY(8px); opacity: 0.7; }
  }
  @keyframes lp-slide-in {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }
  @keyframes lp-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .lp-nav-link {
    font-size: 14px;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font-family: 'DM Sans', sans-serif;
    transition: color 0.15s ease;
    text-decoration: none;
  }
  .lp-nav-link:hover { color: #e8f0fe; }
  .lp-feature-pill {
    display: inline-flex; align-items: center;
    padding: 4px 12px; border-radius: 20px;
    font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px;
    font-family: 'DM Sans', sans-serif;
    margin-bottom: 16px;
  }
`

// ── Shared helpers ─────────────────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode
  delay?: number
  style?: React.CSSProperties
}) {
  const { ref, inView } = useInView({ threshold: 0.08, triggerOnce: true })
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.55s ease-out ${delay}ms, transform 0.55s ease-out ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Navbar ─────────────────────────────────────────────────────────────────────

function LandingNavbar() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const navLink = (label: string, id: string) => (
    <button
      className="lp-nav-link"
      onClick={() => { scrollTo(id); setMenuOpen(false) }}
    >
      {label}
    </button>
  )

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 64, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(5,13,26,0.96)' : 'transparent',
        borderBottom: scrolled ? '0.5px solid rgba(0,229,196,0.1)' : '0.5px solid transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}>
        {/* Wordmark */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 18, fontWeight: 700, color: '#14b8a6',
            fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px',
          }}
        >
          Premium Hunter
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 28 }}>
          {navLink('Features', 'features')}
          {navLink('How it works', 'how-it-works')}
          {navLink('Pricing', 'pricing')}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />
          <button className="lp-nav-link" onClick={() => navigate('/login')}>Sign in</button>
          <button
            onClick={() => navigate('/signup')}
            style={{
              background: '#14b8a6', color: '#0f1923',
              border: 'none', borderRadius: 8,
              padding: '7px 18px', fontSize: 14, fontWeight: 700,
              fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            Start free
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#e8f0fe', padding: 8,
          }}
          aria-label="Open menu"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 101,
              background: 'rgba(0,0,0,0.55)',
              animation: 'lp-fade-in 0.2s ease',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 272,
            zIndex: 102, background: '#0a1628',
            borderLeft: '1px solid rgba(0,229,196,0.12)',
            padding: '80px 32px 40px',
            display: 'flex', flexDirection: 'column',
            animation: 'lp-slide-in 0.25s ease-out',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
              {['Features', 'How it works', 'Pricing'].map(label => (
                <button
                  key={label}
                  onClick={() => { scrollTo(label.toLowerCase().replace(/\s+/g, '-')); setMenuOpen(false) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 18, fontWeight: 600, color: '#e8f0fe',
                    fontFamily: 'Syne, sans-serif', textAlign: 'left',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => { navigate('/login'); setMenuOpen(false) }}
                style={{
                  width: '100%', padding: '12px 0',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8, fontSize: 15, fontWeight: 600,
                  color: '#e8f0fe', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Sign in
              </button>
              <button
                onClick={() => { navigate('/signup'); setMenuOpen(false) }}
                style={{
                  width: '100%', padding: '13px 0',
                  background: '#14b8a6', color: '#0f1923',
                  border: 'none', borderRadius: 8,
                  fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Start free
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Hero mock ─────────────────────────────────────────────────────────────────

function HeroDashboardMock() {
  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Ambient orbs */}
      <div style={{
        position: 'absolute', width: 220, height: 220, top: -40, right: -40,
        background: 'rgba(20,184,166,0.12)', borderRadius: '50%', filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 160, height: 160, bottom: -20, left: -20,
        background: 'rgba(20,184,166,0.08)', borderRadius: '50%', filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: 24,
        animation: 'lp-float 4s ease-in-out infinite',
        position: 'relative', zIndex: 1,
      }}>
        {/* Greeting */}
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.5)',
          fontFamily: 'DM Sans, sans-serif', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>Good morning</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d68f', boxShadow: '0 0 6px #00d68f', display: 'inline-block' }} />
            Market open
          </span>
        </div>

        {/* Big theta */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans, sans-serif', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Daily theta income
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#14b8a6', fontFamily: 'Syne, sans-serif', lineHeight: 1, marginBottom: 4 }}>
            +$47.23/day
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Sans, sans-serif' }}>
            earning from time decay across 4 positions
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 0 16px' }} />

        {/* Stat pills */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'This month', value: '$2,840' },
            { label: 'Win rate',   value: '84%' },
            { label: 'Open',       value: '4' },
            { label: 'Deployed',   value: '68%' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Sans, sans-serif', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e8f0fe', fontFamily: 'Syne, sans-serif' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Insight card */}
        <div style={{
          borderLeft: '3px solid #14b8a6',
          paddingLeft: 12,
          background: 'rgba(20,184,166,0.06)',
          borderRadius: '0 8px 8px 0',
          padding: '10px 10px 10px 14px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif', marginBottom: 3 }}>
            🎯 SOFI at IV rank 74 — elevated premium
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif' }}>
            Estimated 28% annualised at 30-delta
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Hero section ──────────────────────────────────────────────────────────────

function HeroSection() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <section style={{
      minHeight: '100vh',
      background: '#0a1628',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '100px 24px 80px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background mesh */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(20,184,166,0.06) 0%, transparent 70%)',
      }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: 60, alignItems: 'center',
        }}
          className="hero-grid"
        >
          {/* Left col */}
          <div>
            {/* Eyebrow pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 14px', borderRadius: 20,
              background: 'rgba(20,184,166,0.15)',
              border: '1px solid rgba(20,184,166,0.3)',
              color: '#14b8a6', fontSize: 12, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              fontFamily: 'DM Sans, sans-serif',
              marginBottom: 20,
            }}>
              Options wheel strategy tracker
            </div>

            {/* Headline */}
            <h1 style={{
              margin: '0 0 16px',
              fontSize: 'clamp(36px, 5vw, 58px)',
              fontWeight: 700, lineHeight: 1.12,
              letterSpacing: '-1px', color: '#ffffff',
              fontFamily: 'Syne, sans-serif',
            }}>
              Track your wheel.<br />
              Grow your premium.
            </h1>

            {/* Sub */}
            <p style={{
              margin: '0 0 32px', fontSize: 18, fontWeight: 400,
              color: 'rgba(255,255,255,0.6)', lineHeight: 1.7,
              maxWidth: 480, fontFamily: 'DM Sans, sans-serif',
            }}>
              The complete toolkit for wheel options traders.
              IV rank screener, live position tracker,
              portfolio analytics, and daily theta income —
              all in one place.
            </p>

            {/* CTA buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => navigate('/signup')}
                style={{
                  background: '#14b8a6', color: '#0f1923',
                  border: 'none', borderRadius: 10,
                  padding: '13px 28px', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  transition: 'opacity 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
              >
                Start free — no card needed
              </button>
              <button
                onClick={() => scrollTo('how-it-works')}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: 'rgba(255,255,255,0.8)',
                  borderRadius: 10, padding: '13px 24px',
                  fontSize: 15, fontWeight: 400,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  transition: 'border-color 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.45)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)' }}
              >
                See how it works ↓
              </button>
            </div>

            {/* Trust signals */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 20,
              fontSize: 12, color: 'rgba(255,255,255,0.4)',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              <span>✓ Free paper trading forever</span>
              <span>✓ No credit card required</span>
              <span>✓ Pro access via email</span>
            </div>
          </div>

          {/* Right col — mock (hidden on mobile via inline responsive style) */}
          <div className="hidden md:block">
            <HeroDashboardMock />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      {!scrolled && (
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          animation: 'lp-bounce 2s ease-in-out infinite',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </section>
  )
}

// ── Social proof bar ──────────────────────────────────────────────────────────

function SocialProofBar() {
  const stats = [
    { num: '488+', label: 'Stocks tracked' },
    { num: '5',    label: 'Greeks tracked per portfolio' },
    { num: '$3,500+', label: 'avg monthly premium tracked' },
    { num: '14-day',  label: 'free trial on Pro' },
  ]

  return (
    <div style={{
      background: '#050d1a',
      borderTop: '0.5px solid rgba(0,229,196,0.08)',
      borderBottom: '0.5px solid rgba(0,229,196,0.08)',
      padding: '28px 24px',
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'center', gap: 0,
      }}>
        {stats.map(({ num, label }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: '0 40px' }}>
              <div style={{
                fontSize: 28, fontWeight: 700, color: '#e8f0fe',
                fontFamily: 'Syne, sans-serif', lineHeight: 1,
              }}>
                {num}
              </div>
              <div style={{
                fontSize: 12, color: '#4a6a8a',
                fontFamily: 'DM Sans, sans-serif', marginTop: 4,
              }}>
                {label}
              </div>
            </div>
            {i < stats.length - 1 && (
              <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }} className="hidden sm:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Problem section ───────────────────────────────────────────────────────────

function ProblemSection() {
  const xIcon = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="7" cy="7" r="6.5" fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.3)" strokeWidth="0.8"/>
      <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
  const checkIcon = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="7" cy="7" r="6.5" fill="rgba(20,184,166,0.12)" stroke="rgba(20,184,166,0.3)" strokeWidth="0.8"/>
      <path d="M4 7.5l2 2 4-4" stroke="#14b8a6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  const pains = [
    'Manually calculating IV rank on each stock every morning',
    'Spreadsheets with broken formulas after every assignment',
    'No idea what your daily theta income actually is',
    'Missing earnings announcements before selling premium',
    'Switching between broker, TradingView, and Excel to make one simple decision',
  ]

  const solutions = [
    '488 stocks screened for IV rank every morning automatically',
    'Assignment tracking with true cost basis across full cycles',
    'Daily theta income shown as your largest number',
    'Earnings badges on every screener row — never miss one',
    'One dashboard that shows you everything you need to act',
  ]

  return (
    <section id="problem" style={{ background: '#0a1628', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', padding: '4px 14px', borderRadius: 20,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              fontFamily: 'DM Sans, sans-serif', marginBottom: 16,
            }}>
              The problem
            </div>
            <h2 style={{
              margin: 0, fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 700,
              color: '#e8f0fe', fontFamily: 'Syne, sans-serif',
              letterSpacing: '-0.5px', maxWidth: 600,
            }}>
              Tracking the wheel in a spreadsheet is a full-time job
            </h2>
          </div>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          <FadeIn delay={80}>
            <div style={{
              background: 'rgba(239,68,68,0.04)',
              border: '0.5px solid rgba(239,68,68,0.2)',
              borderRadius: 12, padding: '24px 28px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', marginBottom: 20 }}>
                Without Premium Hunter
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {pains.map(p => (
                  <div key={p} style={{ display: 'flex', gap: 10 }}>
                    {xIcon}
                    <span style={{ fontSize: 14, color: '#9ab4d4', lineHeight: 1.55, fontFamily: 'DM Sans, sans-serif' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={160}>
            <div style={{
              background: 'rgba(20,184,166,0.04)',
              border: '0.5px solid rgba(20,184,166,0.3)',
              borderRadius: 12, padding: '24px 28px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#14b8a6', fontFamily: 'DM Sans, sans-serif', marginBottom: 20 }}>
                With Premium Hunter
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {solutions.map(s => (
                  <div key={s} style={{ display: 'flex', gap: 10 }}>
                    {checkIcon}
                    <span style={{ fontSize: 14, color: '#e8f0fe', lineHeight: 1.55, fontFamily: 'DM Sans, sans-serif' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

// ── Feature mocks ─────────────────────────────────────────────────────────────

function ScreenerMock() {
  const rows = [
    { ticker: 'GME',  price: '$26.40', rank: 82, trend: '↑', trendLabel: 'Rising',  trendColor: '#14b8a6', ann: '34%', highlight: true },
    { ticker: 'MARA', price: '$18.20', rank: 74, trend: '→', trendLabel: 'Stable',  trendColor: '#9ab4d4', ann: '28%', highlight: false },
    { ticker: 'SOFI', price: '$11.30', rank: 68, trend: '↑', trendLabel: 'Rising',  trendColor: '#14b8a6', ann: '22%', highlight: false },
    { ticker: 'COIN', price: '$195.0', rank: 61, trend: '↓', trendLabel: 'Falling', trendColor: '#f59e0b', ann: '18%', highlight: false },
    { ticker: 'TSLA', price: '$248.0', rank: 52, trend: '→', trendLabel: 'Stable',  trendColor: '#9ab4d4', ann: '15%', highlight: false },
  ]

  const rankColor = (r: number) => r >= 80 ? '#ff4d6d' : r >= 60 ? '#f97316' : r >= 30 ? '#f5c842' : '#00d68f'

  return (
    <div style={{
      background: 'rgba(5,13,26,0.9)',
      border: '1px solid rgba(0,229,196,0.12)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '80px 1fr 120px 80px 60px',
        padding: '10px 16px', background: 'rgba(0,0,0,0.25)',
        borderBottom: '1px solid rgba(0,229,196,0.08)',
      }}>
        {['Symbol', 'Price', 'IV Rank', 'Trend', 'Ann.'].map(h => (
          <div key={h} style={{ fontSize: 10, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.ticker} style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 120px 80px 60px',
          padding: '11px 16px', alignItems: 'center',
          borderBottom: '1px solid rgba(0,229,196,0.05)',
          background: row.highlight ? 'rgba(20,184,166,0.06)' : 'transparent',
          borderLeft: row.highlight ? '3px solid #14b8a6' : '3px solid transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f0fe', fontFamily: 'Syne, sans-serif' }}>{row.ticker}</span>
            {row.highlight && (
              <span style={{
                fontSize: 8, padding: '1px 5px', borderRadius: 4,
                background: 'rgba(20,184,166,0.2)', color: '#14b8a6',
                fontFamily: 'DM Sans, sans-serif', fontWeight: 700, whiteSpace: 'nowrap',
              }}>TOP</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>{row.price}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${row.rank}%`, height: '100%', background: rankColor(row.rank), borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: rankColor(row.rank), fontFamily: 'JetBrains Mono, monospace', width: 24, textAlign: 'right' }}>{row.rank}</span>
          </div>
          <div style={{ fontSize: 12, color: row.trendColor, fontFamily: 'DM Sans, sans-serif' }}>
            {row.trend} {row.trendLabel}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#14b8a6', fontFamily: 'JetBrains Mono, monospace' }}>{row.ann}</div>
        </div>
      ))}

      {/* Bottom pick */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(20,184,166,0.07)',
        borderTop: '1px solid rgba(20,184,166,0.12)',
      }}>
        <div style={{ fontSize: 11, color: '#14b8a6', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
          🏆 Top CSP pick: GME $24 Feb 21 · est. $1.20 premium · 34% ann.
        </div>
      </div>
    </div>
  )
}

function WheelTrackerMock() {
  const positions = [
    {
      type: 'CSP', ticker: 'GME', strike: '$24', exp: 'Feb 21', dte: 14,
      stock: '$26.40', relation: '10.0% above strike', warning: false,
      prob: 22, dots: [true,true,true,false,false], theta: '+$4.80', progress: 68,
      borderColor: 'transparent',
    },
    {
      type: 'CC', ticker: 'SOFI', strike: '$12', exp: 'Feb 21', dte: 14,
      stock: '$11.30', relation: '$0.70 below strike', warning: true,
      prob: 38, dots: [true,true,true,true,false], theta: '+$2.10', progress: 42,
      borderColor: '#f59e0b',
    },
    {
      type: 'CSP', ticker: 'MARA', strike: '$16', exp: 'Feb 21', dte: 14,
      stock: '$18.20', relation: '12.5% above strike', warning: false,
      prob: 18, dots: [true,true,false,false,false], theta: '+$3.20', progress: 61,
      borderColor: 'transparent',
    },
  ]

  return (
    <div style={{
      background: 'rgba(5,13,26,0.9)',
      border: '1px solid rgba(0,229,196,0.12)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {positions.map((pos, i) => (
        <div key={i} style={{
          padding: '14px 16px',
          borderBottom: i < positions.length - 1 ? '1px solid rgba(0,229,196,0.07)' : 'none',
          borderLeft: `3px solid ${pos.borderColor}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                background: pos.type === 'CSP' ? 'rgba(20,184,166,0.15)' : 'rgba(245,200,66,0.15)',
                color: pos.type === 'CSP' ? '#14b8a6' : '#f5c842',
                fontFamily: 'JetBrains Mono, monospace',
              }}>{pos.type}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e8f0fe', fontFamily: 'Syne, sans-serif' }}>
                {pos.ticker} {pos.strike}
              </span>
              <span style={{ fontSize: 11, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                · {pos.exp} · {pos.dte} DTE
              </span>
            </div>
            {pos.warning && <span style={{ fontSize: 12 }}>⚠</span>}
          </div>
          <div style={{ fontSize: 11, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', marginBottom: 8 }}>
            Stock: {pos.stock} · {pos.relation}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {pos.dots.map((filled, di) => (
                <div key={di} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: filled ? (pos.prob >= 35 ? '#f59e0b' : '#14b8a6') : 'rgba(255,255,255,0.12)',
                }} />
              ))}
              <span style={{ fontSize: 11, color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>
                {pos.prob}% · {pos.theta}/day θ
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{pos.progress}% captured</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${pos.progress}%`, height: '100%', background: '#14b8a6', borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function GreeksMock() {
  const greeks = [
    { symbol: 'Δ', name: 'Delta',  value: '+42.1',    unit: '',       context: 'Slightly bullish', color: '#9ab4d4', tint: false },
    { symbol: 'Θ', name: 'Theta',  value: '+$47.23',  unit: '/day',   context: 'Working for you',  color: '#14b8a6', tint: true  },
    { symbol: 'V', name: 'Vega',   value: '−$31.40',  unit: '',       context: 'Short volatility',  color: '#f59e0b', tint: false },
    { symbol: 'Γ', name: 'Gamma',  value: '−0.0234',  unit: '',       context: 'Low gamma risk',   color: '#9ab4d4', tint: false },
  ]

  return (
    <div style={{
      background: 'rgba(5,13,26,0.9)',
      border: '1px solid rgba(0,229,196,0.12)',
      borderRadius: 14, padding: 20,
    }}>
      {/* Big theta */}
      <div style={{ textAlign: 'center', marginBottom: 20, padding: '16px 0' }}>
        <div style={{ fontSize: 11, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          Daily theta income
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, color: '#14b8a6', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
          +$47.23
        </div>
        <div style={{ fontSize: 11, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', marginTop: 6 }}>
          You earn this today from time decay alone
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(0,229,196,0.08)', marginBottom: 16 }} />

      {/* Greek grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {greeks.map(g => (
          <div key={g.name} style={{
            background: g.tint ? 'rgba(20,184,166,0.07)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${g.tint ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: g.color, fontFamily: 'Syne, sans-serif' }}>{g.symbol}</span>
              <span style={{ fontSize: 10, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{g.name}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: g.color, fontFamily: 'JetBrains Mono, monospace', marginBottom: 3 }}>
              {g.value}<span style={{ fontSize: 11, fontWeight: 400 }}>{g.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{g.context}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardMock() {
  return (
    <div style={{
      background: 'rgba(5,13,26,0.9)',
      border: '1px solid rgba(0,229,196,0.12)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Greeting */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.25)',
        borderBottom: '1px solid rgba(0,229,196,0.07)',
        fontSize: 12, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>Good morning</span>
        <span>·</span>
        <span>Tuesday</span>
        <span>·</span>
        <span>Market opens in 1h 14m</span>
      </div>

      {/* Insight card */}
      <div style={{
        margin: '14px 16px',
        borderLeft: '3px solid #14b8a6',
        background: 'rgba(20,184,166,0.06)',
        borderRadius: '0 10px 10px 0',
        padding: '12px 14px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif', marginBottom: 4 }}>
          🎯 MARA at 74 IV rank — elevated premium
        </div>
        <div style={{ fontSize: 12, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5, marginBottom: 8 }}>
          Estimated 28% annualised at 30-delta. IV trend is rising — conditions improving.
        </div>
        <button style={{
          fontSize: 11, color: '#14b8a6', background: 'none', border: 'none',
          cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
        }}>
          View in screener →
        </button>
      </div>

      {/* Stats */}
      <div style={{ padding: '0 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[
          'This month: $2,840',
          'Win rate: 84%',
          '🔥 Streak: 6',
          'Open: 4',
          'Target: 81% ▓▓▓▓▓▓▓▓░░',
        ].map(stat => (
          <div key={stat} style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace',
            whiteSpace: 'nowrap',
          }}>
            {stat}
          </div>
        ))}
      </div>
    </div>
  )
}

function AIBriefingMock() {
  return (
    <div style={{
      background: 'rgba(5,13,26,0.9)',
      border: '1px solid rgba(0,229,196,0.12)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.25)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif' }}>
          AI Morning Briefing · Tuesday Jan 21
        </div>
        <div style={{
          fontSize: 9, padding: '2px 8px', borderRadius: 10,
          background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
          border: '1px solid rgba(245,158,11,0.25)',
          fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
        }}>
          AI-generated
        </div>
      </div>

      {[
        {
          title: 'Top opportunity today',
          color: '#14b8a6',
          content: (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif', marginBottom: 4 }}>SOFI — CSP $10 Feb 21</div>
              <div style={{ fontSize: 12, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
                IV rank 74 (surging) · earnings safe (38 days) · est. $0.85 premium, 22% ann.<br/>
                Liquidity: high · Recommended contracts: 2
              </div>
            </div>
          ),
        },
        {
          title: 'Watchlist alert',
          color: '#f59e0b',
          content: (
            <div style={{ fontSize: 12, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
              <span style={{ color: '#e8f0fe', fontWeight: 600 }}>GME</span> IV rank spiked 62 → 82 overnight. Premium has expanded significantly — elevated conditions for new positions.
            </div>
          ),
        },
        {
          title: 'Position update',
          color: '#9ab4d4',
          content: (
            <div style={{ fontSize: 12, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
              <span style={{ color: '#e8f0fe', fontWeight: 600 }}>MARA CSP $16</span> at 61% max profit with 14 DTE. Theta is accelerating — time decay working in your favour.
            </div>
          ),
        },
      ].map(({ title, color, content }, i, arr) => (
        <div key={title} style={{
          padding: '14px 16px',
          borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color, fontFamily: 'DM Sans, sans-serif',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
          }}>
            {title}
          </div>
          {content}
        </div>
      ))}
    </div>
  )
}

// ── Feature section builder ───────────────────────────────────────────────────

interface FeatureConfig {
  id: string
  pillLabel: string
  pillBg: string
  pillBorder: string
  pillColor: string
  heading: string
  description: string
  bullets: string[]
  badge?: string
  badgeBg?: string
  badgeColor?: string
  badgeBorder?: string
  mock: React.ReactNode
  textRight?: boolean
  bg: string
}

function FeatureSection({ config }: { config: FeatureConfig }) {
  const textCol = (
    <FadeIn>
      <div>
        <div className="lp-feature-pill" style={{
          background: config.pillBg,
          border: `1px solid ${config.pillBorder}`,
          color: config.pillColor,
        }}>
          {config.pillLabel}
        </div>

        <h3 style={{
          margin: '0 0 14px',
          fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 700,
          color: '#e8f0fe', fontFamily: 'Syne, sans-serif',
          letterSpacing: '-0.4px', lineHeight: 1.2,
        }}>
          {config.heading}
        </h3>

        <p style={{
          margin: '0 0 20px', fontSize: 16, color: '#9ab4d4',
          lineHeight: 1.7, maxWidth: 420, fontFamily: 'DM Sans, sans-serif',
        }}>
          {config.description}
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {config.bullets.map(b => (
            <li key={b} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: '#14b8a6', fontSize: 14, marginTop: 1, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 14, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>{b}</span>
            </li>
          ))}
        </ul>

        {config.badge && (
          <div style={{
            display: 'inline-flex', padding: '4px 12px', borderRadius: 6,
            background: config.badgeBg, color: config.badgeColor,
            fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
            border: `1px solid ${config.badgeBorder}`,
          } as React.CSSProperties}>
            {config.badge}
          </div>
        )}
      </div>
    </FadeIn>
  )

  const mockCol = (
    <FadeIn delay={100}>
      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto' }}>
        {config.mock}
      </div>
    </FadeIn>
  )

  return (
    <section style={{ background: config.bg, padding: '88px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 60, alignItems: 'center',
        }}>
          {config.textRight ? <>{mockCol}{textCol}</> : <>{textCol}{mockCol}</>}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const features: FeatureConfig[] = [
    {
      id: 'feature-screener',
      pillLabel: 'Screener', pillBg: 'rgba(20,184,166,0.1)', pillBorder: 'rgba(20,184,166,0.25)', pillColor: '#14b8a6',
      heading: 'Know exactly when to sell premium',
      description: '488 stocks ranked by IV rank every morning. Never again wonder if today\'s IV is historically cheap or expensive — the screener tells you instantly.',
      bullets: [
        'IV rank from 0–100 across 488 curated stocks',
        'IV trend arrows showing 5-day momentum',
        'Top 5 CSP and CC picks calculated daily',
      ],
      badge: 'Pro feature', badgeBg: 'rgba(20,184,166,0.1)', badgeColor: '#14b8a6', badgeBorder: 'rgba(20,184,166,0.2)',
      mock: <ScreenerMock />, textRight: false, bg: '#050d1a',
    },
    {
      id: 'feature-tracker',
      pillLabel: 'Tracker', pillBg: 'rgba(139,92,246,0.1)', pillBorder: 'rgba(139,92,246,0.25)', pillColor: '#a78bfa',
      heading: 'Your complete wheel position history',
      description: 'Track every CSP, every assignment, every covered call. See your true cost basis — accounting for every dollar of premium you\'ve collected.',
      bullets: [
        'Live prices update via WebSocket during market hours',
        'Assignment probability gauge on every position',
        'True cost basis tracked across full wheel cycles',
      ],
      badge: 'Pro feature', badgeBg: 'rgba(139,92,246,0.1)', badgeColor: '#a78bfa', badgeBorder: 'rgba(139,92,246,0.2)',
      mock: <WheelTrackerMock />, textRight: true, bg: '#0a1628',
    },
    {
      id: 'feature-greeks',
      pillLabel: 'Greeks', pillBg: 'rgba(245,158,11,0.1)', pillBorder: 'rgba(245,158,11,0.25)', pillColor: '#f59e0b',
      heading: 'Your daily theta income at a glance',
      description: 'See the aggregate Greeks across your entire portfolio. Know exactly how much time decay is earning you money today — even if the market doesn\'t move.',
      bullets: [
        'Total daily theta shown as the dominant dashboard number',
        'Delta, gamma, vega aggregated across all positions',
        'Scenario analysis: what if stocks drop 10%?',
      ],
      badge: 'Pro feature', badgeBg: 'rgba(245,158,11,0.1)', badgeColor: '#f59e0b', badgeBorder: 'rgba(245,158,11,0.2)',
      mock: <GreeksMock />, textRight: false, bg: '#050d1a',
    },
    {
      id: 'feature-dashboard',
      pillLabel: 'Dashboard', pillBg: 'rgba(59,130,246,0.1)', pillBorder: 'rgba(59,130,246,0.25)', pillColor: '#60a5fa',
      heading: 'Your trading day starts here',
      description: 'An intelligent morning briefing built from your actual positions, screener data, and monthly targets. Everything that matters, nothing that doesn\'t.',
      bullets: [
        'Primary insight card updates based on your situation',
        'Monthly income target progress updated in real time',
        'Positions intelligence — every open position at a glance',
      ],
      badge: 'Pro feature', badgeBg: 'rgba(59,130,246,0.1)', badgeColor: '#60a5fa', badgeBorder: 'rgba(59,130,246,0.2)',
      mock: <DashboardMock />, textRight: true, bg: '#0a1628',
    },
    {
      id: 'feature-ai',
      pillLabel: 'AI', pillBg: 'rgba(239,68,68,0.1)', pillBorder: 'rgba(239,68,68,0.25)', pillColor: '#f87171',
      heading: 'Daily AI picks built on your strategy',
      description: 'Every morning, an AI analyses your watchlist, current market conditions, and your trading history to surface the most relevant opportunities for your account.',
      bullets: [
        'Personalised to your watchlist and account size',
        'Explains the reasoning behind every pick',
        'Morning briefing email delivered before market open',
      ],
      badge: 'Pro feature', badgeBg: 'rgba(239,68,68,0.1)', badgeColor: '#f87171', badgeBorder: 'rgba(239,68,68,0.2)',
      mock: <AIBriefingMock />, textRight: false, bg: '#050d1a',
    },
  ]

  return (
    <div id="features">
      {features.map(config => (
        <FeatureSection key={config.id} config={config} />
      ))}
    </div>
  )
}

// ── How it works ──────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const navigate = useNavigate()
  const steps = [
    {
      num: '01', icon: '📊',
      title: 'Find high-IV opportunities',
      desc: 'Open the screener each morning. The top picks engine surfaces the 5 best CSP and CC candidates ranked by IV rank, earnings safety, and estimated return.',
    },
    {
      num: '02', icon: '📝',
      title: 'Log your positions',
      desc: 'Enter your CSPs and covered calls as you open them. Premium Hunter tracks DTE, assignment probability, daily theta, and cost basis automatically.',
    },
    {
      num: '03', icon: '📈',
      title: 'Watch premium compound',
      desc: 'Every expiry cycle, see your premium income tracked against your monthly target. Watch your theta work for you daily — even when the market is flat.',
    },
  ]

  return (
    <section id="how-it-works" style={{ background: '#050d1a', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{
              display: 'inline-flex', padding: '4px 14px', borderRadius: 20,
              background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)',
              color: '#14b8a6', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              fontFamily: 'DM Sans, sans-serif', marginBottom: 16,
            }}>
              How it works
            </div>
            <h2 style={{
              margin: '0 0 12px',
              fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 700,
              color: '#e8f0fe', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px',
            }}>
              From zero to wheeling in minutes
            </h2>
            <p style={{ margin: 0, fontSize: 16, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
              Premium Hunter is built around the wheel strategy workflow — screen, enter, track, collect.
            </p>
          </div>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 48 }}>
          {steps.map((step, i) => (
            <FadeIn key={step.num} delay={i * 80}>
              <div style={{
                background: '#0a1628',
                border: '0.5px solid rgba(0,229,196,0.1)',
                borderRadius: 14, padding: '28px 24px',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Decorative big number */}
                <div style={{
                  position: 'absolute', top: 8, right: 16,
                  fontSize: 72, fontWeight: 800,
                  color: 'rgba(20,184,166,0.06)',
                  fontFamily: 'Syne, sans-serif', lineHeight: 1,
                  pointerEvents: 'none', userSelect: 'none',
                }}>
                  {step.num}
                </div>

                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(20,184,166,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, marginBottom: 16,
                }}>
                  {step.icon}
                </div>

                <h3 style={{
                  margin: '0 0 10px', fontSize: 16, fontWeight: 600,
                  color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif',
                }}>
                  {step.title}
                </h3>
                <p style={{
                  margin: 0, fontSize: 14, color: '#4a6a8a',
                  lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif',
                }}>
                  {step.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={240}>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => navigate('/signup')}
              style={{
                background: '#14b8a6', color: '#0f1923',
                border: 'none', borderRadius: 10,
                padding: '13px 32px', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            >
              Try it free — start with paper trading
            </button>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ── Who it's for ──────────────────────────────────────────────────────────────

function WhoItsForSection() {
  const personas = [
    {
      icon: '🌱', title: 'New to the wheel',
      desc: 'Start with paper trading — full access for free, forever. Practice with $100,000 in virtual money until you\'re confident going live.',
      tag: 'Free plan', tagBg: 'rgba(255,255,255,0.07)', tagColor: '#9ab4d4', tagBorder: 'rgba(255,255,255,0.12)',
      highlight: false,
    },
    {
      icon: '⚙️', title: 'Active wheel trader',
      desc: 'You run 3–6 positions monthly and want to know your IV rank entry conditions, see assignment probability in real time, and track monthly income.',
      tag: 'Pro plan', tagBg: 'rgba(20,184,166,0.12)', tagColor: '#14b8a6', tagBorder: 'rgba(20,184,166,0.25)',
      highlight: true,
    },
    {
      icon: '🎯', title: 'Income-focused trader',
      desc: 'The wheel is your primary income strategy. You need portfolio Greeks, cost basis tracking, AI picks, and a morning briefing before the market opens.',
      tag: 'Pro plan', tagBg: 'rgba(20,184,166,0.12)', tagColor: '#14b8a6', tagBorder: 'rgba(20,184,166,0.25)',
      highlight: false,
    },
  ]

  return (
    <section style={{ background: '#0a1628', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', padding: '4px 14px', borderRadius: 20,
              background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)',
              color: '#14b8a6', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              fontFamily: 'DM Sans, sans-serif', marginBottom: 16,
            }}>
              Who it's for
            </div>
            <h2 style={{
              margin: 0, fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 700,
              color: '#e8f0fe', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px',
            }}>
              Built for wheel traders at every stage
            </h2>
          </div>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {personas.map((p, i) => (
            <FadeIn key={p.title} delay={i * 80}>
              <div style={{
                background: 'rgba(13,27,53,0.5)',
                border: p.highlight ? '1px solid rgba(20,184,166,0.4)' : '0.5px solid rgba(0,229,196,0.1)',
                borderRadius: 14, padding: '28px 24px',
                position: 'relative',
              }}>
                {p.highlight && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    padding: '3px 14px', borderRadius: 20,
                    background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)',
                    color: '#14b8a6', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                    fontFamily: 'DM Sans, sans-serif',
                  }}>
                    Most common
                  </div>
                )}

                <div style={{ fontSize: 32, marginBottom: 16 }}>{p.icon}</div>

                <h3 style={{
                  margin: '0 0 10px', fontSize: 17, fontWeight: 600,
                  color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif',
                }}>
                  {p.title}
                </h3>

                <p style={{
                  margin: '0 0 20px', fontSize: 14, color: '#9ab4d4',
                  lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif',
                }}>
                  {p.desc}
                </p>

                <div style={{
                  display: 'inline-flex', padding: '4px 12px', borderRadius: 20,
                  background: p.tagBg, border: `1px solid ${p.tagBorder}`,
                  color: p.tagColor, fontSize: 11, fontWeight: 600,
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                  {p.tag}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Testimonials ──────────────────────────────────────────────────────────────

function TestimonialsSection() {
  const testimonials = [
    {
      quote: '"The IV screener alone is worth it. I used to spend 30 minutes every morning checking TradingView for each stock manually. Now I open Premium Hunter and the top picks are right there."',
      name: 'Alex T.',
      role: 'Wheel trader, 2 years',
    },
    {
      quote: '"Seeing my daily theta income as the biggest number on the dashboard completely changed how I think about the strategy. Time decay isn\'t abstract anymore — it\'s $47 today whether the market moves or not."',
      name: 'Marcus W.',
      role: 'Options income trader',
    },
    {
      quote: '"The paper trading mode let me practice for two months before going live. By the time I started with real money I already knew exactly what I was doing. No other tool has this."',
      name: 'Sarah K.',
      role: 'Beginner turned active trader',
    },
  ]

  return (
    <section style={{ background: '#050d1a', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', padding: '4px 14px', borderRadius: 20,
              background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)',
              color: '#14b8a6', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              fontFamily: 'DM Sans, sans-serif', marginBottom: 16,
            }}>
              What traders say
            </div>
            <h2 style={{
              margin: 0, fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 700,
              color: '#e8f0fe', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px',
            }}>
              Trusted by wheel traders
            </h2>
          </div>
        </FadeIn>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {testimonials.map((t, i) => (
            <FadeIn key={t.name} delay={i * 80}>
              <div style={{
                background: '#0a1628',
                border: '0.5px solid rgba(0,229,196,0.1)',
                borderRadius: 14, padding: '24px',
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                {/* Stars */}
                <div style={{ color: '#14b8a6', fontSize: 14, letterSpacing: 2 }}>★★★★★</div>

                <blockquote style={{
                  margin: 0, flex: 1,
                  fontSize: 14, color: '#9ab4d4',
                  lineHeight: 1.7, fontStyle: 'italic',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                  {t.quote}
                </blockquote>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
                    {t.role}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing section ───────────────────────────────────────────────────────────

function PricingSection() {
  return (
    <section id="pricing" style={{ background: '#0a1628', padding: '96px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', padding: '4px 14px', borderRadius: 20,
              background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)',
              color: '#14b8a6', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              fontFamily: 'DM Sans, sans-serif', marginBottom: 16,
            }}>
              Pricing
            </div>
            <h2 style={{
              margin: '0 0 12px',
              fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 700,
              color: '#e8f0fe', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px',
            }}>
              Start free. Upgrade when you're ready.
            </h2>
            <p style={{
              margin: 0, fontSize: 16, color: '#4a6a8a',
              fontFamily: 'DM Sans, sans-serif', maxWidth: 420,
              marginLeft: 'auto', marginRight: 'auto',
            }}>
              Paper trading is free forever. Upgrade to Pro when you want to trade with real money.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={80}>
          <div style={{ maxWidth: 760, margin: '0 auto 24px' }}>
            <PricingCards isLanding />
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <p style={{
            textAlign: 'center', fontSize: 13, color: '#4a6a8a',
            fontFamily: 'DM Sans, sans-serif', margin: 0,
          }}>
            Questions? Email us at{' '}
            <a
              href="mailto:premiumhuntersupport@gmail.com"
              style={{ color: '#14b8a6', textDecoration: 'none' }}
            >
              premiumhuntersupport@gmail.com
            </a>
          </p>
        </FadeIn>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'Is Premium Hunter suitable for beginners?',
    a: 'Absolutely. The free plan includes full paper trading with $100,000 in virtual money. You can practice the wheel strategy, track paper positions, and learn how IV rank affects premium — all before risking a single dollar. Most users paper trade for 4–8 weeks before going live.',
  },
  {
    q: 'What is the wheel strategy?',
    a: "The wheel strategy is a systematic options income strategy. You sell cash-secured puts on stocks you want to own. If the put expires worthless you keep the premium. If assigned you own the shares and start selling covered calls against them. Premium Hunter is built specifically around this strategy — every feature is designed for wheel traders.",
  },
  {
    q: 'How do I get Pro access?',
    a: "We're currently onboarding Pro users personally. Send us an email at premiumhuntersupport@gmail.com with your account email and we'll activate Pro access within a few hours. We're happy to set up a trial period so you can explore the full toolkit first.",
  },
  {
    q: 'Is this financial advice?',
    a: 'No. Premium Hunter is an educational and tracking tool only. Nothing on the platform constitutes financial advice, investment advice, or trading recommendations. All trading decisions are made entirely at your own risk. Please read our full disclaimer in the app.',
  },
  {
    q: 'What data sources does Premium Hunter use?',
    a: 'IV rank data is calculated nightly using historical price data from Polygon.io. Live prices during market hours use Finnhub\'s WebSocket feed. Options chain data uses Polygon\'s snapshot API. All data is cached in Supabase and updated on a schedule.',
  },
  {
    q: 'Can I import my existing positions?',
    a: 'Currently positions are entered manually which takes about 30 seconds per position. Broker integration via the IBKR Client Portal API is on the roadmap — when live, positions will sync automatically.',
  },
]

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const answerRefs = useRef<(HTMLDivElement | null)[]>([])

  return (
    <section style={{ background: '#050d1a', padding: '96px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <FadeIn>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', padding: '4px 14px', borderRadius: 20,
              background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)',
              color: '#14b8a6', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              fontFamily: 'DM Sans, sans-serif', marginBottom: 16,
            }}>
              FAQ
            </div>
            <h2 style={{
              margin: 0, fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 700,
              color: '#e8f0fe', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px',
            }}>
              Common questions
            </h2>
          </div>
        </FadeIn>

        <FadeIn delay={60}>
          <div style={{
            background: '#0a1628',
            border: '0.5px solid rgba(0,229,196,0.1)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i
              return (
                <div
                  key={i}
                  style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '0.5px solid rgba(0,229,196,0.08)' : 'none' }}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    style={{
                      width: '100%', padding: '18px 24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      fontSize: 14, fontWeight: 500, color: '#e8f0fe',
                      fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4,
                    }}>
                      {item.q}
                    </span>
                    <span style={{
                      flexShrink: 0, width: 20, height: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#14b8a6', fontSize: 18, fontWeight: 300,
                      transition: 'transform 0.2s ease',
                      transform: isOpen ? 'rotate(45deg)' : 'rotate(0)',
                    }}>
                      +
                    </span>
                  </button>

                  <div
                    ref={el => { answerRefs.current[i] = el }}
                    style={{
                      maxHeight: isOpen ? 300 : 0,
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease',
                    }}
                  >
                    <div style={{ padding: '0 24px 18px' }}>
                      <p style={{
                        margin: 0, fontSize: 14, color: '#9ab4d4',
                        lineHeight: 1.75, fontFamily: 'DM Sans, sans-serif',
                      }}>
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCTASection() {
  const navigate = useNavigate()

  return (
    <section style={{
      background: '#0d7060', padding: '80px 24px', textAlign: 'center',
    }}>
      <h2 style={{
        margin: '0 0 12px',
        fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700,
        color: '#ffffff', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px',
      }}>
        Start tracking your wheel today
      </h2>
      <p style={{
        margin: '0 0 32px', fontSize: 18, fontWeight: 400,
        color: 'rgba(255,255,255,0.7)', fontFamily: 'DM Sans, sans-serif',
      }}>
        Free paper trading. No credit card. Takes 60 seconds.
      </p>
      <button
        onClick={() => navigate('/signup')}
        style={{
          background: '#ffffff', color: '#0d7060',
          border: 'none', borderRadius: 10,
          padding: '14px 36px', fontSize: 16, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          transition: 'opacity 0.15s ease',
          display: 'inline-block', marginBottom: 16,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
      >
        Create free account
      </button>
      <p style={{
        margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)',
        fontFamily: 'DM Sans, sans-serif',
      }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'rgba(255,255,255,0.65)', textDecoration: 'underline' }}>
          Sign in
        </Link>
      </p>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer style={{ background: '#0a1628', padding: '48px 24px 32px', color: 'rgba(255,255,255,0.5)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 40 }}>
          {/* Brand */}
          <div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: '#14b8a6',
              fontFamily: 'Syne, sans-serif', letterSpacing: '-0.5px', marginBottom: 8,
            }}>
              Premium Hunter
            </div>
            <div style={{ fontSize: 13, marginBottom: 16, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
              The wheel options strategy tracker
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'DM Sans, sans-serif' }}>
              © 2026 Premium Hunter. All rights reserved.
            </div>
          </div>

          {/* Product */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Product
            </div>
            {[
              { label: 'Features',      action: () => scrollTo('features') },
              { label: 'How it works',  action: () => scrollTo('how-it-works') },
              { label: 'Pricing',       action: () => scrollTo('pricing') },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  display: 'block', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif',
                  padding: '4px 0', textAlign: 'left',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9ab4d4' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)' }}
              >
                {label}
              </button>
            ))}
            <Link
              to="/help"
              style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif', padding: '4px 0', textDecoration: 'none' }}
            >
              Help
            </Link>
          </div>

          {/* Support */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Support
            </div>
            <a href="mailto:premiumhuntersupport@gmail.com" style={{
              display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)',
              fontFamily: 'DM Sans, sans-serif', padding: '4px 0',
              textDecoration: 'none', wordBreak: 'break-all',
            }}>
              premiumhuntersupport@gmail.com
            </a>
            {[
              { label: 'Sign in', to: '/login' },
              { label: 'Create account', to: '/signup' },
            ].map(({ label, to }) => (
              <Link key={label} to={to} style={{
                display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.45)',
                fontFamily: 'DM Sans, sans-serif', padding: '4px 0', textDecoration: 'none',
              }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingTop: 20, marginTop: 8,
        }}>
          <p style={{
            margin: 0, fontSize: 11,
            color: 'rgba(255,255,255,0.28)',
            fontFamily: 'DM Sans, sans-serif',
            lineHeight: 1.7, textAlign: 'center', maxWidth: 800, marginLeft: 'auto', marginRight: 'auto',
          }}>
            Premium Hunter is an educational and informational tool only. Nothing on this platform
            constitutes financial advice, investment advice, or trading recommendations. All trading
            decisions are made entirely at your own risk. The Premium Hunter Team bears no liability
            for any financial losses incurred through use of this platform. Options trading involves
            significant risk and is not suitable for all investors. Past performance does not
            indicate future results.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  // Inject keyframes + landing-specific styles once
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'lp-styles'
    el.textContent = LANDING_STYLES
    document.head.appendChild(el)
    return () => { document.getElementById('lp-styles')?.remove() }
  }, [])

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: '#0a1628', minHeight: '100vh' }}>
      <LandingNavbar />
      <HeroSection />
      <SocialProofBar />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <WhoItsForSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
      <LandingFooter />
    </div>
  )
}
