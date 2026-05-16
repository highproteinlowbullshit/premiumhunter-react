import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Search, Trophy, Lightbulb, BarChart2,
  Calendar, Award, Sun, Cloud, CloudDrizzle, type LucideIcon,
} from 'lucide-react';
import { usePaperMode } from '../context/PaperModeContext';
import type { DashboardIntelligence } from '../hooks/useDashboardIntelligence';
import { PositionsIntelligenceCard } from './PositionsIntelligenceCard';
import { useRealtimePrices } from '../hooks/useRealtimePrices';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt$(n: number, compact = false): string {
  if (compact) {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
  }
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skel({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'rgba(74,106,138,0.15)',
      animation: 'pulse 1.6s ease-in-out infinite',
      flexShrink: 0,
    }} />
  );
}

// ── Zone 1: Greeting bar ───────────────────────────────────────────────────────

function HealthPopover({ factors, score, label, onClose, wrapperRef }: {
  factors: DashboardIntelligence['portfolioHealthFactors'];
  score: number;
  label: string;
  onClose: () => void;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, wrapperRef]);

  useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const W = Math.min(320, window.innerWidth - 24);
    const PAD = 12;
    // Right-align with button, clamp so neither edge escapes the viewport
    const left = Math.max(PAD, Math.min(rect.right - W, window.innerWidth - W - PAD));
    setPos({ top: rect.bottom + 8, left });
  }, [wrapperRef]);

  const labelColor = score >= 85 ? '#00e5c4' : score >= 70 ? '#00e5c4' : score >= 50 ? '#f5c842' : '#ff4d6d';

  if (!pos) return null;

  return (
    <div
      style={{
        position: 'fixed', top: pos.top, left: pos.left, width: Math.min(320, window.innerWidth - 24), zIndex: 1000,
        background: 'rgba(5,13,26,0.98)', border: '1px solid rgba(0,229,196,0.2)',
        borderRadius: 14, padding: '18px 20px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 14, rowGap: 10, alignItems: 'center', marginBottom: 10 }}>
        {factors.map(f => (
          <>
            <span key={`${f.factor}-name`} style={{ fontSize: 12, color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>{f.factor}</span>
            <span key={`${f.factor}-note`} style={{ fontSize: 11, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', textAlign: 'right', whiteSpace: 'nowrap' }}>{f.note}</span>
            <span key={`${f.factor}-score`} style={{ fontSize: 12, fontWeight: 700, color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {f.score}/{f.maxScore}
            </span>
          </>
        ))}
      </div>
      <div style={{ borderTop: '1px solid rgba(0,229,196,0.1)', paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif' }}>Overall</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: labelColor, fontFamily: 'JetBrains Mono, monospace' }}>
          {score}/100 — {label}
        </span>
      </div>
    </div>
  );
}

function GreetingBar({ d, isPaper }: { d: DashboardIntelligence; isPaper: boolean }) {
  const [healthOpen, setHealthOpen] = useState(false);
  const healthWrapperRef = useRef<HTMLDivElement>(null);

  const dotColor = d.isMarketOpen ? '#00d68f'
    : (d.marketStatus === 'Pre-market' || d.marketStatus === 'After-hours') ? '#f5c842'
    : '#4a6a8a';

  const healthColor = d.portfolioHealthScore >= 85 ? '#00e5c4'
    : d.portfolioHealthScore >= 70 ? '#00e5c4'
    : d.portfolioHealthScore >= 50 ? '#f5c842'
    : '#ff4d6d';

  const healthBg = d.portfolioHealthScore >= 70 ? 'rgba(0,229,196,0.1)'
    : d.portfolioHealthScore >= 50 ? 'rgba(245,200,66,0.1)'
    : 'rgba(255,77,109,0.1)';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      {/* Left: greeting + market */}
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, fontFamily: 'Syne, sans-serif', color: 'var(--ph-text-1)', letterSpacing: '-0.02em' }}>
          {d.greeting}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0,
              ...(d.isMarketOpen ? { animation: 'pulse-glow 2s ease-in-out infinite' } : {}),
            }} />
            <span style={{ fontSize: 12, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
              {d.dayOfWeek} — {d.marketStatus}
            </span>
          </div>
          {d.marketClosesIn && (
            <span style={{ fontSize: 11, color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{d.marketClosesIn}</span>
          )}
          {d.marketOpensIn && (
            <span style={{ fontSize: 11, color: '#f5c842', fontFamily: 'DM Sans, sans-serif' }}>{d.marketOpensIn}</span>
          )}
          {d.isExpiryFriday && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f5c842', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.25)', borderRadius: 20, padding: '2px 8px', fontFamily: 'DM Sans, sans-serif' }}>
              <Calendar size={10} strokeWidth={2} />
              Expiry Friday
            </span>
          )}
          {isPaper && (
            <span style={{ fontSize: 11, color: '#f5c842', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.25)', borderRadius: 20, padding: '2px 8px', fontFamily: 'DM Sans, sans-serif' }}>
              PAPER MODE
            </span>
          )}
        </div>
      </div>

      {/* Right: health pill */}
      <div ref={healthWrapperRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setHealthOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: healthBg, border: `1px solid ${healthColor}40`,
            borderRadius: 20, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>Portfolio health</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: healthColor, fontFamily: 'JetBrains Mono, monospace' }}>
            {d.portfolioHealthLabel} · {d.portfolioHealthScore}
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: healthColor }}>
            <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {healthOpen && (
          <HealthPopover
            factors={d.portfolioHealthFactors}
            score={d.portfolioHealthScore}
            label={d.portfolioHealthLabel}
            onClose={() => setHealthOpen(false)}
            wrapperRef={healthWrapperRef}
          />
        )}
      </div>
    </div>
  );
}

// ── Zone 2: Primary insight card ───────────────────────────────────────────────

function InsightIcon({ type, size = 18 }: { type: string; size?: number }) {
  const props = { size, strokeWidth: 1.8 };
  if (type === 'warning') return <AlertTriangle {...props} />;
  if (type === 'opportunity') return <Search {...props} />;
  if (type === 'achievement') return <Trophy {...props} />;
  if (type === 'suggestion') return <Lightbulb {...props} />;
  return <BarChart2 {...props} />;
}

const INSIGHT_COLORS = {
  warning: { border: '#ff4d6d', bg: 'rgba(255,77,109,0.05)' },
  opportunity: { border: '#00e5c4', bg: 'rgba(0,229,196,0.05)' },
  achievement: { border: '#f5c842', bg: 'rgba(245,200,66,0.06)' },
  suggestion: { border: '#60a5fa', bg: 'rgba(96,165,250,0.05)' },
  neutral: { border: 'rgba(0,229,196,0.15)', bg: 'transparent' },
};

function PrimaryInsightCard({ insight, isPaper }: {
  insight: DashboardIntelligence['primaryInsight'];
  isPaper: boolean;
}) {
  const navigate = useNavigate();
  const c = INSIGHT_COLORS[insight.type];

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '14px 16px', borderRadius: 12, marginBottom: 12,
      background: c.bg, borderLeft: `3px solid ${c.border}`,
      border: `1px solid ${c.border}40`,
      borderLeftWidth: 3,
    }}>
      <div style={{ flexShrink: 0, color: c.border, marginTop: 1 }}>
        <InsightIcon type={insight.type} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ph-text-1)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4 }}>
          {isPaper ? `(Paper) ${insight.headline}` : insight.headline}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
          {insight.detail}
        </p>
      </div>
      {insight.action && (
        <button
          onClick={() => navigate(insight.action!.route)}
          style={{
            flexShrink: 0, alignSelf: 'center',
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            color: '#00e5c4', background: 'rgba(0,229,196,0.1)',
            border: '1px solid rgba(0,229,196,0.25)', borderRadius: 8,
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          {insight.action.label} →
        </button>
      )}
    </div>
  );
}

