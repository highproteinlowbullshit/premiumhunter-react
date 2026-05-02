import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import type { WheelPosition } from '../types';

interface Props {
  position: WheelPosition;
  onClose: () => void;
  onConfirm: () => void; // called after lot is created — triggers existing assignPosition flow
}

function ModalWrapper({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'rgba(2,8,19,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="min-h-full flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-lg rounded-2xl p-6"
          style={{
            background: 'rgba(10,22,40,0.98)',
            border: '1px solid rgba(0,229,196,0.2)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-200"
          style={{
            width: i === current ? 16 : 6,
            height: 6,
            background: i === current ? '#00e5c4' : 'rgba(0,229,196,0.2)',
          }}
        />
      ))}
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
      <span className="text-sm font-bold tabular-nums"
        style={{ color: valueColor ?? '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </span>
    </div>
  );
}

export function AssignmentFlowModal({ position, onClose, onConfirm }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const [step, setStep] = useState(0);
  const [assignmentDate, setAssignmentDate] = useState(today);
  const [contracts, setContracts] = useState(position.contracts);
  const [saving, setSaving] = useState(false);

  const isCSP = position.strategy === 'CSP';
  const shares = 100; // shares per contract
  const totalShares = contracts * shares;
  const grossCost = position.strike * totalShares;
  // position.premiumCollected is already total across all contracts; scale to assigned contracts
  const premiumPerContract = position.premiumCollected / position.contracts;
  const totalPremium = premiumPerContract * contracts;
  const netCost = Math.max(0, grossCost - totalPremium);
  const costPerShare = totalShares > 0 ? netCost / totalShares : 0;

  const handleCreateLot = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Insert lot
      const { data: lotData, error: lotErr } = await supabase
        .from('assigned_share_lots')
        .insert({
          user_id: user.id,
          ticker: position.ticker,
          shares,
          contracts,
          assignment_date: assignmentDate,
          assignment_strike: position.strike,
          gross_cost_basis: Math.round(grossCost * 100) / 100,
          total_premium_collected: Math.round(totalPremium * 100) / 100,
          net_cost_basis: Math.round(netCost * 100) / 100,
          cost_basis_per_share: Math.round(costPerShare * 100) / 100,
          status: 'holding',
        })
        .select('id')
        .single();

      if (lotErr) throw lotErr;

      // Insert CSP premium event
      if (lotData?.id) {
        await supabase.from('lot_premium_events').insert({
          lot_id: lotData.id,
          user_id: user.id,
          event_type: 'csp_premium',
          premium_amount: Math.round(totalPremium * 100) / 100,
          event_date: assignmentDate,
        });
      }

      // Invalidate portfolio-enhanced so AssignedSharesSection refreshes
      await queryClient.invalidateQueries({ queryKey: ['portfolio-enhanced'] });

      onConfirm(); // triggers existing assignPosition (wheel_positions + portfolio_holdings)
    } catch (err) {
      showToast('Failed to create share lot — assignment not saved', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 0: Assignment details ───────────────────────────────────────────────
  const Step0 = (
    <>
      <div className="rounded-xl p-4 mb-4"
        style={{ background: 'rgba(245,200,66,0.06)', border: '1px solid rgba(245,200,66,0.2)' }}>
        <p className="text-xs font-semibold mb-3 tracking-widest uppercase"
          style={{ color: '#f5c842', fontFamily: 'DM Sans, sans-serif' }}>
          {isCSP ? 'Put Assigned — Shares Purchased' : 'Call Assigned — Shares Called Away'}
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Ticker</p>
            <p className="text-sm font-bold" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
              {position.ticker}
            </p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Strike</p>
            <p className="text-sm font-bold" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
              ${position.strike}
            </p>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              Contracts
            </label>
            <input
              type="number"
              min={1}
              value={contracts}
              onChange={(e) => setContracts(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-lg px-2.5 py-1.5 text-sm font-bold tabular-nums outline-none"
              style={{
                background: 'rgba(0,229,196,0.06)',
                border: '1px solid rgba(0,229,196,0.2)',
                color: '#e8f0fe',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              Assignment Date
            </label>
            <input
              type="date"
              value={assignmentDate}
              onChange={(e) => setAssignmentDate(e.target.value)}
              className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none"
              style={{
                background: 'rgba(0,229,196,0.06)',
                border: '1px solid rgba(0,229,196,0.2)',
                color: '#e8f0fe',
                fontFamily: 'DM Sans, sans-serif',
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>
      </div>

      <p className="text-xs mb-5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
        This will create a <span style={{ color: '#00e5c4' }}>share lot</span> in the Assigned Shares section
        to track your true cost basis across the full wheel cycle.
      </p>

      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.05)]"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Cancel
        </button>
        <button onClick={() => setStep(1)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #f5c842, #f5a623)', color: '#0a1628', fontFamily: 'DM Sans, sans-serif' }}>
          Review Cost Basis →
        </button>
      </div>
    </>
  );

  // ── Step 1: Cost basis breakdown ─────────────────────────────────────────────
  const Step1 = (
    <>
      <div className="rounded-xl p-4 mb-4"
        style={{ background: 'rgba(0,229,196,0.04)', border: '1px solid rgba(0,229,196,0.12)' }}>
        <p className="text-xs font-semibold mb-3 tracking-widest uppercase"
          style={{ color: '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}>
          Cost Basis Breakdown
        </p>
        <Row label={`Gross cost (${contracts}× $${position.strike} × 100 shares)`}
          value={`$${grossCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          valueColor="#ff8fa3" />
        <Row label="CSP premium already collected"
          value={`−$${totalPremium.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          valueColor="#00e5c4" />
        <Row label="Net cost basis"
          value={`$${netCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          valueColor="#e8f0fe" />
        <Row label="Cost per share (break-even)"
          value={`$${costPerShare.toFixed(2)}`}
          valueColor="#00c6f5" />
        <Row label="Total shares acquired"
          value={`${totalShares.toLocaleString()} ${position.ticker}`}
          valueColor="#e8f0fe" />
      </div>

      <div className="rounded-lg px-4 py-3 mb-5"
        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs leading-relaxed" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Future CC premiums on this lot will reduce your net cost basis further.
          The <span style={{ color: '#00e5c4' }}>Assigned Shares</span> tracker shows your real-time break-even price
          as you collect more premium.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep(0)}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.05)]"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          ← Back
        </button>
        <button onClick={() => setStep(2)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #00e5c4, #00b4d8)', color: '#050d1a', fontFamily: 'DM Sans, sans-serif' }}>
          Next →
        </button>
      </div>
    </>
  );

  // ── Step 2: CC suggestion + confirm ──────────────────────────────────────────
  const targetCC = Math.ceil(position.strike * 1.02 / 0.5) * 0.5; // ~2% OTM rounded to $0.50
  const Step2 = (
    <>
      <div className="rounded-xl p-4 mb-4"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <p className="text-xs font-semibold mb-2 tracking-widest uppercase"
          style={{ color: '#818cf8', fontFamily: 'DM Sans, sans-serif' }}>
          Next Step — Sell a Covered Call
        </p>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          You now hold <span style={{ color: '#e8f0fe' }}>{totalShares} shares</span> of{' '}
          <span style={{ color: '#e8f0fe' }}>{position.ticker}</span>. Consider selling a covered call
          to continue collecting premium and further reduce your cost basis.
        </p>
        <div className="rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Suggested Strike</p>
              <p className="text-sm font-bold" style={{ color: '#818cf8', fontFamily: 'JetBrains Mono, monospace' }}>
                ${targetCC.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Target DTE</p>
              <p className="text-sm font-bold" style={{ color: '#818cf8', fontFamily: 'JetBrains Mono, monospace' }}>
                30–45d
              </p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Contracts</p>
              <p className="text-sm font-bold" style={{ color: '#818cf8', fontFamily: 'JetBrains Mono, monospace' }}>
                {contracts}×
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg px-4 py-3 mb-5"
        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs leading-relaxed" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Your break-even price is <span style={{ color: '#00e5c4' }}>${costPerShare.toFixed(2)}/share</span>.
          Selling the CC at ${targetCC.toFixed(2)} gives you upside room while continuing the wheel.
        </p>
      </div>

      <div className="flex gap-3">
        <button onClick={() => setStep(1)}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.05)]"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          ← Back
        </button>
        <button
          onClick={handleCreateLot}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #00e5c4, #00b4d8)', color: '#050d1a', fontFamily: 'DM Sans, sans-serif' }}>
          {saving ? 'Saving…' : 'Confirm Assignment'}
        </button>
      </div>
    </>
  );

  const steps = [Step0, Step1, Step2];
  const stepTitles = ['Assignment Details', 'Cost Basis Review', 'Next Steps'];
  const stepSubtitles = [
    `${position.ticker} ${position.strategy} · $${position.strike} strike · ${contracts}×`,
    `${totalShares} shares · $${costPerShare.toFixed(2)}/share break-even`,
    `Continue the wheel with a covered call`,
  ];

  return (
    <ModalWrapper onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            {stepTitles[step]}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            {stepSubtitles[step]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StepDots current={step} total={3} />
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: '#4a6a8a' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {steps[step]}
    </ModalWrapper>
  );
}
