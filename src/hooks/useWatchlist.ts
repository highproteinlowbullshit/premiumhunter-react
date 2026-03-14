import { useWatchlistContext } from '../context/WatchlistContext';
import { useWatchlistStocks } from './useWatchlistStocks';

// Thin wrapper — keeps the same public API as before
export function useWatchlist() {
  const { tickers, sort, addTicker, removeTicker, updateSort, isWatched } = useWatchlistContext();
  const stocks = useWatchlistStocks(tickers, sort);
  return { tickers, stocks, sort, addTicker, removeTicker, updateSort, isWatched };
}
