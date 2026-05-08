import { useState, useRef } from 'react'
import { useDisclaimer } from '../hooks/useDisclaimer'

// Thin-stroke SVG icons matching the app's line-art style
const SECTION_ICONS: Record<string, React.ReactNode> = {
  'alert-triangle': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  'book-open': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  'trending-down': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
      <polyline points="17 18 23 18 23 12"/>
    </svg>
  ),
  'shield-off': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18"/>
      <path d="M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  'bar-chart': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  ),
  'file-text': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  'briefcase': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
}
import {
  DISCLAIMER_SECTIONS,
  CONFIRMATION_STATEMENT,
  CONFIRMATION_PHRASE,
  CURRENT_DISCLAIMER_VERSION,
} from '../lib/disclaimer'

export function DisclaimerModal() {
  const { hasAccepted, isLoading, accept, isAccepting, error } = useDisclaimer()

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [checkboxTicked, setCheckboxTicked] = useState(false)
  const [typedValue, setTypedValue] = useState('')
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  if (isLoading || hasAccepted) return null

  const isTypedCorrect =
    typedValue.trim().toLowerCase() === CONFIRMATION_PHRASE.toLowerCase()

  const canAccept = hasScrolledToBottom && checkboxTicked && isTypedCorrect

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const total = el.scrollHeight - el.clientHeight
    const progress = total > 0 ? Math.round((el.scrollTop / total) * 100) : 100
    setScrollProgress(progress)
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 50) {
      setHasScrolledToBottom(true)
    }
  }

  const handleAccept = () => {
    setAttemptedSubmit(true)
    if (!canAccept) return
    accept(typedValue.trim())
  }

  const unmetReasons: string[] = []
  if (!hasScrolledToBottom) unmetReasons.push('Read the full disclaimer')
  if (!checkboxTicked) unmetReasons.push('Tick the confirmation checkbox')
  if (!isTypedCorrect) unmetReasons.push(`Type "${CONFIRMATION_PHRASE}"`)

  const borderColor = (ok: boolean, attempted: boolean) =>
    ok ? '#14b8a6' : attempted ? '#ef4444' : 'rgba(0,229,196,0.15)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5,12,20,0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 580,
        background: '#0a1628',
        border: '1px solid rgba(0,229,196,0.12)',
        borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        maxHeight: '92vh', overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(0,229,196,0.1)',
          background: 'rgba(239,68,68,0.04)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <h2 style={{
              margin: 0, fontSize: 16, fontWeight: 700,
              color: 'var(--ph-text-1)', fontFamily: 'Syne, sans-serif',
            }}>
              Important Disclaimer
            </h2>
            <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 600,
              color: 'var(--ph-text-3)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(0,229,196,0.1)',
              padding: '2px 8px', borderRadius: 10,
            }}>
              {CURRENT_DISCLAIMER_VERSION}
            </span>
          </div>
          <p style={{
            margin: 0, fontSize: 12, color: '#ef4444',
            lineHeight: 1.5, fontWeight: 500, fontFamily: 'DM Sans, sans-serif',
          }}>
            You must read and accept this disclaimer before using Premium Hunter. This cannot be skipped.
          </p>
        </div>

        {/* Scroll progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            width: `${scrollProgress}%`,
            background: hasScrolledToBottom ? '#14b8a6' : '#f59e0b',
            transition: 'width 0.15s ease, background 0.3s ease',
          }} />
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}
        >
          {/* Intro */}
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, marginBottom: 20,
          }}>
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 500,
              color: 'var(--ph-text-1)', lineHeight: 1.6,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              Premium Hunter is an educational tool only. It does not provide financial advice.
              All trading decisions and any resulting financial outcomes are entirely your own responsibility.
            </p>
          </div>

          {/* Sections */}
          {DISCLAIMER_SECTIONS.map((section, i) => (
            <div key={i} style={{
              marginBottom: 20, paddingBottom: 20,
              borderBottom: i < DISCLAIMER_SECTIONS.length - 1
                ? '1px solid rgba(0,229,196,0.07)' : 'none',
            }}>
              <h3 style={{
                margin: '0 0 8px', fontSize: 13, fontWeight: 700,
                color: 'var(--ph-text-1)', fontFamily: 'Syne, sans-serif',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>{section.icon}</span>
                {section.heading}
              </h3>
              <p style={{
                margin: 0, fontSize: 13,
                color: 'var(--ph-text-2)', lineHeight: 1.75,
                fontFamily: 'DM Sans, sans-serif',
              }}>
                {section.body}
              </p>
            </div>
          ))}

          {/* Confirmation statement — inside scroll so mobile users read it before reaching the controls */}
          <div style={{
            padding: '14px 16px', marginTop: 4,
            background: 'rgba(20,184,166,0.04)',
            border: '1px solid rgba(20,184,166,0.12)',
            borderRadius: 8,
          }}>
            <p style={{
              margin: '0 0 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#14b8a6', fontFamily: 'DM Sans, sans-serif',
            }}>
              By accepting you confirm:
            </p>
            <p style={{
              margin: 0, fontSize: 12, fontStyle: 'italic',
              color: 'var(--ph-text-2)', lineHeight: 1.7,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              "{CONFIRMATION_STATEMENT}"
            </p>
          </div>

          {!hasScrolledToBottom && (
            <div style={{
              textAlign: 'center', padding: '12px 0',
              color: '#f59e0b', fontSize: 12, fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              ↓ Scroll to read the full disclaimer
            </div>
          )}
          <div style={{ height: 8 }} />
        </div>

        {/* Acceptance section */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid rgba(0,229,196,0.1)',
          background: 'rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}>
          {/* Checkbox */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            cursor: hasScrolledToBottom ? 'pointer' : 'not-allowed',
            marginBottom: 14,
            opacity: hasScrolledToBottom ? 1 : 0.4,
          }}>
            <div
              onClick={() => { if (hasScrolledToBottom) setCheckboxTicked(p => !p) }}
              style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                border: `2px solid ${borderColor(checkboxTicked, attemptedSubmit && !checkboxTicked)}`,
                background: checkboxTicked ? '#14b8a6' : 'rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
                cursor: hasScrolledToBottom ? 'pointer' : 'not-allowed',
              }}
            >
              {checkboxTicked && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#0f1923" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={{
              fontSize: 13, color: 'var(--ph-text-1)',
              lineHeight: 1.5, userSelect: 'none',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              I have read and understood the full disclaimer. I accept that Premium Hunter provides
              no financial advice and that all my trades are at my own risk.
            </span>
          </label>

          {/* Type confirmation */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 12,
              color: 'var(--ph-text-2)', marginBottom: 6,
              opacity: hasScrolledToBottom ? 1 : 0.4,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              Type{' '}
              <strong style={{ color: 'var(--ph-text-1)' }}>"{CONFIRMATION_PHRASE}"</strong>
              {' '}to confirm:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={e => setTypedValue(e.target.value)}
              placeholder={`Type "${CONFIRMATION_PHRASE}" here`}
              disabled={!hasScrolledToBottom}
              autoComplete="off"
              style={{
                width: '100%', padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${borderColor(isTypedCorrect, attemptedSubmit && !isTypedCorrect)}`,
                borderRadius: 8, fontSize: 14,
                color: 'var(--ph-text-1)',
                boxSizing: 'border-box', outline: 'none',
                cursor: !hasScrolledToBottom ? 'not-allowed' : 'text',
                opacity: !hasScrolledToBottom ? 0.4 : 1,
                transition: 'border-color 0.15s ease',
                fontFamily: 'DM Sans, sans-serif',
              }}
            />
            {typedValue && !isTypedCorrect && hasScrolledToBottom && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444', fontFamily: 'DM Sans, sans-serif' }}>
                Please type exactly: "{CONFIRMATION_PHRASE}"
              </p>
            )}
            {isTypedCorrect && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#14b8a6', fontFamily: 'DM Sans, sans-serif' }}>
                ✓ Confirmed
              </p>
            )}
          </div>

          {/* Unmet requirements */}
          {attemptedSubmit && !canAccept && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, marginBottom: 12,
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#ef4444', fontFamily: 'DM Sans, sans-serif' }}>
                Please complete the following:
              </p>
              {unmetReasons.map((reason, i) => (
                <p key={i} style={{ margin: '2px 0 0', fontSize: 11, color: '#ef4444', fontFamily: 'DM Sans, sans-serif' }}>
                  · {reason}
                </p>
              ))}
            </div>
          )}

          {/* API error */}
          {error && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, marginBottom: 12,
              fontSize: 12, color: '#ef4444',
              fontFamily: 'DM Sans, sans-serif',
            }}>
              Something went wrong saving your acceptance. Please try again.
            </div>
          )}

          {/* Accept button */}
          <button
            onClick={handleAccept}
            disabled={isAccepting}
            style={{
              width: '100%', padding: 13,
              background: canAccept ? '#14b8a6' : 'rgba(255,255,255,0.04)',
              color: canAccept ? '#0f1923' : 'var(--ph-text-3)',
              border: `1px solid ${canAccept ? 'transparent' : 'rgba(0,229,196,0.1)'}`,
              borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: isAccepting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {isAccepting
              ? 'Recording acceptance...'
              : canAccept
                ? 'I Accept — Enter Premium Hunter →'
                : !hasScrolledToBottom
                  ? '↓ Scroll through the disclaimer first'
                  : !checkboxTicked
                    ? 'Tick the checkbox above to continue'
                    : `Type "${CONFIRMATION_PHRASE}" to continue`}
          </button>

          <p style={{
            margin: '10px 0 0', textAlign: 'center',
            fontSize: 11, color: 'var(--ph-text-3)', lineHeight: 1.6,
            fontFamily: 'DM Sans, sans-serif',
          }}>
            Your acceptance is recorded with a timestamp for legal purposes.
            Version {CURRENT_DISCLAIMER_VERSION} · Last updated January 2026
          </p>
        </div>
      </div>
    </div>
  )
}
