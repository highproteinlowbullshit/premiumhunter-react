// src/components/TradeChecklist.tsx
import type { ChecklistResult, CheckResult, CheckStatus } from '../lib/tradeChecklist';

interface TradeChecklistProps {
  result: ChecklistResult | null;
  overriddenChecks: Set<string>;
  onToggleOverride: (checkId: string) => void;
  isLoading: boolean;
  strategy: 'CSP' | 'CC';
}

const STATUS_COLOR: Record<CheckStatus, string> = {
  pass:    '#00d68f',
  fail:    '#ff4d6d',
  warn:    '#f5c842',
  pending: '#4a6a8a',
  skip:    '#2a4060',
};

function StatusIcon({ status }: { status: CheckStatus }) {
  const color = STATUS_COLOR[status];
  if (status === 'pass') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="7" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.2" />
        <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'fail') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="7" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.2" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'warn') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <path d="M8 2L14.5 13H1.5L8 2z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 6v3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.75" fill={color} />
      </svg>
    );
  }
  if (status === 'pending') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.2" strokeDasharray="3 2" />
        <text x="8" y="11.5" textAnchor="middle" fontSize="9" fill={color} fontFamily="monospace">?</text>
      </svg>
    );
  }
  // skip
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 8h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid rgba(0,229,196,0.04)' }}>
      <div className="rounded-full" style={{ width: 16, height: 16, background: 'rgba(74,106,138,0.2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div className="rounded" style={{ width: 80, height: 10, background: 'rgba(74,106,138,0.15)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div className="rounded ml-auto" style={{ width: 60, height: 10, background: 'rgba(74,106,138,0.1)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  );
}

function CheckRow({ check, isOverridden, onToggleOverride }: {
  check: CheckResult;
  isOverridden: boolean;
  onToggleOverride: () => void;
}) {
  const color = STATUS_COLOR[check.status];
  const canInteract = check.canOverride && (check.status === 'fail' || check.status === 'warn' || isOverridden);

  return (
    <div
      className="flex items-start gap-2 py-2"
      style={{
        borderBottom: '1px solid rgba(0,229,196,0.04)',
        transition: 'background 0.2s ease',
      }}
      title={check.reasoning}
    >
      <div style={{ paddingTop: 1 }}>
        <StatusIcon status={check.status} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: '#c8daf0', fontFamily: 'DM Sans, sans-serif' }}>
            {check.label}
          </span>
          {isOverridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ color: '#f5c842', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.2)', fontFamily: 'DM Sans, sans-serif' }}>
              Overridden
            </span>
          )}
        </div>
        {check.value && (
          <p className="text-[11px] mt-0.5 truncate" style={{ color: color, fontFamily: 'JetBrains Mono, monospace', opacity: isOverridden ? 0.5 : 1 }}>
            {check.value}
          </p>
        )}
      </div>

      {canInteract && (
        <button
          type="button"
          onClick={onToggleOverride}
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
          style={{
            color: isOverridden ? '#4a6a8a' : '#f5c842',
            background: isOverridden ? 'rgba(74,106,138,0.08)' : 'rgba(245,200,66,0.08)',
            border: isOverridden ? '1px solid rgba(74,106,138,0.2)' : '1px solid rgba(245,200,66,0.15)',
            fontFamily: 'DM Sans, sans-serif',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          title={isOverridden ? 'Remove override' : 'Acknowledge this risk and proceed anyway'}
        >
          {isOverridden ? 'Undo' : 'Override'}
        </button>
      )}
    </div>
  );
}

export function TradeChecklist({ result, overriddenChecks, onToggleOverride, isLoading }: TradeChecklistProps) {
  if (isLoading || !result) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'rgba(5,13,26,0.5)', border: '1px solid rgba(0,229,196,0.08)' }}>
        <p className="text-xs mb-3 font-semibold tracking-wide uppercase"
          style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
          Trade Checklist
        </p>
        {isLoading ? (
          <>
            <p className="text-xs mb-3" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Checking trade conditions…</p>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </>
        ) : (
          <p className="text-xs" style={{ color: '#2a4060', fontFamily: 'DM Sans, sans-serif' }}>
            Fill in Ticker, Strategy, Strike, and Expiry to run checks.
          </p>
        )}
      </div>
    );
  }

  const { checks, overallStatus, passCount, canProceed } = result;
  const total = checks.filter((c) => c.status !== 'skip').length;
  const scoreColor = passCount >= 7 ? '#00d68f' : passCount >= 5 ? '#f5c842' : '#ff4d6d';
  const criticalFails = checks.filter((c) => c.status === 'fail' && c.isCritical);

  const bannerBg = overallStatus === 'clear'
    ? 'rgba(0,214,143,0.08)'
    : overallStatus === 'warnings'
    ? 'rgba(245,200,66,0.08)'
    : 'rgba(255,77,109,0.08)';
  const bannerBorder = overallStatus === 'clear'
    ? 'rgba(0,214,143,0.2)'
    : overallStatus === 'warnings'
    ? 'rgba(245,200,66,0.2)'
    : 'rgba(255,77,109,0.2)';
  const bannerColor = overallStatus === 'clear' ? '#00d68f' : overallStatus === 'warnings' ? '#f5c842' : '#ff4d6d';

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(5,13,26,0.5)', border: '1px solid rgba(0,229,196,0.08)' }}>
      {/* Header + progress */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
          Trade Checklist
        </p>
        <span className="text-xs font-semibold" style={{ color: scoreColor, fontFamily: 'JetBrains Mono, monospace' }}>
          {passCount}/{total}
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="rounded-full mb-3" style={{ height: 3, background: 'rgba(0,229,196,0.06)' }}>
        <div
          className="rounded-full"
          style={{
            height: 3,
            width: `${(passCount / Math.max(total, 1)) * 100}%`,
            background: scoreColor,
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      </div>

      {/* Check rows */}
      <div>
        {checks.map((check) => (
          <CheckRow
            key={check.id}
            check={check}
            isOverridden={overriddenChecks.has(check.id)}
            onToggleOverride={() => onToggleOverride(check.id)}
          />
        ))}
      </div>

      {/* Status banner */}
      <div
        className="rounded-lg px-3 py-2.5 mt-3"
        style={{
          background: bannerBg,
          border: `1px solid ${bannerBorder}`,
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}
      >
        <p className="text-xs font-semibold" style={{ color: bannerColor, fontFamily: 'DM Sans, sans-serif' }}>
          {overallStatus === 'clear' && '✓ All checks passed'}
          {overallStatus === 'warnings' && `⚠ Proceed with caution — ${result.warnCount + result.failCount} issue(s)`}
          {overallStatus === 'blocked' && '✗ Trade blocked'}
        </p>
        {!canProceed && criticalFails.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {criticalFails.map((c) => (
              <li key={c.id} className="text-[11px]" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>
                • {c.reasoning}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
