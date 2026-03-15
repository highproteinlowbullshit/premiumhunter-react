import { useState } from 'react';
import { usePaperMode } from '../context/PaperModeContext';

export function PaperBanner() {
  const { isPaperMode } = usePaperMode();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('ph_paper_banner_dismissed') === 'true'; } catch { return false; }
  });

  if (!isPaperMode || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem('ph_paper_banner_dismissed', 'true'); } catch { /* ignore */ }
  };

  return (
    <div
      style={{
        background: 'rgba(245,200,66,0.08)',
        borderBottom: '1px solid rgba(245,200,66,0.15)',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#f5c842', fontSize: 14 }}>⚠</span>
        <span style={{ color: '#c9a227', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
          You are in <strong>Paper Trading Mode</strong> — positions here use virtual money and do not affect your real portfolio.
        </span>
      </div>
      <button
        onClick={handleDismiss}
        style={{ color: '#8a7020', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
