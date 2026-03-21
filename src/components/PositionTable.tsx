import type { WheelPosition } from '../types';

interface PositionTableProps {
  positions: WheelPosition[];
  livePrices?: Map<string, number>;
  onRemove?: (position: WheelPosition) => void;
  onClose?: (position: WheelPosition) => void;
  onEdit?: (position: WheelPosition) => void;
  onAssign?: (position: WheelPosition) => void;
}

interface LivePnl {
  unrealizedPnl: number;
  pctMaxProfit: number;
  isItm: boolean;
  stockPrice: number;
}

function computeLivePnl(pos: WheelPosition, stockPrice: number): LivePnl {
  const intrinsicPerShare =
    pos.strategy === 'CSP'
      ? Math.max(0, pos.strike - stockPrice)
      : Math.max(0, stockPrice - pos.strike);
  const estimatedCostToClose = intrinsicPerShare * 100 * pos.contracts;
  const unrealizedPnl = pos.premiumCollected - estimatedCostToClose;
  const pctMaxProfit =
    pos.premiumCollected > 0
      ? Math.min(100, Math.max(0, (unrealizedPnl / pos.premiumCollected) * 100))
      : 0;
  const isItm = intrinsicPerShare > 0;
  return { unrealizedPnl, pctMaxProfit, isItm, stockPrice };
}

export function PositionTable({ positions, livePrices, onRemove, onClose, onEdit, onAssign }: PositionTableProps) {
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
                  <span className="text-xs font-semibold"
                    style={{ color: '#c8daf0', fontFamily: 'JetBrains Mono, monospace' }}>
                    {pos.contracts}×
                  </span>
                  {livePrices && (() => {
                    const sp = livePrices.get(pos.ticker);
                    if (!sp) return null;
                    const { isItm } = computeLivePnl(pos, sp);
                    return (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          color: isItm ? '#ff4d6d' : '#00d68f',
                          background: isItm ? 'rgba(255,77,109,0.1)' : 'rgba(0,214,143,0.1)',
                          border: `1px solid ${isItm ? 'rgba(255,77,109,0.2)' : 'rgba(0,214,143,0.2)'}`,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                        {isItm ? 'ITM' : 'OTM'}
                      </span>
                    );
                  })()}
                </div>
                {/* Mobile actions */}
                <div className="flex items-center gap-1 flex-wrap">
                  {onAssign && (
                    <button onClick={() => onAssign(pos)}
                      style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 5, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}>
                      Assign
                    </button>
                  )}
                  {onEdit && (
                    <button onClick={() => onEdit(pos)}
                      style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 5, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}>
                      Edit
                    </button>
                  )}
                  {onClose && (
                    <button onClick={() => onClose(pos)}
                      style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 5, color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}>
                      Close
                    </button>
                  )}
                  {onRemove && (
                    <button onClick={() => onRemove(pos)}
                      style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.15)', borderRadius: 5, color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer' }}>
                      Delete
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
              {[
                'Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'Return', 'DTE',
                ...(livePrices ? ['Stock $', 'Unreal P&L'] : []),
                ...(hasActions ? [''] : []),
              ].map((h) => (
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

                  {livePrices && (() => {
                    const stockPrice = livePrices.get(pos.ticker);
                    if (stockPrice == null) {
                      return (
                        <>
                          <td className="py-3.5 px-4">
                            <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>—</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>—</span>
                          </td>
                        </>
                      );
                    }
                    const { unrealizedPnl, pctMaxProfit, isItm } = computeLivePnl(pos, stockPrice);
                    const pnlColor = unrealizedPnl >= 0 ? '#00d68f' : '#ff4d6d';
                    return (
                      <>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                              ${stockPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px]" style={{ color: isItm ? '#ff4d6d' : '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                              {isItm ? 'ITM' : 'OTM'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-medium tabular-nums" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(0)}
                            </span>
                            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pctMaxProfit}%`,
                                  background: pctMaxProfit >= 75 ? '#00d68f' : pctMaxProfit >= 40 ? '#f5c842' : '#ff4d6d',
                                }}
                              />
                            </div>
                            <span className="text-[10px]" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                              {pctMaxProfit.toFixed(0)}% max
                            </span>
                          </div>
                        </td>
                      </>
                    );
                  })()}

                  {hasActions && (
                    <td className="py-3.5 px-4 last:pr-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {onAssign && (
                          <button
                            onClick={() => onAssign(pos)}
                            style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 5, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Assign
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(pos)}
                            style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.15)', borderRadius: 5, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Edit
                          </button>
                        )}
                        {onClose && (
                          <button
                            onClick={() => onClose(pos)}
                            style={{ background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 5, color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Close
                          </button>
                        )}
                        {onRemove && (
                          <button
                            onClick={() => onRemove(pos)}
                            style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.15)', borderRadius: 5, color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Delete
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
