# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/dashboards.spec.ts >> API smoke checks >> POST /api/auth/login with bad credentials returns 401
- Location: tests/smoke/dashboards.spec.ts:112:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 503
```

# Test source

```ts
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
  60  |     await expect(page.locator('text=Ksh')).toBeVisible({ timeout: 10000 });
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
> 116 |     expect(res.status()).toBe(401);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
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
  161 |     });
  162 | 
  163 |     await expect(page).toHaveURL(/\/classes$/);
  164 |     // The classes grid (fallback or live data) should render
  165 |     await expect(page.locator('h3').first()).toBeVisible({ timeout: 10000 });
  166 |   });
  167 | 
  168 |   test('Login with test credentials (or graceful 503 fallback)', async ({ page }) => {
  169 |     // Re-use the account created in signup (or an existing one if the email
  170 |     // was already registered from a prior run).
  171 |     await page.goto('/login', { waitUntil: 'domcontentloaded' });
  172 |     await page.fill('input[name="email"]', testEmail);
  173 |     await page.fill('input[name="password"]', testPassword);
  174 | 
  175 |     const [loginResponse] = await Promise.all([
  176 |       page.waitForResponse(
  177 |         (r) => r.url().includes('/api/auth/login'),
  178 |         { timeout: 15000 },
  179 |       ).catch(() => null),
  180 |       page.click('button[type="submit"]'),
  181 |     ]);
  182 | 
  183 |     if (loginResponse) {
  184 |       const status = loginResponse.status();
  185 |       if (status === 200) {
  186 |         await page.waitForURL('**/classes', { timeout: 15000 }).catch(() => {});
  187 |         expect(page.url()).toContain('/classes');
  188 |       } else if (status === 503) {
  189 |         console.warn('⚠  DB unavailable — login returned 503, verifying /classes fallback');
  190 |         await page.goto('/classes', { waitUntil: 'domcontentloaded' });
  191 |         await expect(page.locator('text=Mathematics')).toBeVisible({ timeout: 10000 });
  192 |       } else {
  193 |         // 401 is expected if the signup test above didn't create the account yet
  194 |         console.warn(`⚠  Login returned ${status} — credentials may not exist yet`);
  195 |       }
  196 |     }
  197 |   });
  198 | 
  199 |   test('/classes dashboard renders class cards (with or without DB)', async ({ page }) => {
  200 |     // Navigate directly — the component shows fallback data even when unauthenticated
  201 |     await page.goto('/classes', { waitUntil: 'domcontentloaded' });
  202 |     // The page title should be present
  203 |     await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  204 |     // At least one class card should be visible (either live or fallback)
  205 |     await expect(page.locator('text=Mathematics')).toBeVisible({ timeout: 10000 });
  206 |   });
  207 | 
  208 |   test('/conference/1 renders the conference UI (redirects to /login when unauth)', async ({ page }) => {
  209 |     await page.goto('/conference/1', { waitUntil: 'domcontentloaded' });
  210 | 
  211 |     // Either the conference UI loads or we are redirected to /login
  212 |     const currentUrl = page.url();
  213 |     const isConferencePage = currentUrl.includes('/conference/');
  214 |     const isLoginPage = currentUrl.includes('/login');
  215 | 
  216 |     expect(
```