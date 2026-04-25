import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { measurePageLoad } from './lib/performanceMonitor';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}

measurePageLoad();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
