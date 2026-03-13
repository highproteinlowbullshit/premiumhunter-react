import type { WheelPosition } from '../types';

interface PositionTableProps {
  positions: WheelPosition[];
  onRemove?: (id: string) => void;
}

export function PositionTable({ positions, onRemove }: PositionTableProps) {
  if (!positions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0, 229, 196, 0.08)', border: '1px solid rgba(0, 229, 196, 0.15)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
            <circle cx="10" cy="10" r="2.5" fill="#00e5c4" fillOpacity="0.5" />
            <line x1="10" y1="2" x2="10" y2="7.5" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="10" y1="12.5" x2="10" y2="18" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="2" y1="10" x2="7.5" y2="10" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="12.5" y1="10" x2="18" y2="10" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.5" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          No open positions
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile card layout (< sm) ── */}
      <div className="sm:hidden space-y-3">
        {positions.map((pos) => {
          const pnl = pos.premiumCollected - pos.currentPrice * pos.contracts;
          const isPnlPositive = pnl >= 0;
          const dteColor = pos.daysToExpiry <= 7 ? '#ff4d6d' : pos.daysToExpiry <= 21 ? '#f5c842' : '#9ab4d4';

          return (
            <div key={pos.id} className="rounded-xl p-4"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,196,0.08)' }}>
              {/* Row 1: ticker + strategy + actions */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold"
                    style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                    {pos.ticker}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-semibold"
                    style={{
                      color: pos.strategy === 'CSP' ? '#00c6f5' : '#00e5c4',
                      background: pos.strategy === 'CSP' ? 'rgba(0,198,245,0.1)' : 'rgba(0,229,196,0.1)',
                      border: `1px solid ${pos.strategy === 'CSP' ? 'rgba(0,198,245,0.2)' : 'rgba(0,229,196,0.2)'}`,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                    {pos.strategy}
                  </span>
                  <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                    {pos.contracts}x
                  </span>
                </div>
                {onRemove && (
                  <button onClick={() => onRemove(pos.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[rgba(255,77,109,0.12)]"
                    style={{ color: '#4a6a8a' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Row 2: metrics grid */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike</p>
                  <p className="text-sm font-medium" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                    ${pos.strike}
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Premium</p>
                  <p className="text-sm font-medium" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
                    ${pos.premiumCollected}
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>P&amp;L</p>
                  <p className="text-sm font-semibold"
                    style={{ color: isPnlPositive ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
                    {isPnlPositive ? '+' : ''}{pnl.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>DTE</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium" style={{ color: dteColor, fontFamily: 'JetBrains Mono, monospace' }}>
                      {pos.daysToExpiry}d
                    </p>
                    {pos.daysToExpiry <= 7 && (
                      <span className="text-[9px] px-1 py-0.5 rounded"
                        style={{ background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
                        EXP
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: expiry */}
              <p className="text-xs mt-2" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                Expires {pos.expiry}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table layout (sm+) ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {['Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'P&L', 'DTE', ...(onRemove ? [''] : [])].map((h) => (
                <th
                  key={h}
                  className="text-left py-3 px-4 text-xs font-medium tracking-widest uppercase first:pl-0 last:pr-0"
                  style={{ color: '#4a6a8a', borderBottom: '1px solid rgba(0, 229, 196, 0.08)', letterSpacing: '0.08em' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const pnl = pos.premiumCollected - pos.currentPrice * pos.contracts;
              const isPnlPositive = pnl >= 0;
              const dteColor = pos.daysToExpiry <= 7 ? '#ff4d6d' : pos.daysToExpiry <= 21 ? '#f5c842' : '#9ab4d4';

              return (
                <tr
                  key={pos.id}
                  className="stock-row-hover group"
                  style={{
                    borderBottom: i < positions.length - 1 ? '1px solid rgba(0, 229, 196, 0.06)' : 'none',
                  }}
                >
                  <td className="py-3.5 px-4 first:pl-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm tracking-wide"
                        style={{ color: '#e8f0fe', fontFamily: 'Syne, sans-serif' }}>
                        {pos.ticker}
                      </span>
                      <span className="text-xs" style={{ color: '#4a6a8a' }}>{pos.contracts}x</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        color: pos.strategy === 'CSP' ? '#00c6f5' : '#00e5c4',
                        background: pos.strategy === 'CSP' ? 'rgba(0,198,245,0.1)' : 'rgba(0,229,196,0.1)',
                        border: `1px solid ${pos.strategy === 'CSP' ? 'rgba(0,198,245,0.2)' : 'rgba(0,229,196,0.2)'}`,
                        fontFamily: 'JetBrains Mono, monospace',
                        letterSpacing: '0.04em',
                      }}>
                      {pos.strategy}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
                      ${pos.strike}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                      {pos.expiry}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-medium" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
                      ${pos.premiumCollected.toFixed(0)}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold"
                        style={{ color: isPnlPositive ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
                        {isPnlPositive ? '+' : ''}{pnl.toFixed(0)}
                      </span>
                      <span className="text-xs" style={{ color: '#4a6a8a' }}>
                        {((pnl / pos.premiumCollected) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums"
                        style={{ color: dteColor, fontFamily: 'JetBrains Mono, monospace' }}>
                        {pos.daysToExpiry}d
                      </span>
                      {pos.daysToExpiry <= 7 && (
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '9px' }}>
                          EXP
                        </span>
                      )}
                    </div>
                  </td>

                  {onRemove && (
                    <td className="py-3.5 px-4 last:pr-0">
                      <button
                        onClick={() => onRemove(pos.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 hover:bg-[rgba(255,77,109,0.12)]"
                        style={{ color: '#4a6a8a' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
