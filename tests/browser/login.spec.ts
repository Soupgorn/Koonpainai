import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("login has one Thai card, scoped fonts and no obsolete content at all supported sizes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login?signedOut=local");
  const card = page.locator(".auth-card");
  await expect(card).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("header, footer, nav, .login-story, .login-demo, .sso-note, .login-privacy")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("เวลาว่างตรงกัน");
  await expect(page.getByText("Koonpinai", { exact: true })).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Continue with KMITL SSO" })).toBeDisabled();
  await expect(page.getByRole("link")).toHaveCount(1); // Accessible skip link only.
  const copy = await page.locator("body").innerText();
  for (const removed of ["Find a break together.", "Same campus.", "Mild", "Bean", "For the approved KMITL OIDC client", "signed out", "planned service", "A little less asking", "Made for the time between classes"])
    expect(copy).not.toContain(removed);
  const fonts = await page.locator("main").evaluate((main) => ({
    body: getComputedStyle(main).fontFamily,
    heading: getComputedStyle(main.querySelector("h1")!).fontFamily,
  }));
  expect(fonts.body).toMatch(/Kodchasan/);
  expect(fonts.heading).toMatch(/Mali/);
  for (const mode of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
    for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await card.boundingBox();
      expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(2);
      expect(Math.abs(box!.y + box!.height / 2 - 450)).toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator("main").evaluate((main) => getComputedStyle(main).backgroundColor)).toBe("rgb(245, 248, 254)");
    }
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 360 });
  expect((await card.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await page.getByRole("button").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button")).toBeInViewport();
  expect(errors).toEqual([]);
});

test("original sign-in action shows pending state and fails closed without configuration", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with KMITL SSO" })).toBeDisabled();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/login", async (route) => {
    if (route.request().method() === "POST") await gate;
    await route.continue();
  });
  // Bypass the UI guard to verify the real server action still rejects unconfigured sign-in.
  await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  const pending = page.getByRole("button", { name: "Connecting to KMITL…" });
  await expect(pending).toHaveAttribute("aria-busy", "true");
  await expect(pending).toBeDisabled();
  release();
  await expect(page).toHaveURL(/\/login\?error=Configuration$/);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Please try again");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("login-only chrome removal leaves other routes with their existing shell", async ({ page }) => {
  await page.goto("/friends/does-not-exist");
  await expect(page.locator("header")).toHaveCount(1);
  await page.goto("/login?error=SignInFailed");
  await expect(page.locator("header, footer, nav")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("header")).toHaveCount(1);
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.locator(".friend-card")).toHaveCount(12);
});

test("known sign-in errors have safe retry messages and unknown details stay hidden", async ({ page }) => {
  for (const [code, message] of [
    ["Configuration", "Unable to sign in right now. Please try again later."],
    ["SignInFailed", "Unable to sign in right now. Please try again later."],
    ["AccessDenied", "Sign-in was not allowed. Please try again or contact support."],
    ["private-provider-detail", "Sign-in could not be completed. Please try again."],
  ]) {
    await page.goto("/login?" + new URLSearchParams({ error: code }));
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(message);
    await expect(page.locator("body")).not.toContainText("private-provider-detail");
  }
});
