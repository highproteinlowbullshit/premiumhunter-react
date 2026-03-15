import type { WheelPosition } from '../types';

interface PositionTableProps {
  positions: WheelPosition[];
  onRemove?: (id: string) => void;
  onClose?: (position: WheelPosition) => void;
  onEdit?: (position: WheelPosition) => void;
  onAssign?: (position: WheelPosition) => void;
}

export function PositionTable({ positions, onRemove, onClose, onEdit, onAssign }: PositionTableProps) {
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

  const hasActions = onRemove || onClose || onEdit || onAssign;

  return (
    <>
      {/* ── Mobile card layout (< sm) ── */}
      <div className="sm:hidden space-y-3">
        {positions.map((pos) => {
          const capitalAtRisk = pos.strike * pos.contracts * 100;
          const returnPct = capitalAtRisk > 0 ? (pos.premiumCollected / capitalAtRisk) * 100 : 0;
          const dteColor = pos.daysToExpiry <= 7 ? '#ff4d6d' : pos.daysToExpiry <= 21 ? '#f5c842' : '#9ab4d4';

          return (
            <div key={pos.id} className="rounded-xl p-4"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(0,229,196,0.08)' }}>
              {/* Row 1: ticker + strategy + badge */}
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
                {/* Mobile actions */}
                <div className="flex items-center gap-1">
                  {onAssign && (
                    <button onClick={() => onAssign(pos)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ color: '#f5c842', background: 'rgba(245,200,66,0.08)' }}
                      title="Mark as assigned">
                      <AssignIcon />
                    </button>
                  )}
                  {onEdit && (
                    <button onClick={() => onEdit(pos)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ color: '#4a6a8a', background: 'rgba(255,255,255,0.04)' }}
                      title="Edit position">
                      <EditIcon />
                    </button>
                  )}
                  {onClose && (
                    <button onClick={() => onClose(pos)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ color: '#00e5c4', background: 'rgba(0,229,196,0.08)' }}
                      title="Close position">
                      <ClosePositionIcon />
                    </button>
                  )}
                  {onRemove && (
                    <button onClick={() => onRemove(pos.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ color: '#4a6a8a' }}
                      title="Delete">
                      <TrashIcon />
                    </button>
                  )}
                </div>
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
                  <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Return</p>
                  <p className="text-sm font-semibold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                    {returnPct.toFixed(1)}%
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
              {['Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'Return', 'DTE', ...(hasActions ? [''] : [])].map((h) => (
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
              const capitalAtRisk = pos.strike * pos.contracts * 100;
              const returnPct = capitalAtRisk > 0 ? (pos.premiumCollected / capitalAtRisk) * 100 : 0;
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
                      <span className="font-semibold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                        {returnPct.toFixed(1)}%
                      </span>
                      <span className="text-xs" style={{ color: '#4a6a8a' }}>
                        on ${(capitalAtRisk / 1000).toFixed(0)}k
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

                  {hasActions && (
                    <td className="py-3.5 px-4 last:pr-0">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {onAssign && (
                          <button
                            onClick={() => onAssign(pos)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-[rgba(245,200,66,0.12)]"
                            style={{ color: '#f5c842' }}
                            title="Mark as assigned"
                          >
                            <AssignIcon />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(pos)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-[rgba(255,255,255,0.08)]"
                            style={{ color: '#4a6a8a' }}
                            title="Edit position"
                          >
                            <EditIcon />
                          </button>
                        )}
                        {onClose && (
                          <button
                            onClick={() => onClose(pos)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-[rgba(0,229,196,0.12)]"
                            style={{ color: '#00e5c4' }}
                            title="Close position early"
                          >
                            <ClosePositionIcon />
                          </button>
                        )}
                        {onRemove && (
                          <button
                            onClick={() => onRemove(pos.id)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-[rgba(255,77,109,0.12)]"
                            style={{ color: '#4a6a8a' }}
                            title="Delete position"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
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

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9 2l2 2-6.5 6.5-2.5.5.5-2.5L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClosePositionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 7l3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M5 3.5V2.5h3v1M4.5 3.5l.5 7h3l.5-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AssignIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1v7M4 5.5l2.5 2.5L9 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
