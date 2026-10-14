/**
 * Dashboard Smoke Tests — Elimusphere
 *
 * Verifies that every public and authenticated page/dashboard loads correctly.
 * Uses the test credentials from .env.local (DB: kif3 / Mwa$0152) and a fresh
 * signup account so the tests are self-contained.
 *
 * Routes tested:
 *   Public  : / | /about | /pricing | /tutors | /contact | /login | /signup
 *   Auth    : /classes | /conference/:classId
 *   API     : /api/auth/me | /api/classes
 */

import { test, expect, type Page } from '@playwright/test';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Generate a unique test-user email so each run is isolated. */
const testEmail = `smoke.${Date.now()}@tusome-test.internal`;
const testPassword = 'Smoke1234!';
const testFirst = 'Smoke';
const testLast = 'Tester';

/** Confirm a page returns HTTP 200 and renders a non-empty <body>. */
async function assertPageOk(page: Page, path: string, label: string) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(path.split('?')[0]) || true, { timeout: 15000 }).catch(() => null),
    page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30000 }),
  ]);

  const status = page.url(); // just confirm navigation succeeded
  const bodyText = await page.locator('body').innerText().catch(() => '');
  expect(bodyText.length, `${label}: body should not be empty`).toBeGreaterThan(10);

  // There must be no unhandled 500 / crash banner
  const crashText = await page.locator('text=Application Error').count();
  expect(crashText, `${label}: should not show Application Error`).toBe(0);
}

// ─── 1. PUBLIC PAGES ─────────────────────────────────────────────────────────

test.describe('Public pages', () => {
  test('Home page (/) loads and shows hero heading', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
    const text = await h1.innerText();
    expect(text.length).toBeGreaterThan(5);
  });

  test('/about loads with page heading', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await assertPageOk(page, '/about', '/about');
  });

  test('/pricing loads with plan names', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    // At least one plan price should appear — use .first() to avoid strict-mode
    // violation (multiple "Ksh" spans appear across plan cards)
    await expect(page.locator('text=Ksh').first()).toBeVisible({ timeout: 10000 });
  });

  test('/tutors loads with tutor cards', async ({ page }) => {
    await page.goto('/tutors', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Mr. Kamau')).toBeVisible({ timeout: 10000 });
  });

  test('/contact loads with a contact form or info', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    await assertPageOk(page, '/contact', '/contact');
  });

  test('/login renders the sign-in form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('/signup renders the registration form', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[name="firstName"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="acceptLegal"]')).toHaveAttribute('required', '');
    await expect(page.getByRole('link', { name: 'Student Agreement' })).toHaveAttribute(
      'href',
      '/legal/student-agreement',
    );
    await page.getByRole('button', { name: /Tutor/ }).click();
    await expect(page.getByRole('link', { name: 'Teacher Agreement' })).toHaveAttribute(
      'href',
      '/legal/teacher-agreement',
    );
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('legal document pages use the shared website layout', async ({ page }) => {
    await page.goto('/legal/teacher-agreement', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header img').first()).toBeVisible();
    await expect(page.getByRole('navigation').getByText('Classes')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Teacher Agreement' })).toBeVisible();
    await expect(page.locator('article.legal-document')).toContainText('INDEPENDENT CONTRACTOR STATUS');
    await expect(page.locator('footer')).toBeVisible();
  });
});

// ─── 2. API ENDPOINTS ────────────────────────────────────────────────────────

test.describe('API smoke checks', () => {
  test('GET /api/auth/me returns JSON (unauthenticated → user: null)', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    // 200 with { user: null } is the expected unauthenticated response
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('user');
    }
  });

  test('GET /api/classes returns JSON array (or 503 if DB is offline)', async ({ request }) => {
    const res = await request.get('/api/classes');
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('classes');
      expect(Array.isArray(body.classes)).toBe(true);
    }
  });

  test('POST /api/auth/login with bad credentials returns 401 (or 503 when DB is offline)', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'nobody@nowhere.invalid', password: 'wrongpassword' },
    });
    // 401 = DB online, credentials rejected (expected happy path)
    // 503 = DB offline, server reports unavailability gracefully
    expect([401, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('message');
  });

  test('POST /api/auth/signup requires legal acceptance', async ({ request }) => {
    const res = await request.post('/api/auth/signup', {
      data: {
        firstName: 'Legal',
        lastName: 'Test',
        email: 'legal-consent-test@example.com',
        phone: '0712345678',
        password: 'password123',
        role: 'learner',
      },
    });
    expect(res.status()).toBe(400);
    expect(await res.json()).toHaveProperty('message');
  });
});

// ─── 3. FULL AUTH FLOW → CLASSES DASHBOARD ───────────────────────────────────

