import { useEffect } from 'react';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '1 – 5', desc: 'Navigate: Dashboard / Screener / Watchlist / Tracker / Portfolio' },
  { key: 'N', desc: 'New position (Wheel Tracker)' },
  { key: '/', desc: 'Focus search (Screener)' },
  { key: '?', desc: 'Show this shortcuts reference' },
  { key: 'Esc', desc: 'Close any open modal' },
];

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,8,19,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="modal-enter w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'rgba(10,22,40,0.98)', border: '1px solid rgba(0,229,196,0.2)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            Keyboard Shortcuts
          </h2>
          <button
            data-no-min-h
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: '#4a6a8a' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center gap-3">
              <kbd
                className="shrink-0 px-2 py-1 rounded text-xs font-bold"
                style={{
                  background: 'rgba(0,229,196,0.08)',
                  border: '1px solid rgba(0,229,196,0.2)',
                  color: '#00e5c4',
                  fontFamily: 'JetBrains Mono, monospace',
                  minWidth: 28,
                  textAlign: 'center',
                }}
              >
                {key}
              </kbd>
              <span className="text-sm" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
                {desc}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs mt-5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Press <kbd style={{ fontFamily: 'JetBrains Mono, monospace', color: '#6a8fb0' }}>?</kbd> anywhere to show this.
        </p>
      </div>
    </div>
  );
}
