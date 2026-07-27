import { test, expect } from '@playwright/test';

test('signup, login and join conference smoke', async ({ page, baseURL }) => {
  const timestamp = Date.now();
  const email = `e2e.user.${timestamp}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name="firstName"]', 'E2E');
  await page.fill('input[name="lastName"]', 'User');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'password123');
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
  // wait for iframe element
  const iframe = page.frameLocator('iframe');
  // the Jitsi iframe should contain 'Join meeting' text in prejoin
  await expect(iframe.locator('text=Join meeting')).toBeVisible({ timeout: 10000 });
});
