# Production-Ready Vercel Deployment — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get PremiumHunter deployed to Vercel with SPA routing, error boundaries, complete auth flow, and Sentry monitoring.

**Architecture:** Deploy-first approach — add `vercel.json` for SPA routing, then layer in error boundaries, missing auth pages (forgot/reset password, 404), and Sentry. No tests exist in this project; verification is via `npm run build` + manual smoke test.

**Tech Stack:** React 19, TypeScript (strict + erasableSyntaxOnly), Vite 8, Supabase JS v2, React Router DOM v7, `@sentry/react@8`, Tailwind CSS v4

---

## Chunk 1: Vercel Deployment Config

**Files:**
- Create: `vercel.json`
- Modify: `.env.example`

---

### Task 1: Add `vercel.json` for SPA routing

Without this file, Vercel's CDN returns a real 404 for any route other than `/` — the rewrite forwards all paths to `index.html` so React Router handles routing client-side.

- [ ] **Step 1: Create `vercel.json` at the project root**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

File path: `/Users/brandonyeo/Documents/Repository/premiumhunter/vercel.json`

- [ ] **Step 2: Verify the file is valid JSON**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid')"
```

Expected output: `valid`

- [ ] **Step 3: Commit**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter
git add vercel.json
git commit -m "feat: add vercel.json SPA rewrite for client-side routing"
```

---

### Task 2: Update `.env.example` with missing keys

The existing `.env.example` only has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Three more are needed so contributors and Vercel dashboard know what to configure.

- [ ] **Step 1: Append the three missing env var entries to `.env.example`**

Open `.env.example` (currently at project root) and add these lines at the end:

```
VITE_FINNHUB_API_KEY=your-finnhub-api-key
VITE_POLYGON_API_KEY=your-polygon-api-key
VITE_SENTRY_DSN=your-sentry-dsn
```

The file should now contain all 5 variables total.

- [ ] **Step 2: Verify the file looks correct**

```bash
cat /Users/brandonyeo/Documents/Repository/premiumhunter/.env.example
```

Expected output (all 5 lines):
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_FINNHUB_API_KEY=your-finnhub-api-key
VITE_POLYGON_API_KEY=your-polygon-api-key
VITE_SENTRY_DSN=your-sentry-dsn
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add missing env vars to .env.example"
```

---

### Task 3: Manual — Rotate Supabase anon key and configure Auth URLs

These steps require browser access to the Supabase dashboard and cannot be automated.

- [ ] **Step 1: Rotate the Supabase anon key**
  1. Go to Supabase dashboard → Project Settings → API
  2. Click "Reveal" next to the anon key, then click "Roll" (or "Rotate")
  3. Copy the new anon key
  4. Update `VITE_SUPABASE_ANON_KEY` in your local `.env` file with the new key
  5. **Do not commit `.env`** — `.gitignore` already covers it

- [ ] **Step 2: Configure Supabase Auth redirect URLs**

  In the Supabase dashboard → Authentication → URL Configuration:
  - **Site URL**: `https://premiumhunter.vercel.app` (update with your actual Vercel domain once known)
  - **Redirect URLs**: Add both:
    - `https://premiumhunter.vercel.app/**`
    - `http://localhost:5173/**`

  Without this, the password reset email links back to the wrong origin.

- [ ] **Step 3: Verify build still passes after key rotation**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: build succeeds, no TypeScript errors.

---

## Chunk 2: Error Boundary

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/App.tsx`

---

### Task 4: Create `ErrorBoundary` component

React error boundaries must be class components. This project uses `erasableSyntaxOnly: true` in `tsconfig.app.json`, which disallows constructor parameter properties — use explicit class field declaration for `state` instead.

`ErrorFallback` is extracted as a named export so Sentry's boundary (added in Chunk 4) can reuse it without importing the class.

- [ ] **Step 1: Create `src/components/ErrorBoundary.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: build passes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ErrorBoundary.tsx
git commit -m "feat: add ErrorBoundary and ErrorFallback components"
```

---

### Task 5: Wire `ErrorBoundary` into `App.tsx`

Wrap only `<Routes>` (not the entire app) so Navbar and ToastContainer remain visible when a page component crashes.

- [ ] **Step 1: Add `ErrorBoundary` import to `src/App.tsx`**

Add to the existing imports block:
```tsx
import { ErrorBoundary } from './components/ErrorBoundary';
```

- [ ] **Step 2: Wrap `<Routes>` with `<ErrorBoundary>` inside `AppInner()` in `src/App.tsx`**

The wrapping happens inside the `AppInner` function (not `App()`). `<Navbar>`, `<ToastContainer>`, and `<DemoBanner>` must remain **outside** the boundary so they stay visible when a page crashes.

Change the `AppInner` return from:
```tsx
    <div className={theme === 'light' ? 'light' : ''} style={{ minHeight: '100vh' }}>
      <Navbar theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <ToastContainer />
      <Routes>
        ...
      </Routes>
      <DemoBanner />
    </div>
