# Production-Ready Vercel Deployment — Design Spec
**Date:** 2026-03-14
**Project:** PremiumHunter
**Approach:** Deploy-first (Option 2) — get live on Vercel fast, layer in hardening features

---

## Overview

Get PremiumHunter from a local dev state to a publicly deployed, production-hardened application on Vercel. Scope is "Solid Launch" (Option B): critical deployment config, error boundaries, missing auth pages, and basic error monitoring via Sentry.

---

## Section 1 — Vercel Deployment Config

### Goal
Get the app live on Vercel with proper SPA routing and secrets managed outside of the repository.

### `vercel.json` (new file at project root)
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Required because Vercel's CDN serves static files — without this rewrite, navigating directly to `/dashboard` or refreshing any non-root route returns a 404 from the CDN instead of loading the React app.

### Environment variables
Add the following to Vercel Project Settings → Environment Variables (for all environments: Production, Preview, Development):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FINNHUB_API_KEY`
- `VITE_POLYGON_API_KEY`
- `VITE_SENTRY_DSN` (added in Section 4)

### `.env.example` (update existing)
The existing `.env.example` already contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Add the following **three missing entries**:
```
VITE_FINNHUB_API_KEY=your-finnhub-key
VITE_POLYGON_API_KEY=your-polygon-key
VITE_SENTRY_DSN=your-sentry-dsn
```

### `.gitignore`
Verify `.env` is listed (it already is — no change needed).

### Key rotation
Rotate the Supabase anon key in the Supabase dashboard (Project Settings → API → Roll). The anon key is semi-public by design (RLS policies are the security layer), but rotation is good hygiene given it was committed to git.

### Supabase Auth configuration (required for password reset in Section 3)
In the Supabase dashboard → Authentication → URL Configuration:
- **Site URL**: Set to the production Vercel domain (e.g. `https://premiumhunter.vercel.app`)
- **Redirect URLs allowlist**: Add:
  - `https://premiumhunter.vercel.app/**`
  - `http://localhost:5173/**` (for local dev)

Without this, Supabase's password reset email will link back to the wrong origin.

### Deployment steps
1. Push code to GitHub
2. Connect repo to Vercel (Import Project)
3. Add all env vars in Vercel dashboard
4. Configure Supabase Auth URL settings (above)
5. Deploy — Vercel auto-detects Vite and runs `npm run build`

---

## Section 2 — Error Boundaries

### Goal
Prevent render-time JavaScript errors from crashing the entire app and leaving users with a blank white screen.

### New file: `src/components/ErrorBoundary.tsx`

A React class component (required — error boundaries cannot be function components).

**Important:** `tsconfig.app.json` has `"erasableSyntaxOnly": true` which disallows constructor parameter properties. Use explicit class field declarations instead:

```tsx
import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  // Explicit field declaration — not constructor parameter property
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={() => this.setState({ hasError: false, error: null })} />;
    }
    return this.props.children;
  }
}
```

Extract the fallback UI into a separate function component `ErrorFallback` in the same file so it can be reused by Sentry's boundary in Section 4:

```tsx
function ErrorFallback({ onReset }: { onReset?: () => void }) {
  return (
    // Dark navy card, "Something went wrong" heading, error details in monospace,
    // "Reload page" button calling window.location.reload() (or onReset if provided)
    // Match existing auth page aesthetic: #050d1a background, #00e5c4 accent, Syne/DM Sans fonts
  );
}

export { ErrorFallback };
```

### Integration in `src/App.tsx`

Wrap the `<Routes>` block only (not the entire app) so Navbar and ToastContainer remain visible during a page crash:

```tsx
<Navbar ... />
<ToastContainer />
<ErrorBoundary>
  <Routes>...</Routes>
</ErrorBoundary>
<DemoBanner />
```

**Note:** `WatchlistProvider` and `ToastProvider` sit above this boundary. Their render-time errors (rare for effect-only code) would not be caught. This is an acceptable tradeoff for a launch spec — the boundary covers all page components where errors are most likely.

