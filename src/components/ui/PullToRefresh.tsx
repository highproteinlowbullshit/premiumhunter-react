import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /**
   * If provided, this element's scrollTop is checked instead of window.scrollY.
   * Use this when the scrollable content is in a bounded div, not the window.
   */
  innerScrollRef?: React.RefObject<HTMLElement | null>;
}

const THRESHOLD = 64;
const INDICATOR_H = 44;

export function PullToRefresh({
  onRefresh, children, className, style, innerScrollRef,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const dirRef = useRef<'v' | 'h' | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isAtTop = () => {
      if (window.scrollY > 5) return false;
      if (innerScrollRef?.current && innerScrollRef.current.scrollTop > 5) return false;
      return true;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || !isAtTop()) return;
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      dirRef.current = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      const adx = Math.abs(e.touches[0].clientX - (startXRef.current ?? 0));

      if (!dirRef.current) {
        if (Math.abs(dy) > 6 || adx > 6) {
          dirRef.current = Math.abs(dy) > adx ? 'v' : 'h';
        }
        return;
      }
      if (dirRef.current === 'h' || dy <= 0) return;

      e.preventDefault();
      const resistance = dy < THRESHOLD ? dy : THRESHOLD + (dy - THRESHOLD) * 0.3;
      const clamped = Math.min(resistance, THRESHOLD * 1.5);
      pullRef.current = clamped;
      setPullPx(clamped);
    };

    const onTouchEnd = async () => {
      if (startYRef.current === null) return;
      const pd = pullRef.current;
      startYRef.current = null;
      dirRef.current = null;
      pullRef.current = 0;

      if (pd >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullPx(0);
        try { await onRefreshRef.current(); } finally {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      } else {
        setPullPx(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [innerScrollRef]);

  const visible = pullPx > 0 || refreshing;
  const offset = Math.min(refreshing ? INDICATOR_H : pullPx, INDICATOR_H);
  const ready = pullPx >= THRESHOLD;

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', ...style }}>
      {/* Pull indicator */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: visible ? offset : 0,
          overflow: 'hidden',
          transition: pullPx === 0 ? 'height 0.25s ease' : 'none',
          zIndex: 20,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          paddingBottom: 8,
          pointerEvents: 'none',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: ready || refreshing ? '#00e5c4' : '#4a6a8a',
          fontSize: 11, fontFamily: 'DM Sans, sans-serif',
          transition: 'color 0.15s',
        }}>
          <RefreshCw
            size={14}
            strokeWidth={2}
            className={refreshing ? 'animate-spin' : undefined}
            style={refreshing ? undefined : {
              transform: `rotate(${Math.min(pullPx / THRESHOLD, 1) * 180}deg)`,
            }}
          />
          {refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      </div>

      {/* Content shifts down while pulling */}
      <div style={{
        transform: visible ? `translateY(${offset}px)` : undefined,
        transition: pullPx === 0 ? 'transform 0.25s ease' : 'none',
      }}>
        {children}
      </div>
    </div>
  );
}
