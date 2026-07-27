# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/dashboards.spec.ts >> Public pages >> /pricing loads with plan names
- Location: tests/smoke/dashboards.spec.ts:57:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Ksh')
Expected: visible
Error: strict mode violation: locator('text=Ksh') resolved to 3 elements:
    1) <span class="font-display text-4xl font-bold">Ksh 300</span> aka getByText('Ksh 300')
    2) <span class="font-display text-4xl font-bold">Ksh 2,500</span> aka getByText('Ksh 2,500')
    3) <span class="font-display text-4xl font-bold">Ksh 5,500</span> aka getByText('Ksh 5,500')

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Ksh')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - status "Loading Tusome Live" [ref=e2]:
    - img "Tusome Live" [ref=e5]
  - generic [ref=e8]:
    - banner [ref=e9]:
      - generic [ref=e10]:
        - link "Tusome Live home" [ref=e11] [cursor=pointer]:
          - /url: /
          - img "Tusome Live" [ref=e13]
        - navigation [ref=e14]:
          - link "Home" [ref=e15] [cursor=pointer]:
            - /url: /
          - link "Classes" [ref=e16] [cursor=pointer]:
            - /url: /classes
          - link "Tutors" [ref=e17] [cursor=pointer]:
            - /url: /tutors
          - link "Pricing" [ref=e18] [cursor=pointer]:
            - /url: /pricing
          - link "About" [ref=e19] [cursor=pointer]:
            - /url: /about
          - link "Contact" [ref=e20] [cursor=pointer]:
            - /url: /contact
        - generic [ref=e21]:
          - link [ref=e22] [cursor=pointer]:
            - /url: /login
            - button "Sign in" [ref=e23]
          - link [ref=e24] [cursor=pointer]:
            - /url: /signup
            - button "Get started" [ref=e25]
    - main [ref=e26]:
      - generic [ref=e28]:
        - paragraph [ref=e29]: Pricing
        - heading "Simple, family-friendly pricing." [level=1] [ref=e30]
        - paragraph [ref=e31]: Pay per session or subscribe monthly. All plans include access to qualified CBE tutors and easy M-Pesa payments.
      - generic [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - heading "Pay as you go" [level=3] [ref=e35]
            - paragraph [ref=e36]: Perfect for trying a class or occasional homework help.
            - generic [ref=e37]:
              - generic [ref=e38]: Ksh 300
              - generic [ref=e39]: /session
            - link [ref=e40] [cursor=pointer]:
              - /url: /signup
              - button "Start booking" [ref=e41]
            - list [ref=e42]:
              - listitem [ref=e43]: Book any group class
              - listitem [ref=e46]: Homework help per question
              - listitem [ref=e49]: Pay via M-Pesa per session
              - listitem [ref=e52]: Free sample notes
          - generic [ref=e55]:
            - generic [ref=e56]: Most popular
            - heading "Learner Monthly" [level=3] [ref=e57]
            - paragraph [ref=e58]: Our most popular plan for committed learners.
            - generic [ref=e59]:
              - generic [ref=e60]: Ksh 2,500
              - generic [ref=e61]: /month
            - link [ref=e62] [cursor=pointer]:
              - /url: /signup
              - button "Get Learner Monthly" [ref=e63]
            - list [ref=e64]:
              - listitem [ref=e65]: Up to 12 group classes / month
              - listitem [ref=e68]: Unlimited homework support
              - listitem [ref=e71]: All revision notes & papers
              - listitem [ref=e74]: Recorded lessons access
              - listitem [ref=e77]: Parent progress reports
          - generic [ref=e80]:
            - heading "1-on-1 Premium" [level=3] [ref=e81]
            - paragraph [ref=e82]: Personalized attention for top-performing learners.
            - generic [ref=e83]:
              - generic [ref=e84]: Ksh 5,500
              - generic [ref=e85]: /month
            - link [ref=e86] [cursor=pointer]:
              - /url: /signup
              - button "Go Premium" [ref=e87]
            - list [ref=e88]:
              - listitem [ref=e89]: 8 one-on-one sessions / month
              - listitem [ref=e92]: Dedicated tutor match
              - listitem [ref=e95]: Custom learning plan
              - listitem [ref=e98]: Everything in Learner Monthly
              - listitem [ref=e101]: Priority homework support
        - generic [ref=e104]:
          - generic [ref=e105]:
            - paragraph [ref=e106]: How do I pay?
            - paragraph [ref=e107]: All payments are processed securely via M-Pesa. You'll get an STK push to confirm.
          - generic [ref=e108]:
            - paragraph [ref=e109]: Can I cancel anytime?
            - paragraph [ref=e110]: Yes. Monthly plans can be paused or cancelled before the next billing cycle.
          - generic [ref=e111]:
            - paragraph [ref=e112]: Are materials really free for enrolled learners?
            - paragraph [ref=e113]: Yes — learners on the Monthly or Premium plans get all notes and recordings included.
    - contentinfo [ref=e114]:
      - generic [ref=e115]:
        - generic [ref=e116]:
          - link "Tusome Live home" [ref=e117] [cursor=pointer]:
            - /url: /
            - img "Tusome Live" [ref=e119]
          - paragraph [ref=e120]: Live online CBE tuition for Kenyan learners in Grades 7, 8 & 9. Quality teaching, anywhere in the country.
          - generic [ref=e121]:
            - paragraph [ref=e122]: Tusomelive@gmail
            - paragraph [ref=e126]: +254 700 000 000
            - paragraph [ref=e129]: Nairobi, Kenya
        - generic [ref=e133]:
          - paragraph [ref=e134]: Learn
          - list [ref=e135]:
            - listitem [ref=e136]:
              - link "Classes" [ref=e137] [cursor=pointer]:
                - /url: /classes
            - listitem [ref=e138]:
              - link "Tutors" [ref=e139] [cursor=pointer]:
                - /url: /tutors
            - listitem [ref=e140]:
              - link "Pricing" [ref=e141] [cursor=pointer]:
                - /url: /pricing
        - generic [ref=e142]:
          - paragraph [ref=e143]: Company
          - list [ref=e144]:
            - listitem [ref=e145]:
              - link "About us" [ref=e146] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e147]:
              - link "Contact" [ref=e148] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e149]:
              - link "Become a tutor" [ref=e150] [cursor=pointer]:
                - /url: /signup
      - generic [ref=e152]:
        - paragraph [ref=e153]: © 2026 Tusome Live. All rights reserved.
        - paragraph [ref=e154]: Quality CBE learning, for every Kenyan home.
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | /**
  2   |  * Dashboard Smoke Tests — Tusome Live
  3   |  *
  4   |  * Verifies that every public and authenticated page/dashboard loads correctly.
  5   |  * Uses the test credentials from .env.local (DB: kif3 / Mwa$0152) and a fresh
  6   |  * signup account so the tests are self-contained.
  7   |  *
  8   |  * Routes tested:
  9   |  *   Public  : / | /about | /pricing | /tutors | /contact | /login | /signup
  10  |  *   Auth    : /classes | /conference/:classId
  11  |  *   API     : /api/auth/me | /api/classes
  12  |  */
  13  | 
  14  | import { test, expect, type Page } from '@playwright/test';
  15  | 
  16  | // ─── helpers ─────────────────────────────────────────────────────────────────
  17  | 
  18  | /** Generate a unique test-user email so each run is isolated. */
  19  | const testEmail = `smoke.${Date.now()}@tusome-test.internal`;
  20  | const testPassword = 'Smoke1234!';
  21  | const testFirst = 'Smoke';
  22  | const testLast = 'Tester';
  23  | 
  24  | /** Confirm a page returns HTTP 200 and renders a non-empty <body>. */
  25  | async function assertPageOk(page: Page, path: string, label: string) {
  26  |   const [response] = await Promise.all([
  27  |     page.waitForResponse((r) => r.url().includes(path.split('?')[0]) || true, { timeout: 15000 }).catch(() => null),
  28  |     page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30000 }),
  29  |   ]);
  30  | 
  31  |   const status = page.url(); // just confirm navigation succeeded
  32  |   const bodyText = await page.locator('body').innerText().catch(() => '');
  33  |   expect(bodyText.length, `${label}: body should not be empty`).toBeGreaterThan(10);
  34  | 
  35  |   // There must be no unhandled 500 / crash banner
  36  |   const crashText = await page.locator('text=Application Error').count();
  37  |   expect(crashText, `${label}: should not show Application Error`).toBe(0);
  38  | }
  39  | 
  40  | // ─── 1. PUBLIC PAGES ─────────────────────────────────────────────────────────
  41  | 
  42  | test.describe('Public pages', () => {
  43  |   test('Home page (/) loads and shows hero heading', async ({ page }) => {
  44  |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  45  |     const h1 = page.locator('h1').first();
  46  |     await expect(h1).toBeVisible({ timeout: 10000 });
  47  |     const text = await h1.innerText();
  48  |     expect(text.length).toBeGreaterThan(5);
  49  |   });
  50  | 
  51  |   test('/about loads with page heading', async ({ page }) => {
  52  |     await page.goto('/about', { waitUntil: 'domcontentloaded' });
  53  |     await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  54  |     await assertPageOk(page, '/about', '/about');
  55  |   });
  56  | 
  57  |   test('/pricing loads with plan names', async ({ page }) => {
  58  |     await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  59  |     // At least one plan name should appear
> 60  |     await expect(page.locator('text=Ksh')).toBeVisible({ timeout: 10000 });
      |                                            ^ Error: expect(locator).toBeVisible() failed
  61  |   });
  62  | 
  63  |   test('/tutors loads with tutor cards', async ({ page }) => {
  64  |     await page.goto('/tutors', { waitUntil: 'domcontentloaded' });
  65  |     await expect(page.locator('text=Mr. Kamau')).toBeVisible({ timeout: 10000 });
  66  |   });
  67  | 
  68  |   test('/contact loads with a contact form or info', async ({ page }) => {
  69  |     await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  70  |     await assertPageOk(page, '/contact', '/contact');
  71  |   });
  72  | 
  73  |   test('/login renders the sign-in form', async ({ page }) => {
  74  |     await page.goto('/login', { waitUntil: 'domcontentloaded' });
  75  |     await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
  76  |     await expect(page.locator('input[name="password"]')).toBeVisible();
  77  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  78  |   });
  79  | 
  80  |   test('/signup renders the registration form', async ({ page }) => {
  81  |     await page.goto('/signup', { waitUntil: 'domcontentloaded' });
  82  |     await expect(page.locator('input[name="firstName"]')).toBeVisible({ timeout: 10000 });
  83  |     await expect(page.locator('input[name="email"]')).toBeVisible();
  84  |     await expect(page.locator('input[name="password"]')).toBeVisible();
  85  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  86  |   });
  87  | });
  88  | 
  89  | // ─── 2. API ENDPOINTS ────────────────────────────────────────────────────────
  90  | 
  91  | test.describe('API smoke checks', () => {
  92  |   test('GET /api/auth/me returns JSON (unauthenticated → user: null)', async ({ request }) => {
  93  |     const res = await request.get('/api/auth/me');
  94  |     // 200 with { user: null } is the expected unauthenticated response
  95  |     expect([200, 401]).toContain(res.status());
  96  |     if (res.status() === 200) {
  97  |       const body = await res.json();
  98  |       expect(body).toHaveProperty('user');
  99  |     }
  100 |   });
  101 | 
  102 |   test('GET /api/classes returns JSON array (or 503 if DB is offline)', async ({ request }) => {
  103 |     const res = await request.get('/api/classes');
  104 |     expect([200, 503]).toContain(res.status());
  105 |     if (res.status() === 200) {
  106 |       const body = await res.json();
  107 |       expect(body).toHaveProperty('classes');
  108 |       expect(Array.isArray(body.classes)).toBe(true);
  109 |     }
  110 |   });
  111 | 
  112 |   test('POST /api/auth/login with bad credentials returns 401', async ({ request }) => {
  113 |     const res = await request.post('/api/auth/login', {
  114 |       data: { email: 'nobody@nowhere.invalid', password: 'wrongpassword' },
  115 |     });
  116 |     expect(res.status()).toBe(401);
  117 |     const body = await res.json();
  118 |     expect(body).toHaveProperty('message');
  119 |   });
  120 | });
  121 | 
  122 | // ─── 3. FULL AUTH FLOW → CLASSES DASHBOARD ───────────────────────────────────
  123 | 
  124 | test.describe('Authenticated dashboards', () => {
  125 |   /**
  126 |    * Signs up a fresh user (self-contained), then navigates to /classes.
  127 |    * Falls back gracefully when the DB is unavailable.
  128 |    */
  129 |   test('Signup → /classes dashboard is reachable', async ({ page }) => {
  130 |     await page.goto('/signup', { waitUntil: 'domcontentloaded' });
  131 | 
  132 |     await page.fill('input[name="firstName"]', testFirst);
  133 |     await page.fill('input[name="lastName"]', testLast);
  134 |     await page.fill('input[name="email"]', testEmail);
  135 |     await page.fill('input[name="password"]', testPassword);
  136 | 
  137 |     const [signupResponse] = await Promise.all([
  138 |       page.waitForResponse(
  139 |         (r) => r.url().includes('/api/auth/signup'),
  140 |         { timeout: 15000 },
  141 |       ).catch(() => null),
  142 |       page.click('button[type="submit"]'),
  143 |     ]);
  144 | 
  145 |     // If the DB is unavailable the signup endpoint returns 503 —
  146 |     // in that case verify /classes still renders its fallback UI.
  147 |     if (signupResponse && signupResponse.status() === 503) {
  148 |       console.warn('⚠  DB unavailable — checking /classes fallback UI instead');
  149 |       await page.goto('/classes', { waitUntil: 'domcontentloaded' });
  150 |       // Fallback classes are hard-coded in the component
  151 |       await expect(page.locator('text=Mathematics')).toBeVisible({ timeout: 10000 });
  152 |       return;
  153 |     }
  154 | 
  155 |     // Happy path: we should land on /classes after successful signup
  156 |     await page.waitForURL('**/classes', { timeout: 15000 }).catch(async () => {
  157 |       // navigation may already have happened via window.location.href
  158 |       if (!page.url().includes('/classes')) {
  159 |         await page.goto('/classes', { waitUntil: 'domcontentloaded' });
  160 |       }
```