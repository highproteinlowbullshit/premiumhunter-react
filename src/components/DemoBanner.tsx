import { IS_DEMO_MODE } from '../lib/marketData';

export function DemoBanner() {
  if (!IS_DEMO_MODE) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl text-sm"
      style={{
        transform: 'translateX(-50%)',
        background: 'rgba(10, 22, 40, 0.95)',
        border: '1px solid rgba(245,200,66,0.3)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,200,66,0.05)',
        color: '#f5c842',
        fontFamily: 'DM Sans, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '14px' }}>📊</span>
      <span>
        Demo mode — add{' '}
        <code
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: '#00e5c4',
            background: 'rgba(0,229,196,0.1)',
            padding: '1px 4px',
            borderRadius: '4px',
          }}
        >
          VITE_FINNHUB_API_KEY
        </code>
        {' + '}
        <code
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: '#00e5c4',
            background: 'rgba(0,229,196,0.1)',
            padding: '1px 4px',
            borderRadius: '4px',
          }}
        >
          VITE_POLYGON_API_KEY
        </code>
        {' to '}
        <code
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: '#9ab4d4',
          }}
        >
          .env
        </code>
        {' for live data'}
      </span>
    </div>
  );
}