// ── Zone 3: Quick stats row ────────────────────────────────────────────────────

function StatPill({ label, value, sub, color, isPaper, children }: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  isPaper?: boolean;
  children?: React.ReactNode;
}) {
  const accent = isPaper ? '#f5c842' : (color ?? '#00e5c4');
  return (
    <div style={{
      minWidth: 120, padding: '10px 16px',
      background: 'rgba(13,27,53,0.6)',
      border: '1px solid rgba(0,229,196,0.08)',
      borderRadius: 10, flexShrink: 0,
    }}>
      <div style={{ fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', marginTop: 2, whiteSpace: 'nowrap' }}>
          {sub}
        </div>
      )}
      {children}
    </div>
  );
}

function classifyIvEnvironment(rank: number): {
  label: string;
  conditions: string;
  color: string;
  Icon: LucideIcon;
} {
  if (rank >= 50) return { label: 'Elevated',   conditions: 'Favourable for sellers', color: '#f5c842',  Icon: Sun          };
  if (rank >= 20) return { label: 'Normal',      conditions: 'Standard conditions',    color: '#00e5c4',  Icon: Cloud        };
                  return { label: 'Suppressed',  conditions: 'Thin premium',           color: '#9ab4d4',  Icon: CloudDrizzle };
}

function QuickStatsRow({ d, isPaper }: { d: DashboardIntelligence; isPaper: boolean }) {
  const tmColor = d.thisMonth.targetAmount > 0
    ? (d.thisMonth.targetProgress >= 100 ? '#00d68f' : d.thisMonth.isOnTrack ? '#00e5c4' : '#f5c842')
    : '#00e5c4';

  const wrColor = d.thisMonth.winRate >= 75 ? '#00e5c4'
    : d.thisMonth.winRate >= 60 ? '#f5c842'
    : d.thisMonth.winRate > 0 ? '#ff4d6d'
    : 'var(--ph-text-3)';

  const depColor = d.capitalEfficiencyPercent >= 80 ? '#00d68f'
    : d.capitalEfficiencyPercent >= 50 ? '#00e5c4'
    : d.capitalEfficiencyPercent < 30 ? '#f5c842'
    : '#9ab4d4';

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
      {/* This month */}
      <StatPill
        label="This month"
        value={fmt$(d.thisMonth.premiumCollected, true)}
        color={tmColor}
        isPaper={isPaper}
      >
        {d.thisMonth.targetAmount > 0 && (
          <>
            <div style={{ height: 3, background: 'rgba(0,229,196,0.1)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, d.thisMonth.targetProgress)}%`, background: tmColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
              {d.thisMonth.targetProgress.toFixed(0)}% of {fmt$(d.thisMonth.targetAmount, true)}
            </div>
          </>
        )}
      </StatPill>

      {/* Win rate */}
      <StatPill
        label="Win rate"
        value={d.thisMonth.positionsClosed > 0 ? `${d.thisMonth.winRate.toFixed(0)}%` : '—'}
        sub={d.allTimeWinRate > 0 ? `${d.allTimeWinRate.toFixed(0)}% all time` : undefined}
        color={wrColor}
        isPaper={isPaper}
      />

      {/* Open positions */}
      <StatPill
        label="Open"
        value={`${d.openPositionCount}`}
        color={isPaper ? '#f5c842' : '#9ab4d4'}
        isPaper={isPaper}
      >
        {d.totalPremiumAtRisk > 0 && (
          <div style={{ fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
            {fmt$(d.totalPremiumAtRisk, true)} premium
          </div>
        )}
        {d.positions.filter(p => p.dteZone !== 'comfortable').length > 0 && (
          <div style={{ fontSize: 10, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f5c842', display: 'inline-block' }} />
            {d.positions.filter(p => p.dteZone !== 'comfortable').length} expiring this week
          </div>
        )}
      </StatPill>

      {/* Deployed */}
      <StatPill
        label="Deployed"
        value={`${Math.min(100, d.capitalEfficiencyPercent).toFixed(0)}%`}
        sub={d.totalCollateralDeployed > 0 ? `${fmt$(d.totalCollateralDeployed, true)} working` : 'No collateral'}
        color={depColor}
        isPaper={isPaper}
      />

      {/* Market IV environment */}
      {d.spyIvRank !== null && (() => {
        const { label, conditions, color, Icon } = classifyIvEnvironment(d.spyIvRank!);
        return (
          <StatPill
            label="Market IV"
            value={label}
            sub={`SPY rank ${d.spyIvRank}`}
            color={color}
            isPaper={isPaper}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <Icon size={10} color={color} strokeWidth={2} />
              <span style={{ fontSize: 9, color, fontFamily: 'DM Sans, sans-serif' }}>{conditions}</span>
            </div>
          </StatPill>
        );
      })()}

    </div>
  );
}

// ── Zone 4: Secondary insights ─────────────────────────────────────────────────

function SecondaryInsightsRow({ insights }: { insights: DashboardIntelligence['secondaryInsights'] }) {
  if (insights.length === 0) return null;

  const chipBg = (type: string) =>
    type === 'warning' ? 'rgba(255,77,109,0.08)'
    : type === 'opportunity' ? 'rgba(0,229,196,0.08)'
    : type === 'achievement' ? 'rgba(245,200,66,0.08)'
    : 'rgba(13,27,53,0.5)';

  const chipBorder = (type: string) =>
    type === 'warning' ? 'rgba(255,77,109,0.25)'
    : type === 'opportunity' ? 'rgba(0,229,196,0.25)'
    : type === 'achievement' ? 'rgba(245,200,66,0.25)'
    : 'rgba(0,229,196,0.08)';

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {insights.map((ins, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px',
          background: chipBg(ins.type),
          border: `1px solid ${chipBorder(ins.type)}`,
          borderRadius: 20, fontSize: 12,
          color: 'var(--ph-text-2)',
          fontFamily: 'DM Sans, sans-serif',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ color: chipBorder(ins.type).replace('0.25)', '0.8)'), display: 'flex' }}>
            <InsightIcon type={ins.type} size={12} />
          </div>
          <span>{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── Zone 5: Capital deployment ─────────────────────────────────────────────────

function DeploymentBar({ label, pct, color, sub }: { label: string; pct: number; color: string; sub: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ph-text-2)', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: 'rgba(0,229,196,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>{sub}</div>
    </div>
  );
}

function CapitalDeploymentRing({ d }: { d: DashboardIntelligence }) {
  const { shares, cash } = d.capitalDeployment;

  const sharesPct = shares.totalHeld > 0
    ? Math.min(100, Math.round((shares.totalCovered / shares.totalHeld) * 100))
    : 0;
  const cashPct = cash.available > 0
    ? Math.min(100, Math.round((cash.cspDeployed / cash.available) * 100))
    : 0;

  const coveredTickers = shares.byTicker.filter(t => t.covered > 0);

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', background: 'rgba(13,27,53,0.5)', border: '1px solid rgba(0,229,196,0.08)', borderRadius: 12, padding: '14px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
        Capital Deployment
      </span>

      {/* Shares (CC) */}
      {shares.totalHeld > 0 ? (
        <>
          <DeploymentBar
            label="Shares (CC)"
            pct={sharesPct}
            color="#00e5c4"
            sub={shares.totalCovered > 0
              ? `${shares.totalCovered} / ${shares.totalHeld} shares covered`
              : 'No active covered calls'}
          />
          {coveredTickers.length > 0 && (
            <div style={{ marginTop: -8, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {coveredTickers.map(t => (
                <div key={t.ticker} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                  <span style={{ color: '#00e5c4' }}>{t.ticker}</span>
                  <span>{t.covered} / {t.held} sh</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ph-text-2)', fontFamily: 'DM Sans, sans-serif' }}>Shares (CC)</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            Add share holdings in Portfolio to track CC coverage.
          </span>
        </div>
      )}

      {/* Cash (CSP) */}
      {d.accountBalance > 0 ? (
        <DeploymentBar
          label="Cash (CSP)"
          pct={cashPct}
          color="#00e5c4"
          sub={cash.cspDeployed > 0
            ? `${fmt$(cash.cspDeployed, true)} of ${fmt$(cash.available, true)} deployed`
            : `${fmt$(cash.available, true)} available`}
        />
      ) : (
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ph-text-2)', fontFamily: 'DM Sans, sans-serif' }}>Cash (CSP)</span>
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--ph-text-3)', fontFamily: 'DM Sans, sans-serif' }}>
            Set your account balance in Settings to track cash deployment.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

function CommandCentreLoading() {
  return (
    <div style={{ marginBottom: 32 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      {/* Zone 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skel w={160} h={22} />
          <Skel w={240} h={14} />
        </div>
        <Skel w={160} h={30} r={20} />
      </div>
      {/* Zone 2 */}
      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(13,27,53,0.5)', border: '1px solid rgba(0,229,196,0.06)', marginBottom: 12, display: 'flex', gap: 14 }}>
        <Skel w={24} h={24} r={4} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skel w="80%" h={14} />
          <Skel w="60%" h={12} />
        </div>
      </div>
      {/* Zone 3 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[120, 110, 100, 120, 100].map((w, i) => <Skel key={i} w={w} h={70} r={10} />)}
      </div>
      {/* Zone 4 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[180, 220, 160].map((w, i) => <Skel key={i} w={w} h={28} r={20} />)}
      </div>
      {/* Zone 5 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Skel w="50%" h={120} r={12} />
        <Skel w="50%" h={120} r={12} />
      </div>
    </div>
  );
}

// ── Milestone toast ────────────────────────────────────────────────────────────

function MilestoneToast({ milestone, onDismiss }: {
  milestone: DashboardIntelligence['milestones'][0];
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 20px', borderRadius: 14,
      background: 'rgba(5,13,26,0.98)', border: '1px solid rgba(245,200,66,0.4)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,200,66,0.1)',
      minWidth: 280, maxWidth: 400,
    }}>
      <Award size={24} color="#f5c842" strokeWidth={1.5} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#f5c842', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
          New milestone!
        </div>
        <div style={{ fontSize: 13, color: '#e8f0fe', fontFamily: 'DM Sans, sans-serif' }}>
          {milestone.label}
        </div>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

interface Props {
  data: DashboardIntelligence | null;
  isLoading: boolean;
}

export function DashboardCommandCentre({ data: d, isLoading }: Props) {
  const { isPaperMode } = usePaperMode();
  const navigate = useNavigate();

  // Subscribe to live WebSocket prices for open positions — same feed as WheelTracker.
  const openTickers = useMemo(
    () => (d?.positions ?? []).map(p => p.ticker),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(d?.positions ?? []).map(p => p.ticker).join(',')]
  );
  const { prices: livePrices } = useRealtimePrices(openTickers);
  const [toastDismissed, setToastDismissed] = useState(false);

  const newMilestone = d?.milestones.find(m => m.isNew) ?? null;
  const milestoneShown = (() => { try { return !!sessionStorage.getItem('milestone_shown'); } catch { return false; } })();
  const showToast = newMilestone && !toastDismissed && !milestoneShown;

  useEffect(() => {
    if (showToast) sessionStorage.setItem('milestone_shown', 'true');
  }, [showToast]);

  if (isLoading || !d) return <CommandCentreLoading />;

  return (
    <div style={{
      marginBottom: 28,
      ...(isPaperMode ? { borderLeft: '3px solid #f5c842', paddingLeft: 16 } : {}),
    }}>
      <style>{`@keyframes pulse-glow{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Zone 1 */}
      <GreetingBar d={d} isPaper={isPaperMode} />

      {/* Zone 2 */}
      <PrimaryInsightCard insight={d.primaryInsight} isPaper={isPaperMode} />

      {/* Zone 3 */}
      <QuickStatsRow d={d} isPaper={isPaperMode} />

      {/* Zone 4 */}
      <SecondaryInsightsRow insights={d.secondaryInsights} />

      {/* Zone 5 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ flex: '1.2 1 280px', display: 'flex', flexDirection: 'column' }}>
          <PositionsIntelligenceCard
            positions={d.positions}
            summary={d.positionsSummary}
            isLoading={false}
            onNavigateToTracker={() => navigate('/wheel')}
            livePrices={livePrices}
          />
        </div>
        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column' }}>
          <CapitalDeploymentRing d={d} />
        </div>
      </div>

      {/* Milestone toast */}
      {showToast && newMilestone && (
        <MilestoneToast milestone={newMilestone} onDismiss={() => setToastDismissed(true)} />
      )}
    </div>
  );
}
