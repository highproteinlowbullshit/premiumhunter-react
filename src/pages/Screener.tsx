import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SECTORS,
  SECTOR_COLORS,
  SORT_OPTIONS,
  type ScreenerStock,
  type SortField,
  type Sector,
} from '../lib/screenerData';
import { useWatchlistContext } from '../context/WatchlistContext';
import { useScreenerStream } from '../hooks/useMarketData';
import { usePaperMode } from '../context/PaperModeContext';
import { usePaperActions } from '../hooks/usePaperTrading';
import { PaperTradeModal } from '../components/PaperModals';
import { TopPicksSection } from '../components/TopPicksSection';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// IV data freshness
// ─────────────────────────────────────────────────────────────────────────────
interface CronRunLog {
  completed_at: string;
  stocks_succeeded: number;
  stocks_failed: number;
}

function useIVFreshness() {
  const [lastRun, setLastRun] = useState<CronRunLog | null>(null);

  useEffect(() => {
    supabase
      .from('cron_run_logs')
      .select('completed_at, stocks_succeeded, stocks_failed')
      .eq('function_name', 'calculate-iv-rank')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setLastRun(data as CronRunLog); });
  }, []);

  return lastRun;
}

function IVFreshnessBadge({ lastRun }: { lastRun: CronRunLog | null }) {
  if (!lastRun) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4a6a8a' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a6a8a', flexShrink: 0 }} />
        IV data pending — first calculation runs tonight
      </span>
    );
  }

  const completedAt = new Date(lastRun.completed_at);
  const now = new Date();
  const isToday =
    completedAt.getDate() === now.getDate() &&
    completedAt.getMonth() === now.getMonth() &&
    completedAt.getFullYear() === now.getFullYear();
  const isYesterday = !isToday && now.getTime() - completedAt.getTime() < 48 * 60 * 60 * 1000;
  const timeStr = completedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ab4d4' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d68f', flexShrink: 0 }} />
        IV data from today's close ({timeStr})
      </span>
    );
  }
  if (isYesterday) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ab4d4' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f5c842', flexShrink: 0 }} />
        IV data from yesterday's close — updates tonight
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4a6a8a' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a6a8a', flexShrink: 0 }} />
      IV data may be stale — check cron schedule
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatVolume(v: number | null): string {
  if (v == null) return '--';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function ivRankColors(iv: number | null) {
  if (iv == null) return { text: '#4a6a8a', bg: 'rgba(74,106,138,0.08)', border: 'rgba(74,106,138,0.15)' };
  if (iv < 30) return { text: '#00d68f', bg: 'rgba(0,214,143,0.12)',  border: 'rgba(0,214,143,0.25)'  };
  if (iv < 60) return { text: '#f5c842', bg: 'rgba(245,200,66,0.12)', border: 'rgba(245,200,66,0.25)' };
  if (iv < 80) return { text: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' };
  return           { text: '#ff4d6d', bg: 'rgba(255,77,109,0.12)',  border: 'rgba(255,77,109,0.25)'  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Filters {
  ivRankMin: number;
  ivRankMax: number;
  priceMin: string;
  priceMax: string;
  sector: 'All' | Sector;
  sortBy: SortField;
  sortDir: 'desc' | 'asc';
  search: string;
}

const DEFAULT_FILTERS: Filters = {
  ivRankMin: 50,
  ivRankMax: 100,
  priceMin: '',
  priceMax: '',
  sector: 'All',
  sortBy: 'ivRank',
  sortDir: 'desc',
  search: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function Screener() {
  const navigate = useNavigate();
  const { isWatched, addTicker, removeTicker } = useWatchlistContext();
  const { isPaperMode, paperAccount } = usePaperMode();
  const { openPaperPosition } = usePaperActions();
  const [paperTradeStock, setPaperTradeStock] = useState<ScreenerStock | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { stocks, loadedCount, total, isLoading } = useScreenerStream();
  const loading = isLoading && stocks.length === 0;
  const lastRun = useIVFreshness();

  useEffect(() => { setMounted(true); }, []);

  // Debounce search input 300ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [filters.search]);

  const set = useCallback(<K extends keyof Filters>(key: K, val: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: val }));
  }, []);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedSearch('');
  };

  // ── Filtered + sorted stocks ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toUpperCase();
    const priceMin = filters.priceMin !== '' ? Number(filters.priceMin) : 0;
    const priceMax = filters.priceMax !== '' ? Number(filters.priceMax) : Infinity;

    return stocks.filter((s) => {
      // Null = still loading: pass range filters (show row with '--'), but
      // exclude when the user has narrowed the range from its full extent.
      const ivRangeIsNarrowed = filters.ivRankMin > 0 || filters.ivRankMax < 100;
      if (s.ivRank != null && (s.ivRank < filters.ivRankMin || s.ivRank > filters.ivRankMax)) return false;
      if (s.ivRank == null && ivRangeIsNarrowed) return false;

      const priceRangeIsNarrowed = priceMin > 0 || priceMax < Infinity;
      if (s.price != null && (s.price < priceMin || s.price > priceMax)) return false;
      if (s.price == null && priceRangeIsNarrowed) return false;

      if (filters.sector !== 'All' && s.sector !== filters.sector) return false;
      if (q && !s.ticker.includes(q) && !s.name.toUpperCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      // Nulls sink to the bottom regardless of sort direction
      const av = a[filters.sortBy] ?? (filters.sortDir === 'desc' ? -Infinity : Infinity);
      const bv = b[filters.sortBy] ?? (filters.sortDir === 'desc' ? -Infinity : Infinity);
      const cmp = (av as number | string) > (bv as number | string) ? 1 : (av as number | string) < (bv as number | string) ? -1 : 0;
      return filters.sortDir === 'desc' ? -cmp : cmp;
    });
  }, [stocks, filters.ivRankMin, filters.ivRankMax, filters.priceMin, filters.priceMax,
      filters.sector, filters.sortBy, filters.sortDir, debouncedSearch]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const highIV  = filtered.filter((s) => s.ivRank != null && s.ivRank >= 70).length;
    const withIV  = filtered.filter((s) => s.ivRank != null);
    const avgIV   = withIV.length ? Math.round(withIV.reduce((a, s) => a + s.ivRank!, 0) / withIV.length) : 0;
    return { total: filtered.length, avgIV, highIV };
  }, [filtered]);

  const isDirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <>
    <div className="min-h-screen mesh-bg pt-20 pb-12">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between mb-5"
          style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, rgba(0,229,196,0.4), transparent)' }} />
              <span className="text-xs font-medium tracking-widest uppercase"
                style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                Options Screener
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold"
              style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe', letterSpacing: '-0.02em' }}>
              IV Rank Screener
            </h1>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                Find premium-selling opportunities by implied volatility rank
              </p>
              <IVFreshnessBadge lastRun={lastRun} />
            </div>
          </div>
          {/* Result count + live/loading indicator */}
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: 'rgba(0,229,196,0.3)', borderTopColor: '#00e5c4' }} />
                <span style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                  {loadedCount} / {total}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d68f', boxShadow: '0 0 4px #00d68f' }} />
                <span style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', fontSize: '12px' }}>Live</span>
              </div>
            )}
            <div className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              Showing{' '}
              <span style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>{stats.total}</span>
              {' '}of{' '}
              <span style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>{stocks.length}</span>
              {' '}loaded
            </div>
          </div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        <StatsBar stats={stats} mounted={mounted} />

        {/* ── Filter controls ────────────────────────────────────────────── */}
        <FilterControls
          filters={filters}
          set={set}
          onReset={resetFilters}
          isDirty={isDirty}
          mounted={mounted}
        />
      </div>

      {/* ── Top Picks ────────────────────────────────────────────────────── */}
      <TopPicksSection screenerData={stocks} isLoading={isLoading} />

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-4">
        {loading ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(13,27,53,0.5)',
                border: '1px solid rgba(0,229,196,0.1)',
                backdropFilter: 'blur(12px)',
              }}>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <StickyHeader filters={filters} set={set} />
                  <tbody>
                    {filtered.map((stock, i) => (
                      <DesktopRow
                        key={stock.ticker}
                        stock={stock}
                        isLast={i === filtered.length - 1}
                        watched={isWatched(stock.ticker)}
                        onToggleWatch={() => isWatched(stock.ticker) ? removeTicker(stock.ticker) : addTicker(stock.ticker)}
                        onClick={() => navigate(`/stock/${stock.ticker}`)}
                        isPaperMode={isPaperMode}
                        onPaperTrade={() => setPaperTradeStock(stock)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((stock) => (
                <MobileCard
                  key={stock.ticker}
                  stock={stock}
                  watched={isWatched(stock.ticker)}
                  onToggleWatch={() => isWatched(stock.ticker) ? removeTicker(stock.ticker) : addTicker(stock.ticker)}
                  onClick={() => navigate(`/stock/${stock.ticker}`)}
                  isPaperMode={isPaperMode}
                  onPaperTrade={() => setPaperTradeStock(stock)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>

    {paperTradeStock && (
      <PaperTradeModal
        ticker={paperTradeStock.ticker}
        spotPrice={paperTradeStock.price ?? 0}
        iv={(paperTradeStock.ivRank ?? 30) / 100}
        currentCash={paperAccount?.currentCash ?? 0}
        onClose={() => setPaperTradeStock(null)}
        onSubmit={async (data) => {
          const err = await openPaperPosition(data);
          if (!err) setPaperTradeStock(null);
          return err;
        }}
      />
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Bar
// ─────────────────────────────────────────────────────────────────────────────
function StatsBar({ stats, mounted }: { stats: { total: number; avgIV: number; highIV: number }; mounted: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-4"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease 0.1s' }}>
      {[
        { label: 'Matching Stocks', value: stats.total, color: '#00e5c4', suffix: '' },
        { label: 'Avg IV Rank',     value: stats.avgIV, color: stats.avgIV >= 60 ? '#f97316' : stats.avgIV >= 30 ? '#f5c842' : '#00d68f', suffix: '' },
        { label: 'High IV Alerts',  value: stats.highIV, color: '#ff4d6d', suffix: '' },
      ].map(({ label, value, color, suffix }) => (
        <div key={label} className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'rgba(13,27,53,0.5)', border: '1px solid rgba(0,229,196,0.08)' }}>
          <span className="text-xs" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
          <span className="text-lg font-bold tabular-nums"
            style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
            {value}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter Controls
// ─────────────────────────────────────────────────────────────────────────────
function FilterControls({
  filters, set, onReset, isDirty, mounted
}: {
  filters: Filters;
  set: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  onReset: () => void;
  isDirty: boolean;
  mounted: boolean;
}) {
  const panelStyle = {
    background: 'rgba(13,27,53,0.6)',
    border: '1px solid rgba(0,229,196,0.1)',
    backdropFilter: 'blur(12px)',
    opacity: mounted ? 1 : 0,
    transition: 'opacity 0.4s ease 0.15s',
  };

  const inputStyle = {
    background: 'rgba(5,13,26,0.8)',
    border: '1px solid rgba(0,229,196,0.12)',
    color: '#e8f0fe',
    fontFamily: 'JetBrains Mono, monospace',
    outline: 'none',
    caretColor: '#00e5c4',
  };

  return (
    <div className="rounded-2xl p-4 sm:p-5 mb-2" style={panelStyle}>
      {/* Row 1: Search + Sector + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4a6a8a' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Search ticker or name…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.3)')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.12)')}
          />
        </div>

        {/* Sector */}
        <div className="relative">
          <select
            value={filters.sector}
            onChange={(e) => set('sector', e.target.value as typeof filters.sector)}
            className="appearance-none pl-3 pr-8 py-2.5 rounded-xl text-sm cursor-pointer"
            style={{ ...inputStyle, minWidth: '150px' }}
          >
            {SECTORS.map((s) => (
              <option key={s} value={s} style={{ background: '#0a1628' }}>{s}</option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#4a6a8a' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Sort by */}
        <div className="relative">
          <select
            value={filters.sortBy}
            onChange={(e) => set('sortBy', e.target.value as SortField)}
            className="appearance-none pl-3 pr-8 py-2.5 rounded-xl text-sm cursor-pointer"
            style={{ ...inputStyle, minWidth: '130px' }}
          >
            {SORT_OPTIONS.map(({ field, label }) => (
              <option key={field} value={field} style={{ background: '#0a1628' }}>{label}</option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#4a6a8a' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Sort dir toggle */}
        <button
          onClick={() => set('sortDir', filters.sortDir === 'desc' ? 'asc' : 'desc')}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 whitespace-nowrap"
          style={{
            background: 'rgba(0,229,196,0.08)',
            border: '1px solid rgba(0,229,196,0.15)',
            color: '#00e5c4',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {filters.sortDir === 'desc' ? (
            <><SortDescIcon /> High → Low</>
          ) : (
            <><SortAscIcon /> Low → High</>
          )}
        </button>

        {/* Reset */}
        {isDirty && (
          <button
            onClick={onReset}
            className="px-3 py-2.5 rounded-xl text-sm transition-all duration-200 whitespace-nowrap hover:opacity-80"
            style={{
              background: 'rgba(255,77,109,0.08)',
              border: '1px solid rgba(255,77,109,0.15)',
              color: '#ff4d6d',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Row 2: IV rank slider + Price range */}
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        {/* IV Rank dual slider */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              IV Rank Range
            </span>
            <span className="text-xs font-semibold"
              style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
              {filters.ivRankMin} – {filters.ivRankMax}
            </span>
          </div>
          <DualRangeSlider
            min={0} max={100}
            values={[filters.ivRankMin, filters.ivRankMax]}
            onChange={([lo, hi]) => { set('ivRankMin', lo); set('ivRankMax', hi); }}
          />
          {/* Zone labels */}
          <div className="flex justify-between mt-1.5">
            {[
              { label: 'Low', pos: '15%', color: '#00d68f' },
              { label: 'Med', pos: '45%', color: '#f5c842' },
              { label: 'Hot', pos: '70%', color: '#f97316' },
              { label: 'High', pos: '90%', color: '#ff4d6d' },
            ].map(({ label, color }) => (
              <span key={label} className="text-[9px] font-semibold tracking-wider" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div className="flex items-center gap-2">
          <span className="text-xs whitespace-nowrap" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>Price</span>
          <div className="relative w-24">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#4a6a8a' }}>$</span>
            <input
              type="number"
              value={filters.priceMin}
              onChange={(e) => set('priceMin', e.target.value)}
              placeholder="Min"
              className="w-full pl-5 pr-2 py-2 rounded-lg text-xs"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.3)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.12)')}
            />
          </div>
          <span className="text-xs" style={{ color: '#2e4a6a' }}>–</span>
          <div className="relative w-24">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#4a6a8a' }}>$</span>
            <input
              type="number"
              value={filters.priceMax}
              onChange={(e) => set('priceMax', e.target.value)}
              placeholder="Max"
              className="w-full pl-5 pr-2 py-2 rounded-lg text-xs"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.3)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.12)')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dual Range Slider
// ─────────────────────────────────────────────────────────────────────────────
function DualRangeSlider({
  min, max, values, onChange,
}: {
  min: number; max: number;
  values: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const [lo, hi] = values;
  const loPercent = ((lo - min) / (max - min)) * 100;
  const hiPercent = ((hi - min) / (max - min)) * 100;

  const handleLo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.min(Number(e.target.value), hi - 1);
    onChange([v, hi]);
  };
  const handleHi = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(Number(e.target.value), lo + 1);
    onChange([lo, v]);
  };

  return (
    <div className="relative h-5 flex items-center">
      {/* Background track */}
      <div className="absolute w-full h-1 rounded-full"
        style={{ background: 'rgba(255,255,255,0.07)' }} />
      {/* Inactive zones — color coded */}
      <div className="absolute h-1 rounded-full pointer-events-none"
        style={{
          left: `${loPercent}%`,
          width: `${hiPercent - loPercent}%`,
          background: 'linear-gradient(90deg, #00d68f, #f5c842 45%, #f97316 68%, #ff4d6d)',
        }} />
      {/* Min thumb */}
      <input
        type="range" min={min} max={max} value={lo}
        onChange={handleLo}
        className="range-slider-thumb"
        style={{ zIndex: lo > hi - 10 ? 5 : 3 }}
      />
      {/* Max thumb */}
      <input
        type="range" min={min} max={max} value={hi}
        onChange={handleHi}
        className="range-slider-thumb"
        style={{ zIndex: 4 }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky Table Header
// ─────────────────────────────────────────────────────────────────────────────
function StickyHeader({ filters, set }: {
  filters: Filters;
  set: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
}) {
  const COLS = [
    { key: 'ticker',       label: 'Symbol'    },
    { key: null,           label: 'Sector'    },
    { key: 'price',        label: 'Price'     },
    { key: 'ivRank',       label: 'IV Rank'   },
    { key: 'ivPercentile', label: 'IV%ile'    },
    { key: null,           label: 'IV/HV'     },
    { key: null,           label: '52w Range' },
    { key: 'volume',       label: 'Volume'    },
    { key: null,           label: 'Earnings'  },
    { key: null,           label: ''          }, // action
  ] as const;

  const handleColSort = (key: string | null) => {
    if (!key) return;
    if (filters.sortBy === key) {
      set('sortDir', filters.sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      set('sortBy', key as SortField);
      set('sortDir', 'desc');
    }
  };

  return (
    <thead>
      <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(0,229,196,0.08)' }}>
        {COLS.map(({ key, label }, i) => (
          <th
            key={i}
            onClick={() => handleColSort(key)}
            className={`text-left py-3 px-3 text-xs font-medium tracking-widest whitespace-nowrap select-none ${key ? 'cursor-pointer hover:text-[#e8f0fe]' : ''}`}
            style={{
              color: filters.sortBy === key ? '#00e5c4' : '#4a6a8a',
              letterSpacing: '0.07em',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'color 0.15s',
              paddingLeft: i === 0 ? '20px' : undefined,
              paddingRight: i === COLS.length - 1 ? '20px' : undefined,
            }}
          >
            {label}
            {filters.sortBy === key && (
              <span className="ml-1">{filters.sortDir === 'desc' ? '↓' : '↑'}</span>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop Row
// ─────────────────────────────────────────────────────────────────────────────
function DesktopRow({
  stock, isLast, watched, onToggleWatch, onClick, isPaperMode, onPaperTrade,
}: {
  stock: ScreenerStock;
  isLast: boolean;
  watched: boolean;
  onToggleWatch: () => void;
  onClick: () => void;
  isPaperMode: boolean;
  onPaperTrade: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const ivColors = ivRankColors(stock.ivRank);
  const sectorColors = SECTOR_COLORS[stock.sector];
  const earningsDte = stock.earningsDate ? daysUntil(stock.earningsDate) : null;
  const earningsUrgent = earningsDte !== null && earningsDte <= 14;

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(0,229,196,0.035)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid rgba(0,229,196,0.05)',
        cursor: 'pointer',
        transition: 'background 0.12s ease',
      }}
    >
      {/* Symbol */}
      <td className="py-3.5 pl-5 pr-3">
        <div>
          <p className="text-sm font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            {stock.ticker}
          </p>
          <p className="text-xs mt-0.5 max-w-[120px] truncate" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            {stock.name}
          </p>
        </div>
      </td>

      {/* Sector */}
      <td className="py-3.5 px-3">
        <span className="inline-flex text-xs px-2 py-0.5 rounded-md font-medium whitespace-nowrap"
          style={{ color: sectorColors.text, background: sectorColors.bg, border: `1px solid ${sectorColors.border}`, fontFamily: 'DM Sans, sans-serif' }}>
          {stock.sector}
        </span>
      </td>

      {/* Price */}
      <td className="py-3.5 px-3">
        <p className="text-sm font-medium tabular-nums" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>
          {stock.price != null ? `$${stock.price.toFixed(2)}` : '--'}
        </p>
        <p className="text-xs" style={{
          color: stock.priceChange != null ? (stock.priceChange >= 0 ? '#00d68f' : '#ff4d6d') : '#4a6a8a',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {stock.priceChange != null ? `${stock.priceChange >= 0 ? '+' : ''}${stock.priceChange.toFixed(2)}%` : '--'}
        </p>
      </td>

      {/* IV Rank — hero column */}
      <td className="py-3.5 px-3">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center justify-center w-12 py-1 rounded-lg text-sm font-bold tabular-nums"
            style={{ color: ivColors.text, background: ivColors.bg, border: `1px solid ${ivColors.border}`, fontFamily: 'JetBrains Mono, monospace' }}>
            {stock.ivRank ?? '--'}
          </span>
          {/* Mini bar */}
          <div className="h-1 w-12 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full" style={{ width: stock.ivRank != null ? `${stock.ivRank}%` : '0%', background: ivColors.text, boxShadow: `0 0 4px ${ivColors.text}80` }} />
          </div>
        </div>
      </td>

      {/* IV Percentile */}
      <td className="py-3.5 px-3">
        <span className="text-sm tabular-nums" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
          {stock.ivPercentile ?? '--'}
        </span>
      </td>

      {/* IV/HV ratio */}
      <td className="py-3.5 px-3">
        <span className="text-sm font-medium tabular-nums"
          style={{
            color: stock.ivHvRatio != null
              ? (stock.ivHvRatio >= 1.3 ? '#f97316' : stock.ivHvRatio >= 1.1 ? '#f5c842' : '#9ab4d4')
              : '#4a6a8a',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
          {stock.ivHvRatio != null ? `${stock.ivHvRatio.toFixed(2)}x` : '--'}
        </span>
      </td>

      {/* 52w IV range */}
      <td className="py-3.5 px-3">
        <p className="text-xs tabular-nums" style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
          {stock.iv52wkLow != null && stock.iv52wkHigh != null
            ? `${stock.iv52wkLow}% – ${stock.iv52wkHigh}%`
            : '—'}
        </p>
        {/* Range bar showing current position */}
        <div className="mt-1 h-1 w-16 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full"
            style={{
              width: stock.currentIV != null && stock.iv52wkLow != null && stock.iv52wkHigh != null && stock.iv52wkHigh !== stock.iv52wkLow
                ? `${((stock.currentIV - stock.iv52wkLow) / (stock.iv52wkHigh - stock.iv52wkLow)) * 100}%`
                : '0%',
              background: '#9ab4d4',
            }} />
        </div>
      </td>

      {/* Volume */}
      <td className="py-3.5 px-3">
        <span className="text-sm tabular-nums" style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
          {formatVolume(stock.volume)}
        </span>
      </td>

      {/* Earnings */}
      <td className="py-3.5 px-3">
        {earningsDte !== null ? (
          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-md font-medium"
            style={{
              color: earningsUrgent ? '#ff4d6d' : '#4a6a8a',
              background: earningsUrgent ? 'rgba(255,77,109,0.1)' : 'transparent',
              border: earningsUrgent ? '1px solid rgba(255,77,109,0.2)' : '1px solid transparent',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
            {earningsDte > 0 ? `${earningsDte}d` : 'Today'}
          </span>
        ) : (
          <span className="text-xs" style={{ color: '#2e4a6a' }}>—</span>
        )}
      </td>

      {/* Action */}
      <td className="py-3.5 pl-3 pr-5">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isPaperMode && (
            <button
              onClick={onPaperTrade}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-90"
              style={{ background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.3)', color: '#f5c842', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
              title="Paper trade this"
            >
              Paper Trade
            </button>
          )}
          <button
            onClick={onToggleWatch}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{
              background: watched ? 'rgba(0,229,196,0.15)' : 'rgba(255,255,255,0.04)',
              border: watched ? '1px solid rgba(0,229,196,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: watched ? '#00e5c4' : '#4a6a8a',
            }}
            title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {watched ? <CheckIcon /> : <PlusIcon />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Card
// ─────────────────────────────────────────────────────────────────────────────
function MobileCard({
  stock, watched, onToggleWatch, onClick, isPaperMode, onPaperTrade,
}: {
  stock: ScreenerStock;
  watched: boolean;
  onToggleWatch: () => void;
  onClick: () => void;
  isPaperMode: boolean;
  onPaperTrade: () => void;
}) {
  const ivColors = ivRankColors(stock.ivRank);
  const sectorColors = SECTOR_COLORS[stock.sector];
  const earningsDte = stock.earningsDate ? daysUntil(stock.earningsDate) : null;
  const earningsUrgent = earningsDte !== null && earningsDte <= 14;

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-4 cursor-pointer"
      style={{
        background: 'rgba(13,27,53,0.6)',
        border: '1px solid rgba(0,229,196,0.1)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Row 1: ticker + badge + watchlist btn */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                {stock.ticker}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ color: sectorColors.text, background: sectorColors.bg, fontFamily: 'DM Sans, sans-serif', fontSize: '10px' }}>
                {stock.sector}
              </span>
              {earningsUrgent && (
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ color: '#ff4d6d', background: 'rgba(255,77,109,0.1)', fontFamily: 'JetBrains Mono, monospace', fontSize: '9px' }}>
                  ER {earningsDte}d
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              {stock.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* IV Rank badge */}
          <span className="inline-flex items-center justify-center w-10 py-1 rounded-lg text-sm font-bold"
            style={{ color: ivColors.text, background: ivColors.bg, border: `1px solid ${ivColors.border}`, fontFamily: 'JetBrains Mono, monospace' }}>
            {stock.ivRank ?? '--'}
          </span>
          {/* Paper trade button */}
          {isPaperMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onPaperTrade(); }}
              className="px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(245,200,66,0.15)', border: '1px solid rgba(245,200,66,0.3)', color: '#f5c842', fontFamily: 'DM Sans, sans-serif' }}
            >
              Paper
            </button>
          )}
          {/* Watch button */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleWatch(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: watched ? 'rgba(0,229,196,0.15)' : 'rgba(255,255,255,0.04)',
              border: watched ? '1px solid rgba(0,229,196,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: watched ? '#00e5c4' : '#4a6a8a',
            }}
          >
            {watched ? <CheckIcon /> : <PlusIcon />}
          </button>
        </div>
      </div>

      {/* Row 2: metrics */}
      <div className="grid grid-cols-4 gap-2">
        {[
          {
            label: 'Price',
            value: stock.price != null ? `$${stock.price.toFixed(2)}` : '--',
            sub: stock.priceChange != null ? `${stock.priceChange >= 0 ? '+' : ''}${stock.priceChange.toFixed(2)}%` : null,
            subColor: stock.priceChange != null ? (stock.priceChange >= 0 ? '#00d68f' : '#ff4d6d') : '',
          },
          { label: 'IV%ile', value: stock.ivPercentile != null ? String(stock.ivPercentile) : '--', sub: null, subColor: '' },
          { label: 'IV/HV', value: stock.ivHvRatio != null ? `${stock.ivHvRatio.toFixed(2)}x` : '--', sub: null, subColor: '' },
          { label: 'Volume', value: formatVolume(stock.volume), sub: null, subColor: '' },
        ].map(({ label, value, sub, subColor }) => (
          <div key={label}>
            <p className="text-xs mb-0.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>{label}</p>
            <p className="text-sm font-medium tabular-nums" style={{ color: '#e8f0fe', fontFamily: 'JetBrains Mono, monospace' }}>{value}</p>
            {sub && <p className="text-xs" style={{ color: subColor, fontFamily: 'JetBrains Mono, monospace' }}>{sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Loading
// ─────────────────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(13,27,53,0.5)', border: '1px solid rgba(0,229,196,0.1)' }}>
      <div className="hidden md:block">
        {/* Header skeleton */}
        <div className="px-5 py-3 flex gap-4" style={{ borderBottom: '1px solid rgba(0,229,196,0.06)', background: 'rgba(0,0,0,0.15)' }}>
          {[80, 100, 70, 60, 60, 60, 80, 60, 60].map((w, i) => (
            <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}px` }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(0,229,196,0.04)' }}>
            <div className="skeleton h-4 rounded" style={{ width: '64px' }} />
            <div className="skeleton h-5 rounded-md" style={{ width: '90px' }} />
            <div className="skeleton h-4 rounded" style={{ width: '58px' }} />
            <div className="skeleton h-7 rounded-lg" style={{ width: '48px' }} />
            <div className="skeleton h-4 rounded" style={{ width: '40px' }} />
            <div className="skeleton h-4 rounded" style={{ width: '50px' }} />
            <div className="skeleton h-4 rounded" style={{ width: '80px' }} />
            <div className="skeleton h-4 rounded" style={{ width: '50px' }} />
            <div className="skeleton h-5 rounded-md" style={{ width: '40px' }} />
            <div className="skeleton h-7 w-7 rounded-lg ml-auto" />
          </div>
        ))}
      </div>
      {/* Mobile skeletons */}
      <div className="md:hidden p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex justify-between mb-3">
              <div className="skeleton h-5 rounded w-20" />
              <div className="skeleton h-7 w-10 rounded-lg" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, j) => <div key={j} className="skeleton h-8 rounded" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl py-20 flex flex-col items-center gap-4"
      style={{ background: 'rgba(13,27,53,0.5)', border: '1px solid rgba(0,229,196,0.1)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.12)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="#00e5c4" strokeWidth="1.4" strokeOpacity="0.4" />
          <path d="M7 11h8M11 7v8" stroke="#00e5c4" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.4" />
          <line x1="17" y1="17" x2="22" y2="22" stroke="#00e5c4" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.4" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-base font-semibold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
          No stocks match your filters
        </p>
        <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Try adjusting the IV rank range or removing other filters
        </p>
      </div>
      <button onClick={onReset}
        className="mt-1 px-5 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: 'rgba(0,229,196,0.1)', border: '1px solid rgba(0,229,196,0.2)', color: '#00e5c4', fontFamily: 'DM Sans, sans-serif' }}>
        Reset Filters
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SortDescIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 3h8M2 6h5M2 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function SortAscIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 3h3M2 6h5M2 9h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