```

To:
```tsx
    <div className={theme === 'light' ? 'light' : ''} style={{ minHeight: '100vh' }}>
      <Navbar theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
      <ToastContainer />
      <ErrorBoundary>
        <Routes>
          ...
        </Routes>
      </ErrorBoundary>
      <DemoBanner />
    </div>
```

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wrap Routes with ErrorBoundary in App"
```

---

## Chunk 3: Missing Pages

**Files:**
- Create: `src/pages/ForgotPassword.tsx`
- Create: `src/pages/ResetPassword.tsx`
- Create: `src/pages/NotFound.tsx`
- Modify: `src/App.tsx`

---

### Task 6: Create `ForgotPassword` page

Matches the visual aesthetic of `Login.tsx` exactly (same dark card, same inputs, same logo). Two states: `'idle'` (form) and `'sent'` (confirmation screen matching Signup's confirm_email state).

- [ ] **Step 1: Create `src/pages/ForgotPassword.tsx`**

```tsx
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

  // ── Sent state ──
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

  // ── Form state ──
  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ForgotPassword.tsx
git commit -m "feat: add ForgotPassword page with Supabase reset email"
```

---

### Task 7: Create `ResetPassword` page

Handles the `PASSWORD_RECOVERY` auth event from Supabase. Must clean up both the `onAuthStateChange` subscription AND the timeout in the `useEffect` cleanup.

- [ ] **Step 1: Create `src/pages/ResetPassword.tsx`**

```tsx
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
    // Supabase v2 fires PASSWORD_RECOVERY (not SIGNED_IN) when a reset link is clicked.
    // If this event doesn't fire within 3s, the user arrived without a valid token → redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(fallbackTimer);
        setState('form');
      }
    });

    const fallbackTimer = setTimeout(() => {
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

  // ── Waiting for recovery token ──
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

  // ── New password form ──
  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ResetPassword.tsx
git commit -m "feat: add ResetPassword page with PASSWORD_RECOVERY event handling"
```

---

### Task 8: Create `NotFound` page

- [ ] **Step 1: Create `src/pages/NotFound.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="text-center">
        <p
          className="text-8xl font-bold mb-4"
          style={{ fontFamily: 'Syne, sans-serif', color: '#00e5c4' }}
        >
          404
        </p>
        <h1
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'Syne, sans-serif', color: '#e8f0fe' }}
        >
          Page not found
        </h1>
        <p
          className="text-sm mb-8"
          style={{ color: '#4a6a8a', fontFamily: 'DM Sans, sans-serif' }}
        >
          This page doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #00e5c4, #00b4d8)',
            color: '#050d1a',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/NotFound.tsx
git commit -m "feat: add NotFound 404 page"
```

---

### Task 9: Add new routes to `App.tsx`

- [ ] **Step 1: Add imports for the three new pages in `src/App.tsx`**

Add to the existing imports block:
```tsx
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { NotFound } from './pages/NotFound';
```

- [ ] **Step 2: Add routes inside `AppInner`'s `<Routes>` block**

Add the two new public routes after `/signup`:
```tsx
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

Add the catch-all as the **last** route inside `<Routes>`:
```tsx
<Route path="*" element={<NotFound />} />
```

The final `<Routes>` block should look like:
```tsx
<Routes>
  {/* Public */}
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<Signup />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />

  {/* Protected */}
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
  <Route path="/stock/:ticker" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
  <Route path="/wheel" element={<ProtectedRoute><WheelTracker /></ProtectedRoute>} />
  <Route path="/screener" element={<ProtectedRoute><Screener /></ProtectedRoute>} />

  {/* Catch-all */}
  <Route path="*" element={<NotFound />} />
</Routes>
```

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add forgot-password, reset-password, and 404 routes"
```

---

## Chunk 4: Sentry Integration

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/usePositions.ts`
- Modify: `src/context/WatchlistContext.tsx`

---

### Task 10: Install Sentry

- [ ] **Step 1: Install `@sentry/react` pinned to major version 8**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm install @sentry/react@8
```

Expected: package installs with no peer dep errors.

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: no errors. Bundle size will increase slightly (~50–80kb gzipped from Sentry).

---

### Task 11: Initialize Sentry in `main.tsx`

Sentry must be initialized before `ReactDOM.createRoot` so it can capture errors during React setup. The DSN is read from `VITE_SENTRY_DSN` — if absent, `Sentry.init` is not called and the SDK is a complete no-op.

- [ ] **Step 1: Update `src/main.tsx`**

Replace the entire file content with:

```tsx
import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'production' | 'development'
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: initialize Sentry in main.tsx with optional DSN"
```

---

### Task 12: Replace `ErrorBoundary` with `Sentry.ErrorBoundary` in `App.tsx`

`Sentry.ErrorBoundary` does the same job as the custom class but also ships errors to Sentry. `ErrorFallback` (exported from `ErrorBoundary.tsx`) is reused as the fallback UI. The custom `ErrorBoundary` class file is kept — it's still used by `ErrorFallback` in local dev.

- [ ] **Step 1: Update imports in `src/App.tsx`**

Replace:
```tsx
import { ErrorBoundary } from './components/ErrorBoundary';
```

With:
```tsx
import * as Sentry from '@sentry/react';
import { ErrorFallback } from './components/ErrorBoundary';
```

- [ ] **Step 2: Replace `<ErrorBoundary>` with `<Sentry.ErrorBoundary>` in `AppInner`**

Replace:
```tsx
      <ErrorBoundary>
        <Routes>
```

With:
```tsx
      <Sentry.ErrorBoundary fallback={(props) => <ErrorFallback onReset={props.resetError} />}>
        <Routes>
```

And replace the closing tag:
```tsx
        </Routes>
      </ErrorBoundary>
```

With:
```tsx
        </Routes>
      </Sentry.ErrorBoundary>
```

Using a render function for `fallback` passes `props.resetError` to `ErrorFallback`, allowing the boundary to reset its state in-place rather than doing a full page reload. The `onReset` prop on `ErrorFallback` already handles this — it only falls back to `window.location.reload()` when `onReset` is undefined.

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace ErrorBoundary with Sentry.ErrorBoundary in App"
```

---

### Task 13: Add `Sentry.captureException` to data hooks

These Supabase error handlers currently show a toast but are otherwise silent. Adding `captureException` gives production visibility. Call it unconditionally — the SDK no-ops when not initialized, no guard needed.

- [ ] **Step 1: Add Sentry import to `src/hooks/usePositions.ts`**

Add at the top of the file:
```tsx
import * as Sentry from '@sentry/react';
```

- [ ] **Step 2: Add `Sentry.captureException` to the three error handlers in `usePositions.ts`**

In `addPosition` — find:
```ts
      if (error) {
        setPositions((prev) => prev.filter((p) => p.id !== tempId));
        showToast('Failed to save position', 'error');
```
Add `Sentry.captureException(error);` before `showToast`:
```ts
      if (error) {
        Sentry.captureException(error);
        setPositions((prev) => prev.filter((p) => p.id !== tempId));
        showToast('Failed to save position', 'error');
```

In `removePosition` — find:
```ts
      if (error) {
        showToast('Failed to remove position — refresh to sync', 'error');
```
Add before `showToast`:
```ts
      if (error) {
        Sentry.captureException(error);
        showToast('Failed to remove position — refresh to sync', 'error');
```

In `closePosition` — find:
```ts
      if (error) {
        showToast('Failed to close position', 'error');
```
Add before `showToast`:
```ts
      if (error) {
        Sentry.captureException(error);
        showToast('Failed to close position', 'error');
```

- [ ] **Step 3: Add Sentry import to `src/context/WatchlistContext.tsx`**

Add at the top:
```tsx
import * as Sentry from '@sentry/react';
```

- [ ] **Step 4: Add `Sentry.captureException` to the two error handlers in `WatchlistContext.tsx`**

In `addTicker` — find:
```ts
        if (error) {
          // Revert on failure
          setTickers((prev) => prev.filter((t) => t !== upper));
          showToast(`Failed to add ${upper}`, 'error');
```
Add before the revert:
```ts
        if (error) {
          Sentry.captureException(error);
          // Revert on failure
          setTickers((prev) => prev.filter((t) => t !== upper));
          showToast(`Failed to add ${upper}`, 'error');
```

In `removeTicker` — find:
```ts
        if (error) {
          // Revert on failure
          setTickers((prev) =>
            prev.includes(ticker) ? prev : [...prev, ticker]
          );
          showToast(`Failed to remove ${ticker}`, 'error');
```
Add before the revert:
```ts
        if (error) {
          Sentry.captureException(error);
          // Revert on failure
          setTickers((prev) =>
            prev.includes(ticker) ? prev : [...prev, ticker]
          );
          showToast(`Failed to remove ${ticker}`, 'error');
```

- [ ] **Step 5: Verify build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePositions.ts src/context/WatchlistContext.tsx
git commit -m "feat: add Sentry.captureException to Supabase error handlers"
```

---

## Chunk 5: Deploy to Vercel

---

### Task 14: Push to GitHub and deploy on Vercel

- [ ] **Step 1: Ensure all changes are committed and build passes**

```bash
cd /Users/brandonyeo/Documents/Repository/premiumhunter && git status
```

Expected: `nothing to commit, working tree clean`

Run a final pre-push build verification:

```bash
npm run build
```

Expected: build succeeds. Do not push until this passes — Vercel runs the same command.

- [ ] **Step 2: Check remote configuration and push to GitHub**

```bash
git remote -v
```

If a remote named `origin` exists → push normally:
```bash
git push origin main
```

If no remote exists (new repo) → create and push via `gh` CLI:
```bash
gh repo create premiumhunter --private --source=. --push
```
(Alternatively, create the repo on github.com and follow the "push existing repo" instructions.)

- [ ] **Step 3: Connect repo to Vercel and deploy**

  1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
  2. Select the `premiumhunter` repo
  3. Framework: **Vite** (auto-detected)
  4. Build command: confirm it shows `npm run build` — if Vercel auto-populated `vite build`, override it to `npm run build` (the `tsc -b` type check must run)
  5. Output directory: `dist` (default)
  6. Add all **5 environment variables** under "Environment Variables":
     - `VITE_SUPABASE_URL` → your Supabase project URL
     - `VITE_SUPABASE_ANON_KEY` → the newly rotated anon key
     - `VITE_FINNHUB_API_KEY` → your Finnhub key
     - `VITE_POLYGON_API_KEY` → your Polygon key
     - `VITE_SENTRY_DSN` → your Sentry DSN (create a free Sentry project at sentry.io if needed; leave blank to skip Sentry for now)
  7. Click **Deploy**

- [ ] **Step 4: Update Supabase Site URL to the actual Vercel domain**

Once Vercel assigns a domain (e.g. `https://premiumhunter-abc123.vercel.app`):
  1. Go to Supabase → Authentication → URL Configuration
  2. Update **Site URL** to the actual Vercel domain
  3. Update **Redirect URLs** allowlist with the actual domain

---

### Task 15: Smoke test the live deployment

Verify all critical paths work on the live URL.

- [ ] **CDN rewrite** — navigate directly to each URL (test that Vercel is not returning CDN-level 404s):
  - `https://your-domain.vercel.app/dashboard` → should load app (not a Vercel 404)
  - `https://your-domain.vercel.app/watchlist` → should load
  - `https://your-domain.vercel.app/wheel` → should load
  - `https://your-domain.vercel.app/screener` → should load
  - `https://your-domain.vercel.app/nonexistent` → should show the custom 404 page (not a Vercel 404)

- [ ] **Env vars** — after logging in:
  - Verify the **DemoBanner is not visible** at the bottom of the screen. If it appears, the `VITE_FINNHUB_API_KEY` or `VITE_POLYGON_API_KEY` were not saved correctly in Vercel → check Vercel → Project Settings → Environment Variables.

- [ ] **Auth flow**:
  - `/signup` → create a test account → verify email if required → land on dashboard
  - `/login` → sign in with existing account → land on dashboard
  - `/forgot-password` → enter email → verify "Check your email" confirmation screen appears
  - Click logout → redirect to `/login`

- [ ] **Full password reset round-trip** (requires Supabase Site URL updated in Task 14 Step 4):
  - Go to `/forgot-password`, enter the test account email, click "Send Reset Link"
  - Open the reset email → click the link → verify it lands on `/reset-password` (not a redirect to `/login` or a 404)
  - Enter a new password and submit → verify redirect to `/dashboard`

- [ ] **Protected route guard**:
  - While logged out, navigate directly to `/dashboard` → should redirect to `/login`

- [ ] **Error boundary** (optional manual test):
  - Temporarily add `throw new Error('test')` at the top of `Dashboard.tsx`'s render return, push and deploy, verify the `ErrorFallback` UI appears instead of a blank screen, then revert and redeploy

- [ ] **Sentry** (if DSN configured):
  - Check the Sentry dashboard → Issues or Performance for any captured events

---

## File Map Summary

| File | Action | Purpose |
|------|--------|---------|
| `vercel.json` | Create | SPA routing — rewrites all paths to `index.html` |
| `.env.example` | Modify | Add 3 missing env var entries |
| `src/components/ErrorBoundary.tsx` | Create | `ErrorBoundary` class + `ErrorFallback` named export |
| `src/pages/ForgotPassword.tsx` | Create | Email form → Supabase reset email |
| `src/pages/ResetPassword.tsx` | Create | PASSWORD_RECOVERY handler → new password form |
| `src/pages/NotFound.tsx` | Create | 404 catch-all page |
| `src/App.tsx` | Modify (×2) | Add ErrorBoundary (Task 5), then Sentry boundary + 3 new routes (Tasks 9, 12) |
| `src/main.tsx` | Modify | Sentry init before ReactDOM.createRoot |
| `src/hooks/usePositions.ts` | Modify | Add `Sentry.captureException` to 3 error handlers |
| `src/context/WatchlistContext.tsx` | Modify | Add `Sentry.captureException` to 2 error handlers |
