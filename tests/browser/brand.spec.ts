import { test, expect } from "@playwright/test";

test("official penguin branding, metadata and approved global fonts reach every route", async ({ page, request }) => {
  const errors: string[] = [], failed: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => { if (r.url().includes("/brand/") && r.status() >= 400) failed.push(r.url()); });
  for (const path of ["/", "/friends/bean", "/my-timetable", "/my-timetable/import", "/account", "/onboarding", "/onboarding/policy", "/pending-approval", "/admin", "/admin/access", "/admin/import", "/login", "/not-a-page"]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveTitle(/Koonpinai$/);
    await expect(page.locator('[data-brand="penguin"]').first()).toBeVisible();
    await expect(page.locator('footer, .preview-control, .schedule-note')).toHaveCount(0);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/Koonpainai|คนไปไหน|คุณไปไหน|Find a break together\.|Try a class-time preview|Made for the time between classes/);
    const fonts = await page.evaluate(() => ({ body: getComputedStyle(document.body).fontFamily, heading: getComputedStyle(document.querySelector('h1')!).fontFamily }));
    expect(fonts.body).toMatch(/Kodchasan/);
    expect(fonts.heading).toMatch(/Mali/);
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.ico');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
    if (path !== '/login') await expect(page.locator('.fixture-badge')).toHaveText('Development sample');
    if (path === '/my-timetable') {
      await expect(page.getByRole('heading', { name: 'No timetable yet' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Current availability' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Set semester', exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Add class', exact: true })).toBeDisabled();
    }
  }
  for (const path of ['/favicon.ico','/apple-touch-icon.png','/brand/koonpinai-mark.svg','/brand/koonpinai-logo.svg','/brand/koonpinai-logo-light.svg','/brand/koonpinai-app-icon.svg','/icons/favicon-16x16.png','/icons/icon-192x192.png','/icons/icon-512x512.png','/icons/icon-maskable-512x512.png']) {
    const response=await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()['content-type']).toMatch(/image/);
  }
  expect(errors).toEqual([]); expect(failed).toEqual([]);
});

test("access management keeps identity readable beside its status control", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin/access');
  const row = page.locator('.access-row').first();
  const identity = await row.locator(':scope > div').boundingBox();
  const control = await row.getByLabel('Access status for June').boundingBox();
  expect(identity!.width).toBeGreaterThanOrEqual(150);
  expect(control!.y).toBeGreaterThanOrEqual(identity!.y + identity!.height);
  await row.getByLabel('Access status for June').selectOption('Approved');
  await expect(page.getByRole('status')).toContainText('No real access changed');
});
