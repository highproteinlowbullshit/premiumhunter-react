import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IVBadge } from '../components/IVBadge';
import { IVSparkline } from '../components/IVChart';
import { useWatchlist } from '../hooks/useWatchlist';
import { MOCK_IV_HISTORY, MOCK_STOCKS } from '../lib/mockData';
import { useWatchlistData } from '../hooks/useMarketData';
import type { SortOption, IVDataPoint } from '../types';

type SortField = SortOption['field'];

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'ticker', label: 'Ticker' },
  { field: 'ivRank', label: 'IV Rank' },
  { field: 'price', label: 'Price' },
  { field: 'ivPercentile', label: 'IV%ile' },
];

// Some extra stocks to add
const AVAILABLE_STOCKS = [
  { ticker: 'TSLA', name: 'Tesla Inc', price: 248.5, ivRank: 68, ivPercentile: 72, currentIV: 92, historicalVol: 75, trend: 'up' as const },
  { ticker: 'AMC', name: 'AMC Entertainment', price: 4.2, ivRank: 85, ivPercentile: 91, currentIV: 180, historicalVol: 148, trend: 'down' as const },
  { ticker: 'BBBY', name: 'Bed Bath & Beyond', price: 0.15, ivRank: 92, ivPercentile: 95, currentIV: 220, historicalVol: 190, trend: 'down' as const },
  { ticker: 'PLTR', name: 'Palantir Technologies', price: 22.8, ivRank: 45, ivPercentile: 52, currentIV: 68, historicalVol: 58, trend: 'up' as const },
  { ticker: 'RIVN', name: 'Rivian Automotive', price: 11.4, ivRank: 72, ivPercentile: 79, currentIV: 105, historicalVol: 88, trend: 'down' as const },
];

const ALL_STOCKS = [...MOCK_STOCKS, ...AVAILABLE_STOCKS];

