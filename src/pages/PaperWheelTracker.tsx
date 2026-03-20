import { useState, useEffect, useCallback } from 'react';
import { usePaperAccount, usePaperPositions, usePaperActions } from '../hooks/usePaperTrading';
import { usePaperMode } from '../context/PaperModeContext';
import { ResetConfirmModal } from '../components/PaperModals';
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

export function PaperWheelTracker() {
  const [mounted, setMounted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [closingPos, setClosingPos] = useState<PaperPosition | null>(null);
  const [expiringPos, setExpiringPos] = useState<PaperPosition | null>(null);
  const [assigningPos, setAssigningPos] = useState<PaperPosition | null>(null);
  const [editingPos, setEditingPos] = useState<PaperPosition | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { account, reload: reloadAccount } = usePaperAccount();
  const { positions: openPositions, allPositions, isLoading, reload: reloadPositions } = usePaperPositions();
  const { closePaperPosition, expirePaperPosition, assignPaperPosition, editPaperPosition,
          deletePaperPosition, resetPaperAccount, openPaperPosition, estimateClosePrice } = usePaperActions();
  const { refreshAccount } = usePaperMode();

  useEffect(() => { setMounted(true); }, []);

  const reload = useCallback(() => {
    reloadAccount();
    reloadPositions();
    refreshAccount();
  }, [reloadAccount, reloadPositions, refreshAccount]);

  const closedPositions = allPositions.filter((p) => p.status !== 'open');
  const winRate = account && account.tradesTotal > 0
    ? Math.round((account.tradesWon / account.tradesTotal) * 100)
    : null;
  const lockedCollateral = openPositions
    .filter((p) => p.strategy === 'CSP')
    .reduce((acc, p) => acc + p.strike * p.contracts * 100, 0);

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
              <p className="text-sm mt-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
                {openPositions.length} open positions · Practice with virtual money
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

        {/* Account balance card */}
        {account && (
          <div className="rounded-2xl p-5 sm:p-6 mb-6" style={{ ...fadeIn('0.05s'), background: A.amberBg, border: `1px solid ${A.amberBorder}`, backdropFilter: 'blur(12px)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="flex-1">
                <p className="text-xs mb-1 tracking-widest uppercase" style={{ color: A.amber, fontFamily: 'DM Sans, sans-serif' }}>Available Cash</p>
                <p className="text-3xl font-bold tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace', color: A.text }}>
                  ${account.currentCash.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                {lockedCollateral > 0 && (
                  <p className="text-xs mt-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
                    + ${lockedCollateral.toLocaleString()} locked as CSP collateral
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 sm:gap-8">
                {[
                  { label: 'Realized P&L', value: `${account.totalRealizedPnl >= 0 ? '+' : ''}$${account.totalRealizedPnl.toFixed(0)}`, color: account.totalRealizedPnl >= 0 ? '#00d68f' : '#ff4d6d' },
                  { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—', color: A.amber },
                  { label: 'Trades', value: String(account.tradesTotal), color: A.text },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-xs mb-1" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
                    <p className="text-lg font-bold tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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

        {/* Trade history */}
        {closedPositions.length > 0 && (
          <div className="rounded-2xl p-5 sm:p-6 mb-6"
            style={{ ...fadeIn('0.15s'), background: A.cardBg, border: `1px solid ${A.cardBorder}`, backdropFilter: 'blur(12px)' }}>
            <button className="flex items-center justify-between w-full" onClick={() => setShowHistory((v) => !v)}>
              <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: A.text }}>
                Trade History <span style={{ color: A.muted, fontWeight: 400, fontSize: '13px' }}>({closedPositions.length})</span>
              </h2>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                style={{ color: A.muted, transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showHistory && <div className="mt-5"><HistoryTable positions={closedPositions} /></div>}
          </div>
        )}

        {/* Education */}
        <div className="rounded-2xl p-5" style={{ ...fadeIn('0.2s'), background: 'rgba(245,200,66,0.04)', border: `1px solid ${A.amberBorder}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: A.amber, fontFamily: 'Syne, sans-serif' }}>The Wheel Strategy</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Sell a CSP', body: 'Sell a Cash Secured Put at a strike you\'d be happy owning. You collect premium immediately and need cash as collateral.' },
              { step: '2', title: 'Expire or Get Assigned', body: 'If it expires worthless you keep 100% of the premium. If assigned, you now own shares at below-market cost basis.' },
              { step: '3', title: 'Sell a Covered Call', body: 'With shares in hand, sell a Covered Call above your cost basis. Repeat until shares are called away, then restart.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: A.amberBg, border: `1px solid ${A.amberBorder}` }}>
                  <span className="text-xs font-bold" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>{step}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: A.text, fontFamily: 'DM Sans, sans-serif' }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
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

function PaperPositionTable({ positions, onClose, onExpire, onAssign, onEdit, onDelete }: PaperPositionTableProps) {
  return (
    <>
      {/* Mobile */}
      <div className="sm:hidden space-y-3">
        {positions.map((pos) => {
          const dte = getDTE(pos.expiry);
          const totalPremium = pos.premiumCollected * pos.contracts * 100;
          const returnPct = pos.strike > 0 ? (pos.premiumCollected / pos.strike) * 100 : 0;
          const dteColor = dte <= 7 ? '#ff4d6d' : dte <= 21 ? A.amber : '#9ab4d4';
          return (
            <div key={pos.id} className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${A.amberBorder}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-semibold"
                    style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
                    {pos.strategy}
                  </span>
                  <span className="text-xs" style={{ color: A.muted, fontFamily: 'JetBrains Mono, monospace' }}>{pos.contracts}x</span>
                </div>
                <div className="flex items-center gap-1">
                  <ActionButton onClick={() => onExpire(pos)} color={A.amber} title="Expire Worthless"><ExpireIcon /></ActionButton>
                  <ActionButton onClick={() => onAssign(pos)} color="#9ab4d4" title="Mark Assigned"><AssignIcon /></ActionButton>
                  <ActionButton onClick={() => onClose(pos)} color="#00e5c4" title="Close Position"><CloseIcon /></ActionButton>
                  <ActionButton onClick={() => onEdit(pos)} color={A.muted} title="Edit"><EditIcon /></ActionButton>
                  <ActionButton onClick={() => onDelete(pos.id)} color={A.muted} title="Delete"><TrashIcon /></ActionButton>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Metric label="Strike" value={`$${pos.strike}`} />
                <Metric label="Premium" value={`$${totalPremium.toFixed(0)}`} color="#f5c842" />
                <Metric label="Return" value={`${returnPct.toFixed(1)}%`} color="#00d68f" />
                <div>
                  <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>DTE</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium" style={{ color: dteColor, fontFamily: 'JetBrains Mono, monospace' }}>{dte}d</p>
                    {dte <= 7 && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.2)' }}>EXP</span>}
                  </div>
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: A.muted, fontFamily: 'JetBrains Mono, monospace' }}>Expires {pos.expiry}</p>
            </div>
          );
        })}
      </div>

      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {['Ticker', 'Strategy', 'Strike', 'Expiry', 'Premium', 'Return', 'DTE', ''].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-medium tracking-widest uppercase first:pl-0 last:pr-0"
                  style={{ color: A.muted, borderBottom: `1px solid ${A.amberBorder}`, letterSpacing: '0.08em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const dte = getDTE(pos.expiry);
              const totalPremium = pos.premiumCollected * pos.contracts * 100;
              const returnPct = pos.strike > 0 ? (pos.premiumCollected / pos.strike) * 100 : 0;
              const dteColor = dte <= 7 ? '#ff4d6d' : dte <= 21 ? A.amber : '#9ab4d4';
              return (
                <tr key={pos.id} className="group"
                  style={{ borderBottom: i < positions.length - 1 ? `1px solid rgba(245,200,66,0.06)` : 'none' }}>
                  <td className="py-3.5 px-4 first:pl-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                      <span className="text-xs" style={{ color: A.muted }}>{pos.contracts}x</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ color: A.amber, background: A.amberBg, border: `1px solid ${A.amberBorder}`, fontFamily: 'JetBrains Mono, monospace' }}>
                      {pos.strategy}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span style={{ color: A.text, fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{pos.expiry}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>
                        ${totalPremium.toFixed(0)}
                      </span>
                      <span className="text-xs" style={{ color: A.muted }}>${pos.premiumCollected.toFixed(2)}/sh</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold" style={{ color: '#00d68f', fontFamily: 'JetBrains Mono, monospace' }}>
                      {returnPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums" style={{ color: dteColor, fontFamily: 'JetBrains Mono, monospace' }}>{dte}d</span>
                      {dte <= 7 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(255,77,109,0.12)', color: '#ff4d6d', border: '1px solid rgba(255,77,109,0.2)' }}>
                          EXP
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 last:pr-0">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <ActionButton onClick={() => onExpire(pos)} color={A.amber} title="Expire worthless"><ExpireIcon /></ActionButton>
                      <ActionButton onClick={() => onAssign(pos)} color="#9ab4d4" title="Mark assigned"><AssignIcon /></ActionButton>
                      <ActionButton onClick={() => onClose(pos)} color="#00e5c4" title="Close position"><CloseIcon /></ActionButton>
                      <ActionButton onClick={() => onEdit(pos)} color={A.muted} title="Edit"><EditIcon /></ActionButton>
                      <ActionButton onClick={() => onDelete(pos.id)} color={A.muted} title="Delete"><TrashIcon /></ActionButton>
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

// ─── History table ────────────────────────────────────────────────────────────
function HistoryTable({ positions }: { positions: PaperPosition[] }) {
  const statusLabel: Record<PaperPosition['status'], { label: string; color: string }> = {
    open: { label: 'Open', color: A.amber },
    closed: { label: 'Closed', color: '#00e5c4' },
    assigned: { label: 'Assigned', color: '#9ab4d4' },
    expired: { label: 'Expired', color: '#00d68f' },
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ fontFamily: 'DM Sans, sans-serif', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            {['Ticker', 'Strategy', 'Strike', 'Opened', 'Status', 'Realized P&L'].map((h) => (
              <th key={h} className="text-left py-2 px-3 text-xs font-medium tracking-widest uppercase first:pl-0"
                style={{ color: A.muted, borderBottom: `1px solid ${A.amberBorder}` }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos, i) => {
            const s = statusLabel[pos.status];
            const pnl = pos.realizedPnl ?? 0;
            return (
              <tr key={pos.id} style={{ borderBottom: i < positions.length - 1 ? `1px solid rgba(245,200,66,0.04)` : 'none' }}>
                <td className="py-2.5 px-3 first:pl-0">
                  <span className="font-semibold" style={{ color: A.text, fontFamily: 'Syne, sans-serif' }}>{pos.ticker}</span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: A.amber, background: A.amberBg, fontFamily: 'JetBrains Mono, monospace' }}>
                    {pos.strategy}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>${pos.strike}</span>
                </td>
                <td className="py-2.5 px-3">
                  <span style={{ color: A.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{pos.openedAt}</span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="text-xs" style={{ color: s.color }}>{s.label}</span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-semibold" style={{ color: pnl >= 0 ? '#00d68f' : '#ff4d6d', fontFamily: 'JetBrains Mono, monospace' }}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Metric({ label, value, color = A.text }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
    </div>
  );
}

function ActionButton({ onClick, color, title, children }: { onClick: () => void; color: string; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150"
      style={{ color }}>
      {children}
    </button>
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
      <div className="w-full max-w-md rounded-2xl p-6"
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Ticker</label>
            <input value={form.ticker} placeholder="AAPL"
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
          </div>
        </div>

        {/* Strike + Contracts */}
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

        {/* Expiry */}
        <div>
          <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>Expiration Date</label>
          <input type="date" value={form.expiry} onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle('expiry'), colorScheme: 'dark' }} />
          {errors.expiry && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.expiry}</p>}
        </div>

        {/* Premium */}
        <div>
          <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
            Option Price <span style={{ color: '#2e4a6a' }}>(per share · market quote)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: A.muted }}>$</span>
            <input type="number" step="0.01" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
              placeholder="1.45" className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm" style={inputStyle('premium')} />
          </div>
          {form.premium && form.contracts && (
            <p className="text-xs mt-1" style={{ color: A.amber, fontFamily: 'JetBrains Mono, monospace' }}>
              Total: ${(Number(form.premium) * Number(form.contracts) * 100).toFixed(0)} ({form.contracts} contract{Number(form.contracts) !== 1 ? 's' : ''} × 100 shares)
            </p>
          )}
          {errors.premium && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.premium}</p>}
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
          Buy-Back Price <span style={{ color: '#2e4a6a' }}>(per share)</span>
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
          <input type="date" value={form.expiry} onChange={(e) => setForm((f) => ({ ...f, expiry: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle('expiry'), colorScheme: 'dark' }} />
          {errors.expiry && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.expiry}</p>}
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: A.muted, fontFamily: 'DM Sans, sans-serif' }}>
            Option Price <span style={{ color: '#2e4a6a' }}>(per share)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: A.muted }}>$</span>
            <input type="number" step="0.01" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))}
              className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm" style={inputStyle('premium')} />
          </div>
          {errors.premium && <p className="text-xs mt-1" style={{ color: '#ff4d6d' }}>{errors.premium}</p>}
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

// ─── Icons ────────────────────────────────────────────────────────────────────
function ExpireIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 3.5v3l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 7l3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M9 2l2 2-6.5 6.5-2.5.5.5-2.5L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
