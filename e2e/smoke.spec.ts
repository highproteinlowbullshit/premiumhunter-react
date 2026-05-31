import { test, expect } from '@playwright/test';

// Public routes — no auth required. These verify that routing works and each
// page renders its critical content without JS errors or blank screens.

test('landing page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Premium Hunter').first()).toBeVisible();
  await expect(page.getByText('Sign in').first()).toBeVisible();
});

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  // ProtectedRoute/GuestRoute may show a loading state briefly; wait for heading
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('signup page renders', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('forgot password page renders', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page).not.toHaveURL('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
});

test('404 page renders for unknown route', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByText('404')).toBeVisible({ timeout: 10_000 });
});

test('protected route /dashboard redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/dashboard');
  // ProtectedRoute shows a loading spinner while auth resolves, then navigates
  // to /login when no user is found. Wait up to 10s for the redirect.
  await page.waitForURL((url) => !url.pathname.includes('/dashboard'), { timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
});

test('app has no unhandled JS exceptions on the landing page', async ({ page }) => {
  const uncaught: string[] = [];
  page.on('pageerror', (err) => uncaught.push(err.message));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  // The landing page is public and doesn't depend on auth — any uncaught
  // exception here is a real regression.
  expect(uncaught).toHaveLength(0);
});