export function Watchlist() {
  const navigate = useNavigate();
  const { tickers, sort, addTicker, removeTicker, updateSort } = useWatchlist();
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: liveData } = useWatchlistData(tickers);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAdd = (tickerVal?: string) => {
    const val = (tickerVal || addInput).toUpperCase().trim();
    if (!val) return;

    if (tickers.includes(val)) {
      setAddError(`${val} is already in your watchlist`);
      return;
    }

    addTicker(val);
    setAddInput('');
    setAddError('');
    setShowSuggestions(false);
  };

  const suggestions = addInput.length >= 1
    ? ALL_STOCKS.filter(
        (s) =>
          s.ticker.includes(addInput.toUpperCase()) &&
          !tickers.includes(s.ticker)
      ).slice(0, 5)
    : [];

  // Build display stocks: prefer live data, fall back to known mock data
  const displayStocks = tickers.map((t, i) => {
    const live = liveData?.[i]?.stock;
    if (live) return live;
    const found = ALL_STOCKS.find((s) => s.ticker === t);
    if (found) return found;
    return {
      ticker: t, name: 'Unknown', price: 0, ivRank: 0,
      ivPercentile: 0, currentIV: 0, historicalVol: 0, trend: 'flat' as const,
    };
  });

  // Build IV history map keyed by ticker (live first, mock fallback)
  const ivHistories: Record<string, IVDataPoint[]> = {};
  tickers.forEach((t, i) => {
    ivHistories[t] = liveData?.[i]?.ivHistory ?? MOCK_IV_HISTORY[t] ?? [];
  });

  // Apply sort
  const sortedStocks = [...displayStocks].sort((a, b) => {
    const aVal = a[sort.field === 'ticker' ? 'ticker' : sort.field] as string | number;
    const bVal = b[sort.field === 'ticker' ? 'ticker' : sort.field] as string | number;
    if (sort.direction === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  return (
    <div className="min-h-screen mesh-bg pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'none' : 'translateY(16px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px w-20" style={{ background: 'linear-gradient(90deg, rgba(0,229,196,0.3), transparent)' }} />
            <span className="text-xs font-medium tracking-widest uppercase"
              style={{ color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
              Watchlist
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold"
                style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe', letterSpacing: '-0.02em' }}>
                Tracked Symbols
              </h1>
              <p className="text-sm mt-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                {tickers.length} symbol{tickers.length !== 1 ? 's' : ''} tracked
              </p>
            </div>
          </div>
        </div>

        {/* Add Ticker + Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6"
          style={{
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.5s ease 0.15s',
          }}>
          {/* Add ticker */}
          <div className="flex-1 relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={addInput}
                  onChange={(e) => {
                    setAddInput(e.target.value.toUpperCase());
                    setAddError('');
                    setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                    if (e.key === 'Escape') setShowSuggestions(false);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Add ticker (e.g. TSLA)"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(13, 27, 53, 0.8)',
                    border: addError
                      ? '1px solid rgba(255,77,109,0.4)'
                      : '1px solid rgba(0, 229, 196, 0.15)',
                    color: '#e8f0fe',
                    fontFamily: 'JetBrains Mono, monospace',
                    caretColor: '#00e5c4',
                  }}
                />

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
                    style={{
                      background: 'rgba(5, 13, 26, 0.98)',
                      border: '1px solid rgba(0, 229, 196, 0.2)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    {suggestions.map((s) => (
                      <button
                        key={s.ticker}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(0,229,196,0.06)]"
                        onMouseDown={() => handleAdd(s.ticker)}
                      >
                        <span className="font-bold text-sm w-14"
                          style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                          {s.ticker}
                        </span>
                        <span className="text-xs flex-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                          {s.name}
                        </span>
                        <IVBadge value={s.ivRank} size="sm" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleAdd()}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
                  color: '#050d1a',
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 600,
                  boxShadow: '0 4px 16px rgba(0,229,196,0.2)',
                }}
              >
                + Add
              </button>
            </div>

            {addError && (
              <p className="text-xs mt-1.5 ml-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>
                {addError}
              </p>
            )}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs whitespace-nowrap" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              Sort by:
            </span>
            {SORT_OPTIONS.map(({ field, label }) => (
              <button
                key={field}
                onClick={() => updateSort(field)}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
                style={{
                  background: sort.field === field ? 'rgba(0,229,196,0.12)' : 'rgba(13,27,53,0.8)',
                  border: sort.field === field
                    ? '1px solid rgba(0,229,196,0.25)'
                    : '1px solid rgba(0,229,196,0.08)',
                  color: sort.field === field ? '#00e5c4' : '#6a8fb0',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {label}
                {sort.field === field && (
                  <span className="ml-1">{sort.direction === 'desc' ? '↓' : '↑'}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Watchlist Table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(13, 27, 53, 0.5)',
            border: '1px solid rgba(0, 229, 196, 0.1)',
            backdropFilter: 'blur(12px)',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.5s ease 0.25s',
          }}
        >
          {/* Table header */}
          <div className="px-4 sm:px-6 py-4"
            style={{ borderBottom: '1px solid rgba(0, 229, 196, 0.08)', background: 'rgba(0,0,0,0.15)' }}>
            {/* Mobile header: 3 cols */}
            <div className="grid sm:hidden grid-cols-[2fr_1fr_auto] gap-3 text-xs font-medium tracking-widest uppercase"
              style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.08em' }}>
              <span>Symbol</span>
              <span>IV Rank</span>
              <span className="text-right">Actions</span>
            </div>
            {/* Desktop header: full cols */}
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] gap-4 text-xs font-medium tracking-widest uppercase"
              style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.08em' }}>
              <span>Symbol</span>
              <span>Price</span>
              <span>IV Rank</span>
              <span>IV%ile</span>
              <span>52w Trend</span>
              <span className="text-right">Actions</span>
            </div>
          </div>

          {/* Table rows */}
          {sortedStocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,229,196,0.06)', border: '1px solid rgba(0,229,196,0.12)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#00e5c4" strokeWidth="1.5" strokeOpacity="0.4" />
                  <path d="M8 12h8M12 8v8" stroke="#00e5c4" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
                </svg>
              </div>
              <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                Your watchlist is empty
              </p>
              <p className="text-xs" style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif' }}>
                Add a ticker above to get started
              </p>
            </div>
          ) : (
            <div>
              {sortedStocks.map((stock, i) => (
                <WatchlistRow
                  key={stock.ticker}
                  stock={stock}
                  ivHistory={ivHistories[stock.ticker] ?? []}
                  isLast={i === sortedStocks.length - 1}
                  onView={() => navigate(`/stock/${stock.ticker}`)}
                  onRemove={() => removeTicker(stock.ticker)}
                  delay={i * 50}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick add suggestions */}
        {tickers.length < 6 && (
          <div className="mt-6"
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.4s' }}>
            <p className="text-xs mb-3" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
              Suggested symbols with high IV:
            </p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_STOCKS.filter((s) => !tickers.includes(s.ticker)).slice(0, 4).map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => addTicker(s.ticker)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 hover:border-[rgba(0,229,196,0.3)]"
                  style={{
                    background: 'rgba(13,27,53,0.6)',
                    border: '1px solid rgba(0,229,196,0.1)',
                    color: '#9ab4d4',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  <span className="font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
                    {s.ticker}
                  </span>
                  <IVBadge value={s.ivRank} size="sm" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ——————————————————————————————————
// Watchlist Row
// ——————————————————————————————————
interface WatchlistRowProps {
  stock: any;
  ivHistory: any[];
  isLast: boolean;
  onView: () => void;
  onRemove: () => void;
  delay: number;
}

function WatchlistRow({ stock, ivHistory, isLast, onView, onRemove, delay }: WatchlistRowProps) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay + 300);
    return () => clearTimeout(t);
  }, [delay]);

  // Flash price cell green/red when live price updates
  useEffect(() => {
    if (prevPrice.current !== null && prevPrice.current !== stock.price && stock.price > 0) {
      setPriceFlash(stock.price > prevPrice.current ? 'up' : 'down');
      const t = setTimeout(() => setPriceFlash(null), 800);
      return () => clearTimeout(t);
    }
    if (stock.price > 0) prevPrice.current = stock.price;
  }, [stock.price]);

  const isUp = stock.trend === 'up';
  const isDown = stock.trend === 'down';
  const flashColor = priceFlash === 'up' ? '#00d68f' : priceFlash === 'down' ? '#ff4d6d' : '#e8f0fe';

  return (
    <div
      className="items-center px-4 sm:px-6 py-3.5 group cursor-pointer
        grid grid-cols-[2fr_1fr_auto] gap-3
        sm:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_auto] sm:gap-4"
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(0, 229, 196, 0.06)',
        background: hovered ? 'rgba(0,229,196,0.03)' : 'transparent',
        transition: 'background 0.15s ease, opacity 0.4s ease',
        opacity: visible ? 1 : 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onView}
    >
      {/* Symbol — always visible */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{
            background: hovered ? 'rgba(0,229,196,0.12)' : 'rgba(0,229,196,0.06)',
            border: '1px solid rgba(0,229,196,0.12)',
            color: '#00e5c4',
            fontFamily: 'Syne, sans-serif',
            transition: 'background 0.15s ease',
          }}>
          {stock.ticker.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm"
              style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
              {stock.ticker}
            </span>
            <span className="text-xs" style={{ color: isUp ? '#00d68f' : isDown ? '#ff4d6d' : '#4a6a8a' }}>
              {isUp ? '↑' : isDown ? '↓' : '→'}
            </span>
          </div>
          {/* Price shown inline on mobile, hidden on desktop (has its own column) */}
          <p className="text-xs sm:hidden tabular-nums transition-colors duration-700"
            style={{ color: flashColor !== '#e8f0fe' ? flashColor : '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
            {stock.price > 0 ? `$${stock.price.toFixed(2)}` : stock.name}
          </p>
          <p className="text-xs hidden sm:block truncate" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            {stock.name}
          </p>
        </div>
      </div>

      {/* Price — desktop only */}
      <div className="hidden sm:block">
        <p className="text-sm font-medium tabular-nums transition-colors duration-700"
          style={{ color: flashColor, fontFamily: 'JetBrains Mono, monospace' }}>
          {stock.price > 0 ? `$${stock.price.toFixed(2)}` : '—'}
        </p>
        <p className="text-xs"
          style={{ color: isUp ? '#00d68f' : isDown ? '#ff4d6d' : '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
          {stock.price > 0
            ? stock.priceChangePct !== undefined
              ? `${stock.priceChangePct >= 0 ? '+' : ''}${stock.priceChangePct.toFixed(2)}%`
              : isUp ? '▲' : isDown ? '▼' : ''
            : ''}
        </p>
      </div>

      {/* IV Rank — always visible */}
      <div>
        {stock.ivRank > 0 ? <IVBadge value={stock.ivRank} size="sm" showBar /> : (
          <span className="text-xs" style={{ color: '#2e4a6a' }}>—</span>
        )}
      </div>

      {/* IV Percentile — desktop only */}
      <div className="hidden sm:block">
        <span className="text-sm font-medium tabular-nums"
          style={{ color: '#9ab4d4', fontFamily: 'JetBrains Mono, monospace' }}>
          {stock.ivPercentile > 0 ? stock.ivPercentile : '—'}
        </span>
      </div>

      {/* Sparkline — desktop only */}
      <div className="hidden sm:block h-10">
        {ivHistory.length > 0 ? (
          <IVSparkline data={ivHistory} height={40} />
        ) : (
          <div className="h-full flex items-center">
            <span className="text-xs" style={{ color: '#2e4a6a', fontFamily: 'DM Sans, sans-serif' }}>No data</span>
          </div>
        )}
      </div>

      {/* Actions — always visible */}
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onView}
          className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 opacity-0 group-hover:opacity-100 items-center"
          style={{
            background: 'rgba(0,229,196,0.08)',
            border: '1px solid rgba(0,229,196,0.15)',
            color: '#00e5c4',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          Details
        </button>
        <button
          onClick={onRemove}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-[rgba(255,77,109,0.1)]"
          style={{ color: '#4a6a8a' }}
          title="Remove from watchlist"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
