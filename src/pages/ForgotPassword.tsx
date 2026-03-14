import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type FPState = 'idle' | 'loading' | 'sent';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FPState>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setError('');

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (err) {
      setError(err.message);
      setState('idle');
    } else {
      setState('sent');
    }
  };

  const inputBase = {
    background: 'rgba(5,13,26,0.8)',
    border: '1px solid rgba(0,229,196,0.15)',
    color: '#e8f0fe',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    caretColor: '#00e5c4',
  };

  if (state === 'sent') {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(0,229,196,0.1)', border: '1px solid rgba(0,229,196,0.2)' }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="7" width="22" height="16" rx="2" stroke="#00e5c4" strokeWidth="1.6" />
              <path d="M3 10l11 7 11-7" stroke="#00e5c4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            Check your email
          </h2>
          <p className="text-sm mb-2" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif' }}>
            We sent a password reset link to
          </p>
          <p className="text-sm font-semibold mb-6" style={{ color: '#00e5c4', fontFamily: 'JetBrains Mono, monospace' }}>
            {email}
          </p>
          <p className="text-xs mb-8" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Click the link in that email to reset your password. Check your spam folder if you don't see it.
          </p>
          <Link
            to="/login"
            className="block w-full py-3 rounded-xl text-sm font-semibold text-center"
            style={{
              background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
              color: '#050d1a',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,229,196,0.1)', border: '1px solid rgba(0,229,196,0.2)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="8.5" stroke="#00e5c4" strokeWidth="1.6" />
                <circle cx="11" cy="11" r="2.5" fill="#00e5c4" />
                <line x1="11" y1="2.5" x2="11" y2="8.5" stroke="#00e5c4" strokeWidth="1.6" />
                <line x1="11" y1="13.5" x2="11" y2="19.5" stroke="#00e5c4" strokeWidth="1.6" />
                <line x1="2.5" y1="11" x2="8.5" y2="11" stroke="#00e5c4" strokeWidth="1.6" />
                <line x1="13.5" y1="11" x2="19.5" y2="11" stroke="#00e5c4" strokeWidth="1.6" />
              </svg>
            </div>
            <span className="text-xl font-bold" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
              Premium<span style={{ color: '#00e5c4' }}>Hunter</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            Reset password
          </h1>
          <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Enter your email to receive a reset link
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(13,27,53,0.7)',
            border: '1px solid rgba(0,229,196,0.12)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200"
                style={inputBase}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.35)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.15)')}
              />
            </div>

            {error && (
              <div
                className="px-3 py-2.5 rounded-lg text-xs"
                style={{
                  background: 'rgba(255,77,109,0.1)',
                  border: '1px solid rgba(255,77,109,0.2)',
                  color: '#ff4d6d',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={state === 'loading'}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
                color: '#050d1a',
                fontFamily: 'DM Sans, sans-serif',
                boxShadow: state === 'loading' ? 'none' : '0 4px 16px rgba(0,229,196,0.25)',
              }}
            >
              {state === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(5,13,26,0.3)', borderTopColor: '#050d1a' }}
                  />
                  Sending...
                </span>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Remember your password?{' '}
          <Link to="/login" className="transition-colors hover:text-[#00e5c4]" style={{ color: '#9ab4d4' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
