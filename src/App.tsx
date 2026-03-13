import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Watchlist } from './pages/Watchlist';
import { StockDetail } from './pages/StockDetail';
import { WheelTracker } from './pages/WheelTracker';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import type { ThemeMode } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Inner component so we can use router hooks
function AppInner() {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  return (
    <div className={theme === 'light' ? 'light' : ''} style={{ minHeight: '100vh' }}>
      <Navbar theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/stock/:ticker" element={<StockDetail />} />
        <Route path="/wheel" element={<WheelTracker />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </div>
  );
}

export default App;
