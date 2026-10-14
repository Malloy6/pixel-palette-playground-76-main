import { test, expect } from '@playwright/test';

test('signup, login and join conference smoke', async ({ page, baseURL }) => {
  const timestamp = Date.now();
  const email = `e2e.user.${timestamp}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name="firstName"]', 'E2E');
  await page.fill('input[name="lastName"]', 'User');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', '0712345678');
  await page.fill('input[name="password"]', 'password123');
  await page.check('input[name="acceptLegal"]');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('button[type=submit]'),
  ]);

  // after signup we should be navigated to /classes and see the header with first name
  await expect(page).toHaveURL(/.*\/classes$/);
  const header = await page.locator('header');
  await expect(header).toContainText('E2E');

  // navigate to conference and ensure iframe loads
  await page.goto('/conference/1');
  const iframeElement = page.locator('iframe').first();
  await expect(iframeElement).toBeVisible({ timeout: 15000 });
  await expect(iframeElement).toHaveAttribute('src', /TusomeOnline/, { timeout: 15000 });
});
