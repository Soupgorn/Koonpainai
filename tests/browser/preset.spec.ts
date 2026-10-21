import { test, expect } from "@playwright/test";

test("approved fonts, Thai fallback and friend navigation work with motion enabled", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-10-20T10:30:00+07:00") });
  await page.goto("/");
  const friend = page.locator('a[href="/friends/bean"]');
  await expect(friend).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    title: getComputedStyle(document.querySelector("h1")!).fontFamily,
  }));
  expect(fonts.body).toMatch(/Kodchasan/i);
  expect(fonts.body).toContain("Noto Sans Thai Variable");
  expect(fonts.title).toMatch(/Mali/i);
  await page.getByRole("button", { name: /^In class/ }).click();
  await expect(page.locator(".friend-card")).toHaveCount(6);
  await friend.focus();
  await expect(friend).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/friends\/bean$/);
  await expect(page.getByRole("heading", { name: /Bean/ }).first()).toBeVisible();
  await page.getByRole("link", { name: "All friends" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(friend).toBeVisible();
  expect(errors).toEqual([]);
});
