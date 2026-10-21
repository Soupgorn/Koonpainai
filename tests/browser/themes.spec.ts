import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

test("theme: system default, manual override, reload persistence, keyboard and route consistency", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(
    await page.evaluate(() => localStorage.getItem("koonpinai-theme")),
  ).toBeNull();
  const toggle = page.getByRole("button", {
    name: "Switch to Light Mode",
    exact: true,
  });
  await toggle.focus();
  expect(
    await toggle.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe("solid");
  expect(
    await toggle.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe("0s");
  for (const name of ["Switch to Light Mode", "Theme preferences"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/light/);
  const card = page.locator(".friend-card").first();
  const restingBackground = await card.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await card.hover();
  expect(
    await card.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe(restingBackground);
  expect(
    await page.evaluate(() => localStorage.getItem("koonpinai-theme")),
  ).toBe("light");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  for (const path of [
    "/friends/bean",
    "/my-timetable",
    "/onboarding",
    "/pending-approval",
    "/account",
    "/admin/access",
    "/admin",
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(
      page.getByRole("button", { name: "Switch to Dark Mode", exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Theme preferences" }).click();
  await page.getByRole("radio", { name: "System", exact: true }).check();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Theme preferences" }),
  ).toBeFocused();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(
    await page.evaluate(() => localStorage.getItem("koonpinai-theme")),
  ).toBe("system");
  // The preference script applies dark before client components hydrate.
  await page.evaluate(() => localStorage.setItem("koonpinai-theme", "dark"));
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("redesigned routes: both themes, accessibility, responsive layout and screenshots", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const dir = ".impeccable/review/approved-redesign/final";
  await mkdir(dir, { recursive: true });
  await page.clock.install({ time: new Date("2026-10-20T10:30:00+07:00") });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  for (const [name, path] of [
    ["dashboard", "/"],
    ["friend-profile", "/friends/bean"],
    ["my-timetable", "/my-timetable"],
    ["login", "/login"],
    ["admin", "/admin"],
    ["onboarding", "/onboarding"],
    ["policy", "/onboarding/policy"],
    ["approval", "/pending-approval"],
    ["account", "/account"],
    ["admin-access", "/admin/access"],
    ["retired-import", "/my-timetable/import"],
    ["not-found", "/not-a-page"],
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    if (path !== "/login")
      await expect(page.getByRole("button", { name: /Switch to (Light|Dark) Mode/ })).toBeEnabled();
    for (const mode of ["light", "dark"]) {
      const target =
        mode === "light" ? "Switch to Light Mode" : "Switch to Dark Mode";
      if (path !== "/login") {
        if (await page.getByRole("button", { name: target, exact: true }).count())
          await page.getByRole("button", { name: target, exact: true }).click();
        await expect(page.locator("html")).toHaveClass(new RegExp(mode));
      } else {
        await expect(page.locator(".auth-card")).toHaveCSS("background-color", "rgb(255, 255, 255)");
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} ${mode} overflow`,
      ).toBe(true);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        `${path} ${mode} accessibility`,
      ).toEqual([]);
      await page.screenshot({
        path: `${dir}/${name}-${info.project.name}-${mode}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/my-timetable",
      "/onboarding",
      "/account",
      "/admin",
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} at ${width}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test("account previews stay temporary and SSO never pretends to authenticate", async ({
  page,
}) => {
  await page.goto("/pending-approval");
  await expect(page.locator(".onboard-steps .complete")).toHaveCount(0);
  await expect(
    page.getByText("Sharing policy has not been acknowledged", { exact: true }),
  ).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with KMITL SSO" })).toBeDisabled();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/onboarding");
  await page.getByLabel("Nickname", { exact: true }).fill("Fictional June");
  await page
    .getByRole("button", { name: "Continue to sharing policy" })
    .click();
  const continueButton = page.getByRole("button", {
    name: "Continue to access preview",
  });
  await expect(continueButton).toBeDisabled();
  await page.getByRole("checkbox").check();
  await continueButton.click();
  await expect(page.locator(".onboard-steps .complete")).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little pause",
  );
  await expect(page.getByText("No request has been submitted.")).toBeVisible();
  await page.goto("/account"); // A full navigation resets the deliberately temporary state.
  await expect(page.getByLabel("Nickname", { exact: true })).toHaveValue(
    "June",
  );
  await page.goto("/admin/access");
  await page.getByLabel("Access status for June").selectOption("Approved");
  await expect(page.getByRole("status")).toContainText(
    "No real access changed",
  );
  await page.reload();
  await expect(page.getByLabel("Access status for June")).toHaveValue(
    "Pending",
  );
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((k) => k !== "koonpinai-theme")).toEqual([]);
});
