import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

type RPState = 'waiting' | 'form' | 'loading' | 'invalid';

export function ResetPassword() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [state, setState] = useState<RPState>('waiting');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Listen first, then check for an existing session — avoids the race where
    // PASSWORD_RECOVERY fires between getSession() and onAuthStateChange setup.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (timer) clearTimeout(timer);
        setState('form');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setState('form');
      } else {
        // Give Supabase up to 8 s to deliver the recovery token before
        // treating the link as expired.
        timer = setTimeout(() => setState('invalid'), 8000);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setState('loading');
    setError('');

    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(err.message);
      setState('form');
    } else {
      showToast('Password updated — you are now signed in.', 'success');
      navigate('/dashboard', { replace: true });
    }
  };

  const inputBase: React.CSSProperties = {
    background: 'rgba(5,13,26,0.8)',
    border: '1px solid rgba(0,229,196,0.15)',
    color: '#e8f0fe',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    caretColor: '#00e5c4',
    width: '100%',
  };

  // ── Waiting for Supabase to confirm the token ─────────────────────────────
  if (state === 'waiting') {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
        <div className="text-center">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin mx-auto"
            style={{ borderColor: 'rgba(0,229,196,0.2)', borderTopColor: '#00e5c4' }}
          />
          <p className="mt-4 text-sm" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
            Verifying reset link…
          </p>
        </div>
      </div>
    );
  }

  // ── Invalid / expired link ────────────────────────────────────────────────
  if (state === 'invalid') {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)' }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="11" stroke="#ff4d6d" strokeWidth="1.6" />
              <path d="M9 9l10 10M19 9L9 19" stroke="#ff4d6d" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}>
            Link expired
          </h2>
          <p className="text-sm mb-8" style={{ color: '#9ab4d4', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.7 }}>
            This password reset link has expired or already been used. Request a new one below.
          </p>
          <button
            onClick={() => navigate('/forgot-password')}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{
              background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
              color: '#050d1a',
              fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 4px 16px rgba(0,229,196,0.25)',
            }}
          >
            Request new reset link
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 rounded-xl text-sm font-medium mt-3 hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            style={{ color: '#6a8fb0', fontFamily: 'DM Sans, sans-serif', background: 'transparent' }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ── Password form ─────────────────────────────────────────────────────────
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,229,196,0.1)', border: '1px solid rgba(0,229,196,0.2)' }}
            >
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

        {/* Card */}
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

            {/* New password */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Min. 8 characters"
                required
                autoFocus
                autoComplete="new-password"
                className="px-4 py-3 rounded-xl text-sm transition-all duration-200"
                style={inputBase}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.35)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(0,229,196,0.15)')}
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); if (error === 'Passwords do not match') setError(''); }}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="px-4 py-3 rounded-xl text-sm transition-all duration-200"
                style={{
                  ...inputBase,
                  borderColor: mismatch ? 'rgba(255,77,109,0.4)' : 'rgba(0,229,196,0.15)',
                }}
                onFocus={(e) => (e.target.style.borderColor = mismatch ? 'rgba(255,77,109,0.4)' : 'rgba(0,229,196,0.35)')}
                onBlur={(e) => (e.target.style.borderColor = mismatch ? 'rgba(255,77,109,0.4)' : 'rgba(0,229,196,0.15)')}
              />
              {mismatch && (
                <p className="text-xs mt-1" style={{ color: '#ff4d6d', fontFamily: 'DM Sans, sans-serif' }}>
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Strength hint */}
            {password.length > 0 && (
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((level) => {
                  const strength = Math.min(
                    4,
                    [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)]
                      .filter(Boolean).length
                  );
                  return (
                    <div
                      key={level}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        background: level <= strength
                          ? strength <= 1 ? '#ff4d6d' : strength <= 2 ? '#f5c842' : '#00d68f'
                          : 'rgba(255,255,255,0.06)',
                      }}
                    />
                  );
                })}
                <span className="text-xs ml-1" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif', minWidth: 40 }}>
                  {(() => {
                    const s = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
                    return s <= 1 ? 'Weak' : s <= 2 ? 'Fair' : s <= 3 ? 'Good' : 'Strong';
                  })()}
                </span>
              </div>
            )}

            {/* API error */}
            {error && error !== 'Passwords do not match' && (
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
              disabled={state === 'loading' || mismatch}
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
                  Updating…
                </span>
              ) : (
                'Update password'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}>
          Remembered it?{' '}
          <button
            onClick={() => navigate('/login')}
            className="transition-colors hover:text-[#00e5c4]"
            style={{ color: '#9ab4d4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 'inherit' }}
          >
            Back to sign in
          </button>
        </p>

      </div>
    </div>
  );
}
