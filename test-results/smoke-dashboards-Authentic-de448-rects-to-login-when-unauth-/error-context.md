# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke/dashboards.spec.ts >> Authenticated dashboards >> /conference/1 renders the conference UI (redirects to /login when unauth)
- Location: tests/smoke/dashboards.spec.ts:208:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Classes')
Expected: visible
Error: strict mode violation: locator('text=Classes') resolved to 3 elements:
    1) <a href="/classes" class="hover:text-foreground transition">Classes</a> aka getByRole('navigation').getByRole('link', { name: 'Classes' })
    2) <a href="/classes" class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">…</a> aka getByRole('main').getByRole('link', { name: 'Classes' })
    3) <a href="/classes" class="hover:text-foreground">Classes</a> aka getByRole('contentinfo').getByRole('link', { name: 'Classes' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Classes')

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
      - generic [ref=e27]:
        - generic [ref=e28]:
          - generic [ref=e29]:
            - link "Classes" [ref=e30] [cursor=pointer]:
              - /url: /classes
            - heading "Live class" [level=1] [ref=e33]
            - paragraph [ref=e34]: Connecting to class...
          - generic [ref=e35]: Connecting to class...
        - generic [ref=e41]:
          - paragraph [ref=e45]: Connecting to class...
          - link [ref=e46] [cursor=pointer]:
            - /url: /login
            - button "Sign in" [ref=e47]
    - contentinfo [ref=e48]:
      - generic [ref=e49]:
        - generic [ref=e50]:
          - link "Tusome Live home" [ref=e51] [cursor=pointer]:
            - /url: /
            - img "Tusome Live" [ref=e53]
          - paragraph [ref=e54]: Live online CBE tuition for Kenyan learners in Grades 7, 8 & 9. Quality teaching, anywhere in the country.
          - generic [ref=e55]:
            - paragraph [ref=e56]: Tusomelive@gmail
            - paragraph [ref=e60]: +254 700 000 000
            - paragraph [ref=e63]: Nairobi, Kenya
        - generic [ref=e67]:
          - paragraph [ref=e68]: Learn
          - list [ref=e69]:
            - listitem [ref=e70]:
              - link "Classes" [ref=e71] [cursor=pointer]:
                - /url: /classes
            - listitem [ref=e72]:
              - link "Tutors" [ref=e73] [cursor=pointer]:
                - /url: /tutors
            - listitem [ref=e74]:
              - link "Pricing" [ref=e75] [cursor=pointer]:
                - /url: /pricing
        - generic [ref=e76]:
          - paragraph [ref=e77]: Company
          - list [ref=e78]:
            - listitem [ref=e79]:
              - link "About us" [ref=e80] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e81]:
              - link "Contact" [ref=e82] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=e83]:
              - link "Become a tutor" [ref=e84] [cursor=pointer]:
                - /url: /signup
      - generic [ref=e86]:
        - paragraph [ref=e87]: © 2026 Tusome Live. All rights reserved.
        - paragraph [ref=e88]: Quality CBE learning, for every Kenyan home.
  - region "Notifications alt+T"
```

# Test source

```ts
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
  217 |       isConferencePage || isLoginPage,
  218 |       'Should be on conference page or login page',
  219 |     ).toBe(true);
  220 | 
  221 |     if (isConferencePage) {
  222 |       // Conference shell should render the back-link and status text
> 223 |       await expect(page.locator('text=Classes')).toBeVisible({ timeout: 10000 });
      |                                                  ^ Error: expect(locator).toBeVisible() failed
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