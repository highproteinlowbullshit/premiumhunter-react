import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

type RPState = 'waiting' | 'form' | 'loading';

export function ResetPassword() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [state, setState] = useState<RPState>('waiting');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setTimeout>;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(fallbackTimer);
        setState('form');
      }
    });

    fallbackTimer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setState('loading');
    setError('');

    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(err.message);
      setState('form');
    } else {
      showToast('Password updated successfully', 'success');
      navigate('/dashboard', { replace: true });
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

  if (state === 'waiting') {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin mx-auto"
            style={{ borderColor: 'rgba(0,229,196,0.2)', borderTopColor: '#00e5c4' }}
          />
          <p className="mt-4 text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Verifying reset link...
          </p>
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
            Set new password
          </h1>
          <p className="text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Choose a strong password for your account
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
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200"
                style={inputBase}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.35)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.15)')}
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error === 'Passwords do not match') setError('');
                }}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200"
                style={{
                  ...inputBase,
                  borderColor:
                    confirmPassword && password !== confirmPassword
                      ? 'rgba(255,77,109,0.4)'
                      : 'rgba(0,229,196,0.15)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.35)')}
                onBlur={(e) =>
                  (e.target.style.borderColor =
                    confirmPassword && password !== confirmPassword
                      ? 'rgba(255,77,109,0.4)'
                      : 'rgba(0,229,196,0.15)')
                }
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
                  Updating...
                </span>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
