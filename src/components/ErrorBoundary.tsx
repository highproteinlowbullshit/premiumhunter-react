import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export function ErrorFallback({ onReset }: { onReset?: () => void }) {
  return (
    <div
      className="min-h-screen mesh-bg flex items-center justify-center px-4"
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: 'rgba(13,27,53,0.8)',
          border: '1px solid rgba(0,229,196,0.15)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.2)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4M12 17h.01" stroke="#ff4d6d" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke="#ff4d6d" strokeWidth="1.6" />
          </svg>
        </div>
        <h2
          className="text-xl font-bold mb-2"
          style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}
        >
          Something went wrong
        </h2>
        <p
          className="text-sm mb-8"
          style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
        >
          An unexpected error occurred. Reload the page to try again.
        </p>
        <button
          onClick={onReset ?? (() => window.location.reload())}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
            color: '#050d1a',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  // Explicit field declaration required — constructor parameter properties
  // are disallowed by erasableSyntaxOnly in tsconfig.app.json
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          onReset={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}
