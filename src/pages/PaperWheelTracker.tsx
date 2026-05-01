import { useState, useEffect, useCallback } from 'react';
import { usePaperAccount, usePaperPositions, usePaperActions } from '../hooks/usePaperTrading';
import { usePaperMode } from '../context/PaperModeContext';
import { ResetConfirmModal } from '../components/PaperModals';
import { MonthlyTargetTracker } from '../components/MonthlyTargetTracker';
import { DTEIndicator } from '../components/DTEIndicator';
import { getQuote } from '../lib/finnhub';
import type { PaperPosition, OpenPaperPositionData } from '../types';

// Amber palette constants
const A = {
  amber: '#f5c842',
  amberBg: 'rgba(245,200,66,0.08)',
  amberBorder: 'rgba(245,200,66,0.2)',
  cardBg: 'rgba(13,27,53,0.6)',
  cardBorder: 'rgba(0,229,196,0.1)',
  text: '#e8f0fe',
  muted: '#4a6a8a',
};

function getDTE(expiry: string): number {
  return Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000));
}

function getNextMonthlyExpiries(n = 4): string[] {
  const today = new Date();
  const result: string[] = [];
  let year = today.getFullYear();
  let month = today.getMonth();
  while (result.length < n) {
    const dow = new Date(year, month, 1).getDay();
    const thirdFriday = new Date(year, month, ((5 - dow + 7) % 7) + 15);
    if (thirdFriday > today) result.push(thirdFriday.toISOString().split('T')[0]);
    if (++month > 11) { month = 0; year++; }
  }
  return result;
}

function fmtExpiryShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${'JanFebMarAprMayJunJulAugSepOctNovDec'.slice((+m - 1) * 3, (+m - 1) * 3 + 3)} ${+d}`;
}

export function PaperWheelTracker() {
  const [mounted, setMounted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [closingPos, setClosingPos] = useState<PaperPosition | null>(null);
  const [expiringPos, setExpiringPos] = useState<PaperPosition | null>(null);
  const [assigningPos, setAssigningPos] = useState<PaperPosition | null>(null);
  const [editingPos, setEditingPos] = useState<PaperPosition | null>(null);
  const [showReset, setShowReset] = useState(false);

  const { account, reload: reloadAccount } = usePaperAccount();
  const { positions: openPositions, allPositions, isLoading, reload: reloadPositions } = usePaperPositions();
  const { closePaperPosition, expirePaperPosition, assignPaperPosition, editPaperPosition,
          deletePaperPosition, resetPaperAccount, openPaperPosition, estimateClosePrice } = usePaperActions();
  const { refreshAccount } = usePaperMode();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      setShowAddModal(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const reload = useCallback(() => {
    reloadAccount();
    reloadPositions();
    refreshAccount();
  }, [reloadAccount, reloadPositions, refreshAccount]);

  const closedPositions = allPositions.filter((p) => p.status !== 'open');
  const winRate = account && account.tradesTotal > 0
    ? Math.round((account.tradesWon / account.tradesTotal) * 100)
    : null;
  const openCSPs = openPositions.filter((p) => p.strategy === 'CSP');
  const openCCs = openPositions.filter((p) => p.strategy === 'CC');
  const totalOpenPremium = openPositions.reduce((acc, p) => acc + p.premiumCollected * p.contracts * 100, 0);

  const fadeIn = (delay = '0s') => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : 'translateY(16px)',
    transition: `opacity 0.5s ease ${delay}, transform 0.5s ease ${delay}`,
  });

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8" style={fadeIn()}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-20" style={{ background: `linear-gradient(90deg, ${A.amber}40, transparent)` }} />
            <span className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded"
              style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
              PAPER MODE
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold"
                style={{ fontFamily: 'Syne, sans-serif', color: A.text, letterSpacing: '-0.02em' }}>
                Paper Wheel Tracker
              </h1>
              <p className="text-sm mt-1" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
                <span style={{ color: '#f5a623', fontWeight: 600 }}>{openCSPs.length} CSP{openCSPs.length !== 1 ? 's' : ''}</span>
                <span style={{ color: '#6a8aaa' }}> · </span>
                <span style={{ color: A.amber, fontWeight: 600 }}>{openCCs.length} CC{openCCs.length !== 1 ? 's' : ''}</span>
                <span style={{ color: '#6a8aaa' }}> · </span>
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowReset(true)}
                className="px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.15)', color: '#ff6b8a', fontFamily: 'DM Sans, sans-serif' }}>
                Reset
              </button>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 4px 16px rgba(245,200,66,0.25)' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Open Paper Trade
              </button>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" style={fadeIn('0.05s')}>
          {[
            { label: 'Open Positions', value: openPositions.length.toString(), color: A.amber },
            { label: 'Total Premium', value: `$${totalOpenPremium.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: '#f5a623' },
            { label: 'Available Cash', value: account ? `$${account.currentCash.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—', color: A.amber },
            { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—', color: A.amber },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
              <p className="text-xs mb-2 tracking-wide" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Monthly Income Target */}
        <MonthlyTargetTracker />

        {/* Open positions */}
        <div className="rounded-2xl p-5 sm:p-6 mb-6"
          style={{ ...fadeIn('0.1s'), background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>Open Positions</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: A.amber, boxShadow: `0 0 8px ${A.amber}` }} />
              <span className="text-xs" style={{ color: A.amber, fontFamily: 'DM Sans, sans-serif' }}>Paper</span>
            </div>
          </div>
          {isLoading ? (
            <div className="py-12 text-center text-sm" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Loading...</div>
          ) : openPositions.length === 0 ? (
            <EmptyState onOpen={() => setShowAddModal(true)} />
          ) : (
            <PaperPositionTable
              positions={openPositions}
              onClose={setClosingPos}
              onExpire={setExpiringPos}
              onAssign={setAssigningPos}
              onEdit={setEditingPos}
              onDelete={async (id) => { await deletePaperPosition(id); reload(); }}
            />
          )}
        </div>

        {/* Closed Positions */}
        <div className="rounded-2xl p-5 sm:p-6"
          style={{ ...fadeIn('0.15s'), background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>Closed Positions</h2>
              {closedPositions.length > 0 && account && (
                <p className="text-xs mt-0.5" style={{
                  color: account.totalRealizedPnl >= 0 ? '#00d68f' : '#ff4d6d',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {account.totalRealizedPnl >= 0 ? '+' : ''}${account.totalRealizedPnl.toFixed(0)} realized · {closedPositions.length} trade{closedPositions.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <PaperClosedPositionTable positions={closedPositions} />
        </div>
      </div>

      {/* Modals */}
      {showAddModal && account && (
        <OpenPaperPositionModal
          availableCash={account.currentCash}
          onClose={() => setShowAddModal(false)}
          onSubmit={async (data) => {
            const err = await openPaperPosition(data);
            if (!err) { setShowAddModal(false); reload(); }
            return err;
          }}
        />
      )}
      {closingPos && (
        <PaperCloseModal
          position={closingPos}
          onClose={() => setClosingPos(null)}
          onConfirm={async (premium) => { await closePaperPosition(closingPos.id, premium); setClosingPos(null); reload(); }}
          estimateClosePrice={estimateClosePrice}
        />
      )}
      {expiringPos && (
        <ExpireWorthlessModal
          position={expiringPos}
          onClose={() => setExpiringPos(null)}
          onConfirm={async () => { await expirePaperPosition(expiringPos.id); setExpiringPos(null); reload(); }}
        />
      )}
      {assigningPos && (
        <PaperAssignModal
          position={assigningPos}
          onClose={() => setAssigningPos(null)}
          onConfirm={async () => { await assignPaperPosition(assigningPos.id); setAssigningPos(null); reload(); }}
        />
      )}
      {editingPos && (
        <PaperEditModal
          position={editingPos}
          onClose={() => setEditingPos(null)}
          onSave={async (data) => {
            const err = await editPaperPosition(editingPos.id, data, editingPos);
            if (!err) { setEditingPos(null); reload(); }
          }}
        />
      )}
      {showReset && (
        <ResetConfirmModal
          onClose={() => setShowReset(false)}
          onConfirm={async () => { await resetPaperAccount(); setShowReset(false); reload(); }}
        />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 4v12M4 10h12" stroke={A.amber} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.7" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium mb-1" style={{ color: A.text, fontFamily: 'DM Sans, sans-serif' }}>No open paper positions</p>
        <p className="text-xs" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Open your first paper trade to start practicing</p>
      </div>
      <button onClick={onOpen}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif' }}>
        Open Paper Trade
      </button>
    </div>
  );
}

// ─── Open positions table ─────────────────────────────────────────────────────
interface PaperPositionTableProps {
  positions: PaperPosition[];
  onClose: (p: PaperPosition) => void;
  onExpire: (p: PaperPosition) => void;
  onAssign: (p: PaperPosition) => void;
  onEdit: (p: PaperPosition) => void;
  onDelete: (id: string) => void;
}

const paperThStyle: React.CSSProperties = {
  color: '#4a6a8a',
  borderBottom: `1px solid rgba(245,200,66,0.1)`,
  letterSpacing: '0.08em', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap',
};

function paperDeskBtn(color: string): React.CSSProperties {
  return {
    background: `${color}14`, border: `1px solid ${color}26`,
    borderRadius: 5, color, fontFamily: 'DM Sans, sans-serif',
    fontSize: 11, fontWeight: 600, padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
  };
}

function PaperPositionTable({ positions, onClose, onExpire, onAssign, onEdit, onDelete }: PaperPositionTableProps) {
  return (
    <>
      {/* Mobile */}
      <div className="sm:hidden space-y-3">
        {positions.map((pos) => {
          const capitalAtRisk = pos.strike * pos.contracts * 100;
          const returnPct = capitalAtRisk > 0 ? (pos.premiumCollected / pos.strike) * 100 : 0;
          const totalPremium = pos.premiumCollected * pos.contracts * 100;
          return (
            <div key={pos.id} className="rounded-xl p-4"
              style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${A.amberBorder}` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-bold" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                <span className="text-xs px-2 py-0.5 rounded font-semibold"
                  style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
                  {pos.strategy}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#c8daf0', fontFamily: 'JetBrains Mono, monospace' }}>{pos.contracts}×</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Strike</p>
                  <p className="text-sm font-medium" style={{ color: A.text, fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Premium</p>
                  <p className="text-sm font-medium" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>${totalPremium.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Return</p>
                  <p className="text-sm font-semibold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>{returnPct.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>DTE</p>
                  <DTEIndicator expiry={pos.expiry} strategy={pos.strategy} compact />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${A.amberBorder}` }}>
                <button onClick={() => onExpire(pos)} style={{ flex: 1, background: `${A.amber}14`, border: `1px solid ${A.amber}33`, borderRadius: 7, color: A.amber, fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer' }}>Expire</button>
                <button onClick={() => onAssign(pos)} style={{ flex: 1, background: 'rgba(154,180,212,0.08)', border: '1px solid rgba(154,180,212,0.15)', borderRadius: 7, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer' }}>Assign</button>
                <button onClick={() => onClose(pos)} style={{ flex: 1, background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.15)', borderRadius: 7, color: '#00e5c4', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer' }}>Close</button>
                <button onClick={() => onEdit(pos)} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, color: A.muted, fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer' }}>Edit</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="text-left py-3 px-4 first:pl-0" style={paperThStyle}>Ticker</th>
              <th className="text-left py-3 px-4" style={paperThStyle}>Strategy</th>
              <th className="text-left py-3 px-4" style={paperThStyle}>Strike</th>
              <th className="text-left py-3 px-4" style={paperThStyle}>Premium</th>
              <th className="text-left py-3 px-4" style={paperThStyle}>Return</th>
              <th className="text-left py-3 px-4" style={paperThStyle}>Expires</th>
              <th className="text-left py-3 px-4 last:pr-0" style={paperThStyle}></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const capitalAtRisk = pos.strike * pos.contracts * 100;
              const returnPct = capitalAtRisk > 0 ? (pos.premiumCollected / pos.strike) * 100 : 0;
              const totalPremium = pos.premiumCollected * pos.contracts * 100;
              return (
                <tr key={pos.id} className="stock-row-hover group"
                  style={{ borderBottom: i < positions.length - 1 ? `1px solid rgba(245,200,66,0.06)` : 'none' }}>
                  <td className="py-3.5 px-4 first:pl-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm tracking-wide" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                      <span className="text-xs" style={{ color: A.muted }}>{pos.contracts}×</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em' }}>
                      {pos.strategy}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span style={{ color: A.text, fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>
                        ${totalPremium.toFixed(0)}
                      </span>
                      <span className="text-xs" style={{ color: A.muted }}>
                        on ${(capitalAtRisk / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                        {returnPct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <DTEIndicator expiry={pos.expiry} strategy={pos.strategy} compact />
                  </td>
                  <td className="py-3.5 px-4 last:pr-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => onExpire(pos)} style={paperDeskBtn(A.amber)}>Expire</button>
                      <button onClick={() => onAssign(pos)} style={paperDeskBtn('#9ab4d4')}>Assign</button>
                      <button onClick={() => onClose(pos)} style={paperDeskBtn('#00e5c4')}>Close</button>
                      <button onClick={() => onEdit(pos)} style={paperDeskBtn(A.muted)}>Edit</button>
                      <button onClick={() => onDelete(pos.id)} style={paperDeskBtn('#ff4d6d')}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Closed positions table ───────────────────────────────────────────────────
function PaperClosedPositionTable({ positions }: { positions: PaperPosition[] }) {
  if (!positions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke={A.amber} strokeWidth="1.5" strokeOpacity="0.4" />
            <path d="M6 10l3 3 5-5" stroke={A.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.4" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>No closed positions yet</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile */}
      <div className="sm:hidden space-y-3">
        {positions.map((pos) => {
          const pnl = pos.realizedPnl ?? 0;
          const pnlColor = pnl >= 0 ? '#00d68f' : '#ff4d6d';
          const capitalAtRisk = pos.strike * pos.contracts * 100;
          const returnPct = capitalAtRisk > 0 ? (pnl / capitalAtRisk) * 100 : 0;
          const totalPremium = pos.premiumCollected * pos.contracts * 100;

          return (
            <div key={pos.id} className="rounded-xl p-4"
              style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid rgba(245,200,66,0.06)` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>{pos.ticker}</span>
                <span className="text-xs px-2 py-0.5 rounded font-semibold"
                  style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
                  {pos.strategy}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#c8daf0', fontFamily: 'JetBrains Mono, monospace' }}>{pos.contracts}×</span>
                {pos.status === 'assigned' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
                    ASSIGNED
                  </span>
                )}
                {pos.status === 'expired' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ color: '#00d68f', background: 'rgba(0,214,143,0.08)', border: '1px solid rgba(0,214,143,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
                    EXPIRED
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Strike</p>
                  <p className="text-sm font-medium" style={{ color: A.text, fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Premium</p>
                  <p className="text-sm font-medium" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>${totalPremium.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Real P&L</p>
                  <p className="text-sm font-semibold" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace' }}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Return</p>
                  <p className="text-sm font-semibold" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace' }}>{returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%</p>
                </div>
              </div>
              <p className="text-xs" style={{ color: A.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                Expired {pos.expiry}{pos.closedAt ? ` · Closed ${pos.closedAt}` : ''}
              </p>
            </div>
          );
        })}
      </div>

      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {['Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'Real P&L', 'Return', 'Closed'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-medium tracking-widest uppercase first:pl-0"
                  style={{ color: '#4a6a8a', borderBottom: `1px solid rgba(245,200,66,0.1)`, letterSpacing: '0.08em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const pnl = pos.realizedPnl ?? 0;
              const pnlColor = pnl >= 0 ? '#00d68f' : '#ff4d6d';
              const capitalAtRisk = pos.strike * pos.contracts * 100;
              const returnPct = capitalAtRisk > 0 ? (pnl / capitalAtRisk) * 100 : 0;
              const totalPremium = pos.premiumCollected * pos.contracts * 100;

              return (
                <tr key={pos.id} className="stock-row-hover"
                  style={{ borderBottom: i < positions.length - 1 ? `1px solid rgba(245,200,66,0.06)` : 'none' }}>
                  <td className="py-3.5 px-4 first:pl-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm tracking-wide" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                      <span className="text-xs" style={{ color: A.muted }}>{pos.contracts}×</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
                        {pos.strategy}
                      </span>
                      {pos.status === 'assigned' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
                          ASSIGNED
                        </span>
                      )}
                      {pos.status === 'expired' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ color: '#00d68f', background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.2)', fontFamily: 'JetBrains Mono, monospace' }}>
                          EXPIRED
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span style={{ color: A.text, fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{pos.expiry}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-medium" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>+${totalPremium.toFixed(0)}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold tabular-nums" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                      </span>
                      <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.abs(returnPct) * 10)}%`, background: pnlColor }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold" style={{ color: pnlColor, fontFamily: 'JetBrains Mono, monospace' }}>
                        {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                      </span>
                      <span className="text-xs" style={{ color: A.muted }}>on ${(capitalAtRisk / 1000).toFixed(0)}k</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span style={{ color: '#6a8aaa', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{pos.closedAt ?? '—'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────
function PaperModalShell({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,8,19,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-4 sm:p-6"
        style={{ background: 'rgba(10,22,40,0.98)', border: `1px solid ${A.amberBorder}`, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)]" style={{ color: A.muted }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputBase = {
  background: 'rgba(5,13,26,0.8)',
  border: `1px solid ${A.amberBorder}`,
  color: A.text,
  fontFamily: 'JetBrains Mono, monospace',
  caretColor: A.amber,
  outline: 'none',
};

// ─── Open paper position modal ────────────────────────────────────────────────
function OpenPaperPositionModal({ availableCash, onClose, onSubmit }: {
  availableCash: number;
  onClose: () => void;
  onSubmit: (data: OpenPaperPositionData) => Promise<string | null>;
}) {
  const [form, setForm] = useState({ ticker: '', strategy: 'CSP' as 'CSP' | 'CC', strike: '', expiry: '', premium: '', contracts: '1' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [spotPrice, setSpotPrice] = useState(0);

  const contracts = Number(form.contracts) || 1;
  const strike = Number(form.strike) || 0;
  const collateral = form.strategy === 'CSP' ? strike * contracts * 100 : 0;
  const insufficient = form.strategy === 'CSP' && collateral > availableCash;

  const fetchSpot = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setFetchingPrice(true);
    try {
      const q = await getQuote(ticker.toUpperCase());
      const price = q.c > 0 ? q.c : q.pc;
      if (price > 0) { setSpotPrice(price); if (!form.strike) setForm((f) => ({ ...f, strike: String(Math.floor(price * 0.95)) })); }
    } catch { /* ignore */ }
    setFetchingPrice(false);
  }, [form.strike]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.ticker.trim()) e.ticker = 'Required';
    if (!form.strike || isNaN(Number(form.strike)) || Number(form.strike) <= 0) e.strike = 'Invalid';
    if (!form.expiry) e.expiry = 'Required';
    if (!form.premium || isNaN(Number(form.premium)) || Number(form.premium) <= 0) e.premium = 'Invalid';
    if (!form.contracts || isNaN(Number(form.contracts)) || Number(form.contracts) < 1) e.contracts = 'Invalid';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (insufficient) { setGlobalError(`Insufficient cash — need $${collateral.toLocaleString()}`); return; }
    setSubmitting(true);
    const err = await onSubmit({
      ticker: form.ticker.toUpperCase(),
      strategy: form.strategy,
      strike: Number(form.strike),
      expiry: form.expiry,
      premiumCollected: Number(form.premium),
      contracts,
      underlyingPriceAtEntry: spotPrice || Number(form.strike),
    });
    setSubmitting(false);
    if (err) setGlobalError(err);
  };

  const inputStyle = (field: string) => ({ ...inputBase, border: errors[field] ? '1px solid rgba(255,77,109,0.4)' : `1px solid ${A.amberBorder}` });

  return (
    <PaperModalShell title="Open Paper Trade" subtitle="Virtual position · no real money" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Ticker + Strategy */}
        <div className="grid grid-cols-2 gap-3 items-start">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Ticker</label>
            <input autoFocus value={form.ticker} placeholder="AAPL"
              onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
              onBlur={(e) => fetchSpot(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle('ticker')} />
            {fetchingPrice && <p className="text-xs mt-1" style={{ color: A.amber }}>Fetching price...</p>}
            {errors.ticker && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.ticker}</p>}
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Strategy</label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'rgba(5,13,26,0.8)', border: `1px solid ${A.amberBorder}` }}>
              {(['CSP', 'CC'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, strategy: s }))}
                  className="py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                  style={{ background: form.strategy === s ? A.amberBg : 'transparent', color: form.strategy === s ? A.amber : A.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs mt-1.5" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
              {form.strategy === 'CSP'
                ? 'Cash Secured Put — you agree to buy 100 shares at the strike if assigned'
                : 'Covered Call — you agree to sell your 100 shares at the strike if called away'}
            </p>
          </div>
        </div>

        {/* Strike + Contracts */}
        <div className="grid grid-cols-2 gap-3 items-start">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Strike Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: A.muted }}>$</span>
              <input type="number" step="0.5" value={form.strike} onChange={(e) => setForm((f) => ({ ...f, strike: e.target.value }))}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm" style={inputStyle('strike')} />
            </div>
            {errors.strike && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.strike}</p>}
            <p className="text-xs mt-1.5" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
              The strike price of the option you sold
              <br />
              <span style={{ color: '#6a8fb0' }}>
                {form.strategy === 'CSP' ? 'CSP: the price you agreed to buy shares at' : 'CC: the price your shares get called away at'}
              </span>
            </p>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Contracts</label>
            <input type="number" min="1" value={form.contracts} onChange={(e) => setForm((f) => ({ ...f, contracts: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle('contracts')} />
            {errors.contracts && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.contracts}</p>}
            <p className="text-xs mt-1.5" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
              Each contract covers 100 shares.
            </p>
            {strike > 0 && contracts > 0 && (
              <p className="text-xs mt-0.5" style={{ color: '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}>
                Capital required: ${(strike * contracts * 100).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Expiration Date</label>
          <div className="w-full overflow-hidden">
            <input type="date" value={form.expiry} onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
              className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle('expiry'), colorScheme: 'dark', maxWidth: '100%', boxSizing: 'border-box' as const }} />
          </div>
          {errors.expiry && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.expiry}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {getNextMonthlyExpiries().map((iso) => (
              <button
                key={iso} type="button" data-no-min-h
                onClick={() => setForm((f) => ({ ...f, expiry: iso }))}
                className="px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{
                  background: form.expiry === iso ? 'rgba(245,200,66,0.12)' : 'rgba(5,13,26,0.6)',
                  color: form.expiry === iso ? '#f5c842' : '#6a8fb0',
                  border: `1px solid ${form.expiry === iso ? 'rgba(245,200,66,0.3)' : 'rgba(0,229,196,0.1)'}`,
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >{fmtExpiryShort(iso)}</button>
            ))}
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
            The expiration date shown in your broker — always the third Friday of the month for monthly options
          </p>
        </div>

        {/* Premium */}
        <div>
          <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
            Premium Collected <span style={{ color: '#6a8fb0' }}>(per share · broker price)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: A.muted }}>$</span>
            <input type="number" step="0.01" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
              placeholder="1.45" className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm" style={inputStyle('premium')} />
          </div>
          {form.premium && form.contracts && (
            <p className="text-xs mt-1" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>
              Total: ${(Number(form.premium) * Number(form.contracts) * 100).toFixed(0)}
            </p>
          )}
          {errors.premium && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.premium}</p>}
          <p className="text-xs mt-1.5" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
            Enter the actual premium per share you received when your order was filled in your broker — check your order confirmation for the exact fill price.
          </p>
          <p className="text-[11px] mt-1" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic', lineHeight: 1.5 }}>
            Example: if you sold 1 contract and received $120 total, enter 1.20 (premium per share, not total)
          </p>
        </div>

        {/* Collateral check */}
        {form.strategy === 'CSP' && strike > 0 && (
          <div className="rounded-lg px-4 py-2.5 flex justify-between text-xs"
            style={{ background: insufficient ? 'rgba(255,77,109,0.06)' : 'rgba(245,200,66,0.06)', border: `1px solid ${insufficient ? 'rgba(255,77,109,0.2)' : A.amberBorder}` }}>
            <span style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Collateral required</span>
            <span style={{ color: insufficient ? '#ff4d6d' : A.amber, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
              ${collateral.toLocaleString()} {insufficient ? '(insufficient)' : ''}
            </span>
          </div>
        )}

        {globalError && <p className="text-xs" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>{globalError}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          <button type="submit" disabled={submitting || insufficient}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 4px 16px rgba(245,200,66,0.2)' }}>
            {submitting ? 'Opening...' : 'Open Paper Position'}
          </button>
        </div>
      </form>
    </PaperModalShell>
  );
}

// ─── Close modal with BS pre-fill ─────────────────────────────────────────────
function PaperCloseModal({ position, onClose, onConfirm, estimateClosePrice }: {
  position: PaperPosition;
  onClose: () => void;
  onConfirm: (closingPremium: number) => void;
  estimateClosePrice: (p: PaperPosition) => Promise<number | null>;
}) {
  const [closingPremium, setClosingPremium] = useState('');
  const [bsEstimate, setBsEstimate] = useState<number | null>(null);
  const [loadingBS, setLoadingBS] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    estimateClosePrice(position).then((est) => {
      setBsEstimate(est);
      if (est !== null && est > 0) setClosingPremium(String(est));
      setLoadingBS(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const premNum = Number(closingPremium);
  const realizedPnl = closingPremium && !isNaN(premNum)
    ? (position.premiumCollected - premNum) * position.contracts * 100
    : null;
  const totalPremium = position.premiumCollected * position.contracts * 100;

  const handleConfirm = () => {
    if (!closingPremium || isNaN(premNum) || premNum < 0) { setError('Enter a valid option price'); return; }
    onConfirm(premNum);
  };

  return (
    <PaperModalShell title="Close Paper Position" subtitle={`${position.ticker} ${position.strategy} · $${position.strike} strike`} onClose={onClose}>
      {/* Summary */}
      <div className="rounded-xl p-4 mb-5" style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs mb-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Premium Received</p>
            <p className="text-sm font-semibold" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>${totalPremium.toFixed(0)}</p>
            <p className="text-xs" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>${position.premiumCollected.toFixed(2)}/sh</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Contracts</p>
            <p className="text-sm font-semibold" style={{ color: A.text, fontFamily: 'JetBrains Mono, monospace' }}>{position.contracts}x</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>DTE</p>
            <p className="text-sm font-semibold" style={{ color: getDTE(position.expiry) <= 7 ? '#ff4d6d' : '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
              {getDTE(position.expiry)}d
            </p>
          </div>
        </div>
      </div>

      {/* BS estimate info */}
      {loadingBS ? (
        <div className="rounded-lg px-4 py-2.5 mb-4 text-xs" style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
          <span style={{ color: A.amber, fontFamily: 'DM Sans, sans-serif' }}>Estimating current option price via Black-Scholes...</span>
        </div>
      ) : bsEstimate !== null && (
        <div className="rounded-lg px-4 py-2.5 mb-4 flex justify-between items-center text-xs"
          style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
          <span style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Black-Scholes estimate</span>
          <span style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>${bsEstimate.toFixed(2)}/sh</span>
        </div>
      )}

      {/* Closing price input */}
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
          Buy-Back Price <span style={{ color: '#6a8fb0' }}>(per share · broker price)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: A.muted }}>$</span>
          <input type="number" step="0.01" min="0" autoFocus
            value={closingPremium}
            onChange={(e) => { setClosingPremium(e.target.value); setError(''); }}
            className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm"
            style={{ ...inputBase, border: error ? '1px solid rgba(255,77,109,0.4)' : `1px solid ${A.amberBorder}` }} />
        </div>
        {error && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{error}</p>}
      </div>

      {/* P&L preview */}
      {realizedPnl !== null && (
        <div className="rounded-lg px-4 py-3 mb-5 flex items-center justify-between"
          style={{ background: realizedPnl >= 0 ? 'rgba(0,214,143,0.06)' : 'rgba(255,77,109,0.06)', border: `1px solid ${realizedPnl >= 0 ? 'rgba(0,214,143,0.15)' : 'rgba(255,77,109,0.15)'}` }}>
          <span className="text-xs" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Realized P&L</span>
          <span className="text-base font-bold" style={{ color: realizedPnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
            {realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(0)}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button type="button" onClick={handleConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 4px 16px rgba(245,200,66,0.2)' }}>
          Close Position
        </button>
      </div>
    </PaperModalShell>
  );
}

// ─── Expire worthless modal ───────────────────────────────────────────────────
function ExpireWorthlessModal({ position, onClose, onConfirm }: {
  position: PaperPosition;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const fullPremium = position.premiumCollected * position.contracts * 100;
  return (
    <PaperModalShell title="Expire Worthless" subtitle={`${position.ticker} ${position.strategy} · $${position.strike}`} onClose={onClose}>
      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.2)' }}>
        <p className="text-xs font-semibold mb-2 tracking-widest uppercase" style={{ color: '#00d68f', fontFamily: 'DM Sans, sans-serif' }}>
          Option Expired Worthless
        </p>
        <p className="text-sm" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
          You keep 100% of the premium you collected. The option expired out-of-the-money with no value.
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Premium kept</span>
          <span className="text-lg font-bold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>+${fullPremium.toFixed(0)}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #00d68f, #00b4d8)', color: '#050d1a', fontFamily: 'DM Sans, sans-serif' }}>
          Mark Expired Worthless
        </button>
      </div>
    </PaperModalShell>
  );
}

// ─── Assign modal ─────────────────────────────────────────────────────────────
function PaperAssignModal({ position, onClose, onConfirm }: {
  position: PaperPosition;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isCSP = position.strategy === 'CSP';
  const shares = position.contracts * 100;
  const premPerShare = position.premiumCollected;
  const effectiveBasis = Math.max(0, position.strike - premPerShare);
  return (
    <PaperModalShell title="Mark as Assigned" subtitle={`${position.ticker} ${position.strategy} · $${position.strike} · ${position.contracts}x`} onClose={onClose}>
      <div className="rounded-xl p-4 mb-4" style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
        <p className="text-xs font-semibold mb-3 tracking-widest uppercase" style={{ color: A.amber, fontFamily: 'DM Sans, sans-serif' }}>
          {isCSP ? 'Put Assigned — Virtual Shares Purchased' : 'Call Assigned — Virtual Shares Called Away'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Shares</p>
            <p className="text-sm font-bold" style={{ color: A.text, fontFamily: 'JetBrains Mono, monospace' }}>
              {isCSP ? '+' : '−'}{shares} {position.ticker}
            </p>
          </div>
          {isCSP && (
            <div>
              <p className="text-xs mb-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Effective Basis</p>
              <p className="text-sm font-bold" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>${effectiveBasis.toFixed(2)}/sh</p>
            </div>
          )}
        </div>
      </div>
      <div className="rounded-lg px-4 py-3 mb-5" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs leading-relaxed" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          {isCSP
            ? `Your virtual cash was used to purchase ${shares} shares of ${position.ticker} at $${position.strike}. Now sell a Covered Call to continue the wheel.`
            : `Your virtual ${position.ticker} shares were called away at $${position.strike}. You keep the CC premium. Return to selling CSPs to restart the wheel.`}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif' }}>
          Confirm Assignment
        </button>
      </div>
    </PaperModalShell>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────
function PaperEditModal({ position, onClose, onSave }: {
  position: PaperPosition;
  onClose: () => void;
  onSave: (data: { strike: number; expiry: string; premiumCollected: number; contracts: number }) => void;
}) {
  const [form, setForm] = useState({
    strike: String(position.strike),
    expiry: position.expiry,
    premium: String(position.premiumCollected),
    contracts: String(position.contracts),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.strike || isNaN(Number(form.strike))) e.strike = 'Invalid';
    if (!form.expiry) e.expiry = 'Required';
    if (!form.premium || isNaN(Number(form.premium))) e.premium = 'Invalid';
    if (!form.contracts || isNaN(Number(form.contracts)) || Number(form.contracts) < 1) e.contracts = 'Invalid';
    return e;
  };

  const handleSave = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({ strike: Number(form.strike), expiry: form.expiry, premiumCollected: Number(form.premium), contracts: Number(form.contracts) });
  };

  const inputStyle = (field: string) => ({ ...inputBase, border: errors[field] ? '1px solid rgba(255,77,109,0.4)' : `1px solid ${A.amberBorder}` });

  return (
    <PaperModalShell title="Edit Paper Position" subtitle={`${position.ticker} ${position.strategy}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Strike</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: A.muted }}>$</span>
              <input type="number" step="0.5" value={form.strike} onChange={(e) => setForm((f) => ({ ...f, strike: e.target.value }))}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm" style={inputStyle('strike')} />
            </div>
            {errors.strike && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.strike}</p>}
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Contracts</label>
            <input type="number" min="1" value={form.contracts} onChange={(e) => setForm((f) => ({ ...f, contracts: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle('contracts')} />
            {errors.contracts && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.contracts}</p>}
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Expiration Date</label>
          <div className="w-full overflow-hidden">
            <input type="date" value={form.expiry} onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
              className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle('expiry'), colorScheme: 'dark', maxWidth: '100%', boxSizing: 'border-box' as const }} />
          </div>
          {errors.expiry && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.expiry}</p>}
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
            Option Price <span style={{ color: '#6a8fb0' }}>(per share · broker price)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: A.muted }}>$</span>
            <input type="number" step="0.01" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
              className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm" style={inputStyle('premium')} />
          </div>
          {errors.premium && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.premium}</p>}
          <p className="text-xs mt-1.5" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
            Enter the actual premium per share you received when your order was filled in your broker — check your order confirmation for the exact fill price.
          </p>
          <p className="text-[11px] mt-1" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic', lineHeight: 1.5 }}>
            Example: if you sold 1 contract and received $120 total, enter 1.20 (premium per share, not total)
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #f5c842, #f59e0b)', color: '#1a1200', fontFamily: 'DM Sans, sans-serif' }}>
            Save Changes
          </button>
        </div>
      </div>
    </PaperModalShell>
  );
}
