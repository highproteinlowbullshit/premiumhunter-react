import { useState, useEffect, useRef } from 'react';
import { useMonthlyTarget } from '../hooks/useMonthlyTarget';
import { usePaperMode } from '../context/PaperModeContext';
import { useToast } from '../context/ToastContext';

// ── Confetti ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#00e5c4', '#00c6f5', '#f5c842', '#00d68f', '#ff9f43', '#ff6b9d', '#a78bfa', '#34d399'];

const confettiStyle = `@keyframes confetti-fly {
  0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-130px) translateX(var(--ph-cx,0px)) rotate(var(--ph-cr,360deg)); opacity: 0; }
}`;

function ConfettiParticles() {
  return (
    <>
      <style>{confettiStyle}</style>
      {Array.from({ length: 12 }, (_, i) => {
        const cx = (i % 2 === 0 ? 1 : -1) * (8 + i * 4);
        const cr = 150 + i * 35;
        const size = 6 + (i % 3) * 3;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              bottom: 20,
              left: `${10 + i * 6.5}%`,
              width: size,
              height: size,
              borderRadius: i % 2 === 0 ? '50%' : '2px',
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              ['--ph-cx' as string]: `${cx}px`,
              ['--ph-cr' as string]: `${cr}deg`,
              animation: `confetti-fly ${0.8 + (i % 4) * 0.15}s ease-out ${i * 50}ms forwards`,
              pointerEvents: 'none',
              zIndex: 10,
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}

// ── Set / edit target card ────────────────────────────────────────────────────

function SetTargetCard({
  currentMonth,
  lastMonthMissed,
  lastMonthShortfall,
  lastMonthTarget,
  initialValue,
  onSave,
  isSaving,
  onCancel,
  isPaper,
}: {
  currentMonth: string;
  lastMonthMissed: boolean;
  lastMonthShortfall: number;
  lastMonthTarget: number | null;
  initialValue?: number;
  onSave: (amount: number) => void;
  isSaving: boolean;
  onCancel?: () => void;
  isPaper: boolean;
}) {
  const [value, setValue] = useState(initialValue ? String(initialValue) : '');
  const accentColor = isPaper ? '#f5c842' : '#00e5c4';

  const handleSave = () => {
    const n = Number(value);
    if (n > 0) onSave(n);
  };

  return (
    <div className="rounded-xl p-4"
      style={{
        background: isPaper ? 'rgba(245,200,66,0.05)' : 'rgba(0,229,196,0.05)',
        border: `1px solid ${isPaper ? 'rgba(245,200,66,0.15)' : 'rgba(0,229,196,0.12)'}`,
      }}>
      <p className="text-sm mb-3" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
        Set your income target for {currentMonth}
      </p>

      {/* Quick-fill shortcuts */}
      <div className="flex flex-wrap gap-2 mb-3">
        {lastMonthMissed && lastMonthShortfall > 0 && (
          <button
            type="button"
            onClick={() => setValue(String(lastMonthShortfall))}
            className="text-xs px-2.5 py-1 rounded-lg"
            style={{
              background: 'rgba(245,200,66,0.08)',
              border: '1px solid rgba(245,200,66,0.2)',
              color: '#f5c842',
              fontFamily: 'DM Sans, sans-serif',
            }}>
            Carry over shortfall: +${lastMonthShortfall.toFixed(0)}
          </button>
        )}
        {lastMonthTarget && (
          <button
            type="button"
            onClick={() => setValue(String(lastMonthTarget))}
            className="text-xs px-2.5 py-1 rounded-lg"
            style={{
              background: 'rgba(0,229,196,0.06)',
              border: '1px solid rgba(0,229,196,0.15)',
              color: '#00e5c4',
              fontFamily: 'DM Sans, sans-serif',
            }}>
            Same as last: ${lastMonthTarget.toLocaleString()}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#4a6a8a' }}>$</span>
          <input
            type="number"
            step="100"
            min="1"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="e.g. 2000"
            className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm"
            style={{
              background: 'rgba(5,13,26,0.8)',
              border: `1px solid ${accentColor}26`,
              color: '#e8f0fe',
              fontFamily: 'JetBrains Mono, monospace',
              caretColor: accentColor,
              outline: 'none',
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !value || Number(value) <= 0}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-40"
          style={{
            background: isPaper
              ? 'linear-gradient(135deg, #f5c842, #f59e0b)'
              : 'linear-gradient(135deg, #00e5c4, #00b4d8)',
            color: isPaper ? '#1a1200' : '#050d1a',
            fontFamily: 'DM Sans, sans-serif',
          }}>
          {isSaving ? '…' : 'Set'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-[rgba(255,255,255,0.04)]"
            style={{ color: '#4a6a8a', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main tracker card ─────────────────────────────────────────────────────────

export function MonthlyTargetTracker() {
  const { progress, isLoading, setTarget, isSetting } = useMonthlyTarget();
  const { isPaperMode } = usePaperMode();
  const { showToast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiFiredRef = useRef(false);

  const accentColor = isPaperMode ? '#f5c842' : '#00e5c4';
  const cardBorder = isPaperMode ? 'rgba(245,200,66,0.2)' : 'rgba(0,229,196,0.1)';

  // Fire confetti once when target is first reached
  useEffect(() => {
    if (!confettiFiredRef.current && progress?.progressPercent != null && progress.progressPercent >= 100 && progress.target !== null) {
      confettiFiredRef.current = true;
      setShowConfetti(true);
      showToast('🎉 Monthly income target reached!', 'success');
      setTimeout(() => setShowConfetti(false), 2500);
    }
  }, [progress?.progressPercent, progress?.target, showToast]);

  const handleSetTarget = async (amount: number) => {
    await setTarget(amount);
    setEditMode(false);
    showToast('Target saved', 'success');
  };

  const handleCarryOver = async () => {
    if (!progress?.target || !progress.lastMonthShortfall) return;
    const newTarget = progress.target + progress.lastMonthShortfall;
    await setTarget(newTarget);
    showToast(`Target updated to $${newTarget.toFixed(0)}`, 'success');
  };

  const showBehindPaceBanner =
    !bannerDismissed &&
    progress !== undefined &&
    progress.target !== null &&
    progress.tradingDaysLeft <= 5 &&
    progress.progressPercent < 85;

  const showCarryOverNote = progress?.lastMonthMissed && progress.lastMonthShortfall > 0 && progress.target !== null;

  const hasTarget = !isLoading && progress?.target;

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 mb-6 relative overflow-hidden"
      style={{
        background: 'rgba(13,27,53,0.6)',
        border: `1px solid ${cardBorder}`,
        backdropFilter: 'blur(12px)',
      }}>
      {showConfetti && <ConfettiParticles />}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            Monthly Income Target
          </h2>
          {isPaperMode && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-semibold tracking-widest"
              style={{
                background: 'rgba(245,200,66,0.12)',
                color: '#f5c842',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
              PAPER
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          {progress?.currentMonth ?? ''}
        </span>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          <div className="h-4 rounded-full animate-pulse" style={{ background: 'rgba(0,229,196,0.06)', width: '55%' }} />
          <div className="h-3 rounded-full animate-pulse" style={{ background: 'rgba(0,229,196,0.04)', animationDelay: '80ms' }} />
          <div className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(0,229,196,0.04)', animationDelay: '160ms' }} />
        </div>
      )}

      {/* No target set (or edit mode) */}
      {!isLoading && (!hasTarget || editMode) && (
        <SetTargetCard
          currentMonth={progress?.currentMonth ?? ''}
          lastMonthMissed={progress?.lastMonthMissed ?? false}
          lastMonthShortfall={progress?.lastMonthShortfall ?? 0}
          lastMonthTarget={progress?.lastMonthTarget ?? null}
          initialValue={editMode && progress?.target ? progress.target : undefined}
          onSave={handleSetTarget}
          isSaving={isSetting}
          onCancel={editMode ? () => setEditMode(false) : undefined}
          isPaper={isPaperMode}
        />
      )}

      {/* Target set and not editing */}
      {hasTarget && !editMode && progress && (
        <>
          {/* Progress amounts */}
          <div className="flex items-end justify-between mb-2">
            <div>
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: accentColor }}>
                ${progress.earned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-sm ml-1.5" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                / ${progress.target!.toLocaleString()}
              </span>
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                color: progress.progressPercent >= 100 ? '#00d68f'
                  : progress.progressPercent >= 70 ? accentColor
                  : '#f5c842',
              }}>
              {progress.progressPercent.toFixed(1)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, progress.progressPercent)}%`,
                background: progress.progressPercent >= 100
                  ? 'linear-gradient(90deg, #00d68f, #00e5c4)'
                  : progress.progressPercent >= 70
                  ? `linear-gradient(90deg, ${accentColor}60, ${accentColor})`
                  : 'linear-gradient(90deg, #f5c84260, #f5c842)',
                boxShadow: progress.progressPercent >= 100
                  ? '0 0 12px rgba(0,214,143,0.5)'
                  : `0 0 8px ${accentColor}40`,
              }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              {
                label: 'Days Left',
                value: String(progress.tradingDaysLeft),
                color: progress.tradingDaysLeft <= 3 ? '#ff4d6d' : '#9ab4d4',
              },
              {
                label: 'Need / Day',
                value: progress.dailyPaceNeeded !== null && progress.dailyPaceNeeded > 0
                  ? `$${progress.dailyPaceNeeded.toFixed(0)}`
                  : '—',
                color: '#9ab4d4',
              },
              {
                label: 'Streak',
                value: progress.streak > 0 ? `${progress.streak}mo` : '—',
                color: progress.streak >= 3 ? '#00d68f' : '#9ab4d4',
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-lg p-2.5 text-center"
                style={{ background: 'rgba(5,13,26,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs mb-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
                <p className="text-sm font-bold tabular-nums" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Behind-pace banner */}
          {showBehindPaceBanner && (
            <div
              className="rounded-xl px-4 py-3 mb-3 flex items-center gap-3"
              style={{ background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.2)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <path d="M7 1l6 12H1L7 1z" stroke="#ff4d6d" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M7 6v3M7 10.5v.5" stroke="#ff4d6d" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <p className="text-xs flex-1" style={{ color: '#ff8ca8', fontFamily: 'DM Sans, sans-serif' }}>
                {progress.tradingDaysLeft === 0
                  ? 'Month ending — '
                  : `Only ${progress.tradingDaysLeft} day${progress.tradingDaysLeft !== 1 ? 's' : ''} left — `}
                at <strong>{progress.progressPercent.toFixed(0)}%</strong> of target.
                {progress.dailyPaceNeeded !== null && progress.dailyPaceNeeded > 0 && (
                  <> Need ${progress.dailyPaceNeeded.toFixed(0)}/day to catch up.</>
                )}
              </p>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)]"
                style={{ color: '#ff4d6d', flexShrink: 0 }}>
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          {/* Carry-over note */}
          {showCarryOverNote && (
            <div
              className="rounded-xl px-4 py-3 mb-3 flex items-center gap-3"
              style={{ background: 'rgba(245,200,66,0.05)', border: '1px solid rgba(245,200,66,0.18)' }}>
              <p className="text-xs flex-1" style={{ color: '#c9a422', fontFamily: 'DM Sans, sans-serif' }}>
                Last month missed by{' '}
                <span style={{ color: '#f5c842', fontFamily: 'JetBrains Mono, monospace' }}>
                  ${progress.lastMonthShortfall.toFixed(0)}
                </span>.
              </p>
              <button
                type="button"
                onClick={handleCarryOver}
                className="text-xs px-2.5 py-1 rounded-lg whitespace-nowrap"
                style={{
                  background: 'rgba(245,200,66,0.1)',
                  border: '1px solid rgba(245,200,66,0.22)',
                  color: '#f5c842',
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                +${progress.lastMonthShortfall.toFixed(0)} to target
              </button>
            </div>
          )}

          {/* Edit target link */}
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="text-xs"
            style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif' }}>
            Edit target
          </button>
        </>
      )}
    </div>
  );
}

// ── Compact card (for Dashboard) ──────────────────────────────────────────────

export function MonthlyTargetCompact() {
  const { progress, isLoading } = useMonthlyTarget();
  const { isPaperMode } = usePaperMode();

  if (isLoading || !progress?.target) return null;

  const pct = Math.min(100, progress.progressPercent);
  const accentColor = isPaperMode ? '#f5c842' : '#00e5c4';

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'rgba(13,27,53,0.6)',
        border: `1px solid ${isPaperMode ? 'rgba(245,200,66,0.15)' : 'rgba(0,229,196,0.1)'}`,
        backdropFilter: 'blur(12px)',
      }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium" style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif' }}>
          Monthly Target{isPaperMode ? ' · Paper' : ''}
        </p>
        <span
          className="text-xs font-bold tabular-nums"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            color: pct >= 100 ? '#00d68f' : accentColor,
          }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 100
              ? 'linear-gradient(90deg, #00d68f, #00e5c4)'
              : `linear-gradient(90deg, ${accentColor}50, ${accentColor})`,
          }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs tabular-nums" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
          ${progress.earned.toLocaleString(undefined, { maximumFractionDigits: 0 })} earned
        </span>
        <span className="text-xs tabular-nums" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
          ${progress.target.toLocaleString()} target · {progress.tradingDaysLeft}d left
        </span>
      </div>
    </div>
  );
}
