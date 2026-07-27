# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/dashboards.spec.ts >> Authenticated dashboards >> Login with test credentials (or graceful 503 fallback)
- Location: tests/smoke/dashboards.spec.ts:168:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Mathematics')
Expected: visible
Error: strict mode violation: locator('text=Mathematics') resolved to 2 elements:
    1) <button class="rounded-full px-4 py-2 text-sm border transition bg-card border-border text-muted-foreground hover:text-foreground">Mathematics</button> aka getByRole('button', { name: 'Mathematics' })
    2) <h3 class="mt-3 text-xl font-semibold">Mathematics</h3> aka getByRole('heading', { name: 'Mathematics' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Mathematics')

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - status "Loading Tusome Live" [ref=f1e2]:
    - img "Tusome Live" [ref=f1e5]
  - generic [ref=f1e8]:
    - banner [ref=f1e9]:
      - generic [ref=f1e10]:
        - link "Tusome Live home" [ref=f1e11] [cursor=pointer]:
          - /url: /
          - img "Tusome Live" [ref=f1e13]
        - navigation [ref=f1e14]:
          - link "Home" [ref=f1e15] [cursor=pointer]:
            - /url: /
          - link "Classes" [ref=f1e16] [cursor=pointer]:
            - /url: /classes
          - link "Tutors" [ref=f1e17] [cursor=pointer]:
            - /url: /tutors
          - link "Pricing" [ref=f1e18] [cursor=pointer]:
            - /url: /pricing
          - link "About" [ref=f1e19] [cursor=pointer]:
            - /url: /about
          - link "Contact" [ref=f1e20] [cursor=pointer]:
            - /url: /contact
        - generic [ref=f1e21]:
          - link [ref=f1e22] [cursor=pointer]:
            - /url: /login
            - button "Sign in" [ref=f1e23]
          - link [ref=f1e24] [cursor=pointer]:
            - /url: /signup
            - button "Get started" [ref=f1e25]
    - main [ref=f1e26]:
      - generic [ref=f1e28]:
        - paragraph [ref=f1e29]: Live classes
        - heading "Pick a class. Join from anywhere in Kenya." [level=1] [ref=f1e30]
        - paragraph [ref=f1e31]: Live, interactive CBE tuition with qualified tutors. Group sessions for collaborative learning or one-on-one for focused attention.
      - generic [ref=f1e32]:
        - generic [ref=f1e33]:
          - button "All" [ref=f1e34]
          - button "Grade 7" [ref=f1e35]
          - button "Grade 8" [ref=f1e36]
          - button "Grade 9" [ref=f1e37]
          - button "Mathematics" [ref=f1e38]
          - button "Sciences" [ref=f1e39]
          - button "Languages" [ref=f1e40]
        - generic [ref=f1e41]:
          - generic [ref=f1e42]:
            - generic [ref=f1e43]:
              - generic [ref=f1e44]: Grade 7
              - generic [ref=f1e45]: Live
            - heading "Mathematics" [level=3] [ref=f1e46]
            - paragraph [ref=f1e47]: with Mr. Kamau
            - generic [ref=f1e48]:
              - paragraph [ref=f1e49]: Mon & Wed · 6:00pm
              - paragraph [ref=f1e53]: 4 / 8 seats
              - paragraph [ref=f1e59]: Jitsi Meet
            - generic [ref=f1e63]:
              - generic [ref=f1e64]: Ksh 400/session
              - link [ref=f1e65] [cursor=pointer]:
                - /url: /conference/1
                - button "Join" [ref=f1e66]
          - generic [ref=f1e67]:
            - generic [ref=f1e68]:
              - generic [ref=f1e69]: Grade 8
              - generic [ref=f1e70]: Live
            - heading "Integrated Science" [level=3] [ref=f1e71]
            - paragraph [ref=f1e72]: with Ms. Wanjiru
            - generic [ref=f1e73]:
              - paragraph [ref=f1e74]: Tue & Thu · 5:00pm
              - paragraph [ref=f1e78]: 6 / 10 seats
              - paragraph [ref=f1e84]: Jitsi Meet
            - generic [ref=f1e88]:
              - generic [ref=f1e89]: Ksh 350/session
              - link [ref=f1e90] [cursor=pointer]:
                - /url: /conference/2
                - button "Join" [ref=f1e91]
          - generic [ref=f1e92]:
            - generic [ref=f1e93]:
              - generic [ref=f1e94]: Grade 9
              - generic [ref=f1e95]: Live
            - heading "English" [level=3] [ref=f1e96]
            - paragraph [ref=f1e97]: with Mr. Otieno
            - generic [ref=f1e98]:
              - paragraph [ref=f1e99]: Sat · 10:00am
              - paragraph [ref=f1e103]: 3 / 8 seats
              - paragraph [ref=f1e109]: Jitsi Meet
            - generic [ref=f1e113]:
              - generic [ref=f1e114]: Ksh 450/session
              - link [ref=f1e115] [cursor=pointer]:
                - /url: /conference/3
                - button "Join" [ref=f1e116]
          - generic [ref=f1e117]:
            - generic [ref=f1e118]:
              - generic [ref=f1e119]: Grade 7
              - generic [ref=f1e120]: Live
            - heading "Kiswahili" [level=3] [ref=f1e121]
            - paragraph [ref=f1e122]: with Ms. Mwende
            - generic [ref=f1e123]:
              - paragraph [ref=f1e124]: Fri · 4:30pm
              - paragraph [ref=f1e128]: 5 / 10 seats
              - paragraph [ref=f1e134]: Jitsi Meet
            - generic [ref=f1e138]:
              - generic [ref=f1e139]: Ksh 350/session
              - link [ref=f1e140] [cursor=pointer]:
                - /url: /conference/4
                - button "Join" [ref=f1e141]
          - generic [ref=f1e142]:
            - generic [ref=f1e143]:
              - generic [ref=f1e144]: Grade 8
              - generic [ref=f1e145]: Live
            - heading "Social Studies" [level=3] [ref=f1e146]
            - paragraph [ref=f1e147]: with Mr. Njoroge
            - generic [ref=f1e148]:
              - paragraph [ref=f1e149]: Wed · 6:30pm
              - paragraph [ref=f1e153]: 7 / 12 seats
              - paragraph [ref=f1e159]: Jitsi Meet
            - generic [ref=f1e163]:
              - generic [ref=f1e164]: Ksh 300/session
              - link [ref=f1e165] [cursor=pointer]:
                - /url: /conference/5
                - button "Join" [ref=f1e166]
          - generic [ref=f1e167]:
            - generic [ref=f1e168]:
              - generic [ref=f1e169]: Grade 9
              - generic [ref=f1e170]: Live
            - heading "Pre-Technical" [level=3] [ref=f1e171]
            - paragraph [ref=f1e172]: with Ms. Achieng
            - generic [ref=f1e173]:
              - paragraph [ref=f1e174]: Sat · 2:00pm
              - paragraph [ref=f1e178]: 2 / 8 seats
              - paragraph [ref=f1e184]: Jitsi Meet
            - generic [ref=f1e188]:
              - generic [ref=f1e189]: Ksh 450/session
              - link [ref=f1e190] [cursor=pointer]:
                - /url: /conference/6
                - button "Join" [ref=f1e191]
        - generic [ref=f1e192]:
          - heading "Need a class that's not listed?" [level=2] [ref=f1e193]
          - paragraph [ref=f1e194]: Request a custom session and we'll match you with the right CBE tutor for your learner.
          - link [ref=f1e195] [cursor=pointer]:
            - /url: /contact
            - button "Request a class" [ref=f1e196]
    - contentinfo [ref=f1e197]:
      - generic [ref=f1e198]:
        - generic [ref=f1e199]:
          - link "Tusome Live home" [ref=f1e200] [cursor=pointer]:
            - /url: /
            - img "Tusome Live" [ref=f1e202]
          - paragraph [ref=f1e203]: Live online CBE tuition for Kenyan learners in Grades 7, 8 & 9. Quality teaching, anywhere in the country.
          - generic [ref=f1e204]:
            - paragraph [ref=f1e205]: Tusomelive@gmail
            - paragraph [ref=f1e209]: +254 700 000 000
            - paragraph [ref=f1e212]: Nairobi, Kenya
        - generic [ref=f1e216]:
          - paragraph [ref=f1e217]: Learn
          - list [ref=f1e218]:
            - listitem [ref=f1e219]:
              - link "Classes" [ref=f1e220] [cursor=pointer]:
                - /url: /classes
            - listitem [ref=f1e221]:
              - link "Tutors" [ref=f1e222] [cursor=pointer]:
                - /url: /tutors
            - listitem [ref=f1e223]:
              - link "Pricing" [ref=f1e224] [cursor=pointer]:
                - /url: /pricing
        - generic [ref=f1e225]:
          - paragraph [ref=f1e226]: Company
          - list [ref=f1e227]:
            - listitem [ref=f1e228]:
              - link "About us" [ref=f1e229] [cursor=pointer]:
                - /url: /about
            - listitem [ref=f1e230]:
              - link "Contact" [ref=f1e231] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=f1e232]:
              - link "Become a tutor" [ref=f1e233] [cursor=pointer]:
                - /url: /signup
      - generic [ref=f1e235]:
        - paragraph [ref=f1e236]: © 2026 Tusome Live. All rights reserved.
        - paragraph [ref=f1e237]: Quality CBE learning, for every Kenyan home.
  - region "Notifications alt+T"
```

# Test source

```ts
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
> 191 |         await expect(page.locator('text=Mathematics')).toBeVisible({ timeout: 10000 });
      |                                                        ^ Error: expect(locator).toBeVisible() failed
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
  217 |       isConferencePage || isLoginPage,
  218 |       'Should be on conference page or login page',
  219 |     ).toBe(true);
  220 | 
  221 |     if (isConferencePage) {
  222 |       // Conference shell should render the back-link and status text
  223 |       await expect(page.locator('text=Classes')).toBeVisible({ timeout: 10000 });
  224 |     } else {
  225 |       // Login page should show the sign-in form
  226 |       await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 });
  227 |     }
  228 |   });
  229 | });
  230 | 
  231 | // ─── 4. NAVIGATION INTEGRITY ─────────────────────────────────────────────────
  232 | 
  233 | test.describe('Navigation integrity', () => {
  234 |   const publicRoutes = [
  235 |     { path: '/', name: 'Home' },
  236 |     { path: '/about', name: 'About' },
  237 |     { path: '/pricing', name: 'Pricing' },
  238 |     { path: '/tutors', name: 'Tutors' },
  239 |     { path: '/login', name: 'Login' },
  240 |     { path: '/signup', name: 'Signup' },
  241 |     { path: '/classes', name: 'Classes' },
  242 |   ];
  243 | 
  244 |   for (const route of publicRoutes) {
  245 |     test(`${route.name} (${route.path}) returns 200 and renders <body>`, async ({ page }) => {
  246 |       const response = await page.goto(route.path, {
  247 |         waitUntil: 'domcontentloaded',
  248 |         timeout: 30000,
  249 |       });
  250 |       // TanStack Start SSR returns 200 for all known routes
  251 |       expect(
  252 |         response?.status() ?? 200,
  253 |         `${route.name} should not return an error status`,
  254 |       ).toBeLessThan(500);
  255 | 
  256 |       // Body should have meaningful content
  257 |       const bodyText = await page.locator('body').innerText().catch(() => '');
  258 |       expect(bodyText.length, `${route.name}: body must not be empty`).toBeGreaterThan(20);
  259 |     });
  260 |   }
  261 | });
  262 | 
```