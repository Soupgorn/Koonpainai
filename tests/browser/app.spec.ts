import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
const captureDir = ".impeccable/review";
async function capture(page: Page, name: string) {
  await mkdir(captureDir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `${captureDir}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("friends directory: live states, Thai search, empty results, filters and layout", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-10-20T10:30:00+07:00") });
  await page.goto("/");
  await expect(page.locator(".friend-card")).toHaveCount(12);
  await capture(page, `${info.project.name}-live`);

  await page.getByRole("button", { name: "In class", exact: false }).click();
  await expect(page.locator(".friend-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Free now", exact: false }).click();
  await expect(page.locator(".friend-card")).toHaveCount(5);
  await page.getByRole("button", { name: "Everyone", exact: false }).click();
  await page
    .getByRole("textbox", { name: "Search friends by nickname" })
    .fill("มายด์");
  await expect(page.locator(".friend-card")).toHaveCount(1);
  await expect(page.locator(".friend-card")).toContainText("Mild");
  await page
    .getByRole("textbox", { name: "Search friends by nickname" })
    .fill("nobody-here");
  await expect(
    page.getByRole("heading", { name: /No friends matching/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show everyone" }).click();
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page.locator(".friend-list")).toBeVisible();
    await page.getByRole("button", { name: "Grid view" }).click();
    await expect(page.locator(".directory-groups")).toBeVisible();
  }
  await capture(page, info.project.name);
  await noOverflow(page);
  await expect(page.locator(".date-display strong")).toContainText("10:30");
  await expect(page.getByRole("button", { name: "Try a class-time preview" })).toHaveCount(0);
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("profile has accurate status, accessible class details, responsive timetable and empty days", async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date("2026-10-20T10:30:00+07:00") });
  await page.goto("/");
  await page.locator('a[href="/friends/bean"]').click();
  await expect(
    page.getByRole("heading", { name: "In Discrete Mathematics" }),
  ).toBeVisible();
  await noOverflow(page);
  await capture(page, `${info.project.name}-profile`);
  if (info.project.name === "desktop")
    await page
      .getByRole("button", { name: /Discrete Mathematics, Tuesday/ })
      .click();
  else {
    await page.getByRole("button", { name: "Tue", exact: true }).click();
    await page.locator(".agenda-event").first().click();
  }
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("ECC 704");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Sun", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "No classes on Sunday." }),
    ).toBeVisible();
  }
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page.goto("/friends/peak");
  await expect(
    page.getByRole("heading", { name: "No timetable yet" }),
  ).toBeVisible();
  await page.goto("/friends/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "A little off the timetable." }),
  ).toBeVisible();
});
test("admin edits, adds and removes friends only in its temporary demo", async ({
  page,
}, info) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("main").getByText("Admin demo", { exact: true }),
  ).toBeVisible();
  await capture(page, `${info.project.name}-admin`);
  await noOverflow(page);
  await page.getByRole("button", { name: "Edit Bean", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Nickname", exact: true })
    .fill("Bean edited");
  await page.getByRole("button", { name: "Save demo changes" }).click();
  await expect(page.getByRole("status")).toContainText("Friend saved");
  await expect(
    page.getByRole("row").filter({ hasText: "Bean edited" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add friend", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Nickname", exact: true })
    .fill("Demo friend");
  await page.getByRole("button", { name: "Save demo changes" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Demo friend" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Demo friend", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove from demo", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Demo friend" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Bean edited" }),
  ).toHaveCount(0);
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
});
test("narrow phone and tablet layouts remain inside the viewport", async ({
  page,
}) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/friends/oak", "/admin", "/admin/import"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noOverflow(page);
      if (width === 768 && route === "/friends/oak")
        await capture(page, "tablet-profile");
    }
  }
});

test("live availability updates across a class boundary without reloading", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T08:59:50+07:00") });
  await page.goto("/");
  const bean = page.locator('a[href="/friends/bean"]');
  await expect(bean.locator(".status-badge")).toHaveText("Class soon");
  await page.clock.fastForward(15_000);
  await expect(bean.locator(".status-badge")).toHaveText("In class");
  await expect(bean).toContainText("Discrete Mathematics");
  await page.clock.fastForward(3 * 60 * 60_000);
  await expect(bean.locator(".status-badge")).toHaveText("Class soon");
  await expect(bean).toContainText("Free until 13:00");
});

test("outside semester dates never show active miniature timetable strips", async ({
  page,
}, info) => {
  await page.clock.install({ time: new Date("2027-01-04T10:30:00+07:00") });
  await page.goto("/");
  await expect(page.locator(".friend-card")).toHaveCount(12);
  await expect(page.locator(".status-out-of-term")).toHaveCount(11);
  await expect(page.locator(".day-ribbon")).toHaveCount(0);
  await expect(page.locator(".ribbon-ongoing")).toHaveCount(0);
  await noOverflow(page);
  await capture(page, `${info.project.name}-out-of-term`);
});