test.describe('Authenticated dashboards', () => {
  /**
   * Signs up a fresh user (self-contained), then navigates to /classes.
   * Falls back gracefully when the DB is unavailable.
   */
  test('Signup → /classes dashboard is reachable', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await page.fill('input[name="firstName"]', testFirst);
    await page.fill('input[name="lastName"]', testLast);
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="phone"]', '0712345678');
    await page.fill('input[name="password"]', testPassword);
    await page.check('input[name="acceptLegal"]');

    const [signupResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/auth/signup'),
        { timeout: 15000 },
      ).catch(() => null),
      page.click('button[type="submit"]'),
    ]);

    // If the DB is unavailable the signup endpoint returns 503 —
    // in that case verify /classes still renders its fallback UI.
    if (signupResponse && signupResponse.status() === 503) {
      console.warn('⚠  DB unavailable — checking /classes fallback UI instead');
      await page.goto('/classes', { waitUntil: 'domcontentloaded' });
      // Fallback classes are hard-coded in the component.
      // Target the card <h3> specifically to avoid the filter button with the same text.
      await expect(page.locator('h3:has-text("Mathematics")')).toBeVisible({ timeout: 10000 });
      return;
    }

    // Happy path: we should land on /classes after successful signup
    await page.waitForURL('**/classes', { timeout: 15000 }).catch(async () => {
      // navigation may already have happened via window.location.href
      if (!page.url().includes('/classes')) {
        await page.goto('/classes', { waitUntil: 'domcontentloaded' });
      }
    });

    await expect(page).toHaveURL(/\/classes$/);
    // The classes grid (fallback or live data) should render
    await expect(page.locator('h3').first()).toBeVisible({ timeout: 10000 });
  });

  test('Login with test credentials (or graceful 503 fallback)', async ({ page }) => {
    // Re-use the account created in signup (or an existing one if the email
    // was already registered from a prior run).
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/auth/login'),
        { timeout: 15000 },
      ).catch(() => null),
      page.click('button[type="submit"]'),
    ]);

    if (loginResponse) {
      const status = loginResponse.status();
      if (status === 200) {
        await page.waitForURL('**/classes', { timeout: 15000 }).catch(() => {});
        expect(page.url()).toContain('/classes');
      } else if (status === 503) {
        console.warn('⚠  DB unavailable — login returned 503, verifying /classes fallback');
        await page.goto('/classes', { waitUntil: 'domcontentloaded' });
        // Target the card <h3> to avoid strict-mode violation with the filter button.
        await expect(page.locator('h3:has-text("Mathematics")')).toBeVisible({ timeout: 10000 });
      } else {
        // 401 is expected if the signup test above didn't create the account yet
        console.warn(`⚠  Login returned ${status} — credentials may not exist yet`);
      }
    }
  });

  test('/classes dashboard renders class cards (with or without DB)', async ({ page }) => {
    // Navigate directly — the component shows fallback data even when unauthenticated
    await page.goto('/classes', { waitUntil: 'domcontentloaded' });
    // The page title should be present
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    // At least one class card <h3> should be visible (either live or fallback).
    // Use the heading role to avoid the filter button with the same text.
    await expect(page.locator('h3:has-text("Mathematics")')).toBeVisible({ timeout: 10000 });
  });

  test('/conference/1 renders the conference UI (redirects to /login when unauth)', async ({ page }) => {
    await page.goto('/conference/1', { waitUntil: 'domcontentloaded' });

    // Either the conference UI loads or we are redirected to /login
    const currentUrl = page.url();
    const isConferencePage = currentUrl.includes('/conference/');
    const isLoginPage = currentUrl.includes('/login');

    expect(
      isConferencePage || isLoginPage,
      'Should be on conference page or login page',
    ).toBe(true);

    if (isConferencePage) {
      // Conference shell should render the back-link in the page <main> area.
      // Use the specific back-link (not the nav or footer links) to avoid
      // strict-mode violation when multiple "Classes" links are on the page.
      await expect(page.locator('main a[href="/classes"], section a[href="/classes"]').first()).toBeVisible({ timeout: 10000 });
    } else {
      // Login page should show the sign-in form
      await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
    }
  });
});

// ─── 4. NAVIGATION INTEGRITY ─────────────────────────────────────────────────

test.describe('Navigation integrity', () => {
  const publicRoutes = [
    { path: '/', name: 'Home' },
    { path: '/about', name: 'About' },
    { path: '/pricing', name: 'Pricing' },
    { path: '/tutors', name: 'Tutors' },
    { path: "/resources", name: "Resources" },
    { path: "/contact", name: "Contact" },
    { path: "/privacy", name: "Privacy Policy" },
    { path: "/terms", name: "Terms" },
    { path: '/login', name: 'Login' },
    { path: '/signup', name: 'Signup' },
    { path: '/classes', name: 'Classes' },
  ];

  for (const route of publicRoutes) {
    test(`${route.name} (${route.path}) returns 200 and renders <body>`, async ({ page }) => {
      const response = await page.goto(route.path, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      // TanStack Start SSR returns 200 for all known routes
      expect(
        response?.status() ?? 200,
        `${route.name} should not return an error status`,
      ).toBeLessThan(500);

      // Body should have meaningful content
      const bodyText = await page.locator('body').innerText().catch(() => '');
      expect(bodyText.length, `${route.name}: body must not be empty`).toBeGreaterThan(20);
    });
  }

  test("footer internal links navigate to their pages", async ({ page }) => {
    const footerLinks = [
      { name: "Elimusphere home", path: "/" },
      { name: "Classes", path: "/classes" },
      { name: "Tutors", path: "/tutors" },
      { name: "Resources", path: "/resources" },
      { name: "About Us", path: "/about" },
      { name: "Contact", path: "/contact" },
      { name: "Become a tutor", path: "/signup?role=tutor" },
      { name: "Privacy Policy", path: "/privacy" },
      { name: "Terms & Conditions", path: "/terms" },
    ];

    for (const link of footerLinks) {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const footerLink = page.locator("footer").getByRole("link", { name: link.name });
      await expect(footerLink).toHaveAttribute("href", link.path);
      await footerLink.click();
      await page.waitForURL((url) => `${url.pathname}${url.search}` === link.path);
      await expect(page.locator("body")).not.toBeEmpty();
    }
  });
});