### Lifecycle after Sentry integration (Section 4)
In Section 4, `ErrorBoundary` is replaced by `Sentry.ErrorBoundary` in `App.tsx`, but the `ErrorBoundary` class component file is kept as a fallback for local dev (when `VITE_SENTRY_DSN` is absent, Sentry's boundary still renders its fallback prop — so `ErrorFallback` is always used regardless).

---

## Section 3 — Missing Pages

### Goal
Fix broken navigation links and ensure all URL paths resolve to a meaningful page.

### New file: `src/pages/ForgotPassword.tsx`

Email input form → triggers Supabase password reset email → shows confirmation screen.

**Two states:**
- `'idle'` — Email input form (matches Login.tsx aesthetic: same dark card, same input styles, same brand logo)
- `'sent'` — Confirmation screen (matches Signup.tsx `confirm_email` state: envelope icon, "Check your email" heading, email address in teal monospace, instructions, "Back to Sign In" button)

**On submit:**
```ts
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
});
```
This sends an email with a link back to the app's `/reset-password` route, which handles the actual password update.

**Route:** Public route (no `ProtectedRoute` wrapper):
```tsx
<Route path="/forgot-password" element={<ForgotPassword />} />
```

### New file: `src/pages/ResetPassword.tsx`

Handles the recovery token that Supabase appends to the URL after the user clicks the email link.

**Flow:**
1. On mount, set up `supabase.auth.onAuthStateChange` listener watching for the **`PASSWORD_RECOVERY`** event (Supabase v2 fires this dedicated event — not `SIGNED_IN` — when a reset link is clicked)
2. Also set a 3-second `setTimeout` fallback: if `PASSWORD_RECOVERY` has not fired, redirect to `/login` (guards against users landing on this route without a valid token)
3. The `useEffect` cleanup function must cancel **both** the timeout (`clearTimeout`) and the Supabase subscription (`subscription.unsubscribe()`) to prevent state updates on unmounted components
4. When `PASSWORD_RECOVERY` fires: cancel the timeout and show a "New Password" form (password + confirm password inputs)
5. On submit, call `supabase.auth.updateUser({ password: newPassword })`
6. On success, navigate to `/dashboard` with a success toast

**Note on AuthContext side-effect:** After `updateUser` succeeds, Supabase emits a `SIGNED_IN` event which `AuthContext` handles by calling `initPreferences`/`loadPreferences`. This is harmless (`ignoreDuplicates: true` on the upsert) and is accepted behavior — no guard needed.

**Note on 404 UX loop:** A logged-out user hitting a 404 route and clicking "Go to Home" (`/`) is redirected through `ProtectedRoute` to `/login`. After login they are redirected back to their original (404) URL, hitting `NotFound` again. This is an accepted edge case for a launch spec.

**Sentry tracing:** Per-route performance tracing is out of scope for this phase. The `browserTracingIntegration()` without React Router instrumentation will produce page-level (not route-level) traces only — this is accepted.

**`App.tsx` is edited twice:** Step 2 adds `<ErrorBoundary>` wrapping `<Routes>`. Step 4 replaces it with `<Sentry.ErrorBoundary fallback={<ErrorFallback />}>`. This is intentional — step 2 establishes `ErrorFallback` as a named export that step 4 reuses.

**Route:** Public route:
```tsx
<Route path="/reset-password" element={<ResetPassword />} />
```

### New file: `src/pages/NotFound.tsx`

- Centered layout on dark background (same `mesh-bg` class as auth pages)
- Large "404" in accent teal (`#00e5c4`) using Syne font
- "Page not found" heading, short description: "This page doesn't exist or has been moved."
- Single CTA button: **"Go to Home"** → `navigate('/')` (which `ProtectedRoute` will redirect to `/dashboard` for authed users, or `/login` for guests — handles both cases cleanly)

**Route:** Catch-all, last route in `App.tsx`:
```tsx
<Route path="*" element={<NotFound />} />
```

---

## Section 4 — Sentry Error Monitoring

### Goal
Automatically capture and report unhandled errors in production without requiring local dev setup.

### Dependencies
```
npm install @sentry/react@8
```
Pin to major version 8. v9 (released late 2025) has a different module structure. v8 is stable, well-documented, and uses the `Sentry.init({ integrations: [...] })` pattern with function-based integrations.

### New env var
`VITE_SENTRY_DSN` — the Sentry project DSN from the Sentry dashboard (Project Settings → Client Keys). If absent or empty, `Sentry.init()` is not called and the SDK is a no-op.

### Initialization in `src/main.tsx`

```tsx
import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'production' | 'development'
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  });
}
```

Place this **before** `ReactDOM.createRoot(...)` so Sentry captures any errors during React initialization.

### Replace `ErrorBoundary` in `src/App.tsx`

```tsx
import * as Sentry from '@sentry/react';
import { ErrorFallback } from './components/ErrorBoundary';

// Replace:
<ErrorBoundary>
  <Routes>...</Routes>
</ErrorBoundary>

// With:
<Sentry.ErrorBoundary fallback={<ErrorFallback />}>
  <Routes>...</Routes>
</Sentry.ErrorBoundary>
```

`Sentry.ErrorBoundary` works identically to the custom class but also ships the error to the Sentry dashboard. When `VITE_SENTRY_DSN` is absent (Sentry not initialized), the boundary still renders its `fallback` prop correctly — no special-casing needed.

### Manual capture in data hooks

Add `Sentry.captureException(error)` to the existing `if (error)` blocks in:
- `src/hooks/usePositions.ts` — `addPosition`, `removePosition`, `closePosition` error handlers
- `src/context/WatchlistContext.tsx` — `addTicker`, `removeTicker` error handlers

**Pattern — call unconditionally, let SDK no-op when not initialized:**
```ts
import * as Sentry from '@sentry/react';

// In error handler:
Sentry.captureException(error);  // no DSN guard needed — SDK is a no-op when not initialized
showToast('Failed to save position', 'error');
```

Do NOT add a `if (import.meta.env.VITE_SENTRY_DSN)` guard — the SDK handles this internally. Unconditional calls are the idiomatic pattern.

---

## Implementation Order

1. `vercel.json` + `.env.example` (add 3 missing vars) + rotate Supabase key + configure Supabase Auth URLs
2. `ErrorBoundary.tsx` (with `ErrorFallback` export) + wire into `App.tsx`
3. `ForgotPassword.tsx` + `ResetPassword.tsx` + `NotFound.tsx` + routes in `App.tsx`
4. Install `@sentry/react@8` + `main.tsx` init + replace boundary in `App.tsx` + `captureException` in hooks
5. Push to GitHub → connect Vercel → add env vars → deploy
6. Smoke test all routes on live URL: `/dashboard`, `/watchlist`, `/wheel`, `/screener`, `/forgot-password`, `/reset-password`, `/nonexistent-route`

---

## Out of Scope

- Tests (no testing framework added in this phase)
- CI/CD pipeline (GitHub Actions)
- Accessibility audit
- Performance optimization / bundle splitting
- Full git history rewrite to remove the committed `.env`
