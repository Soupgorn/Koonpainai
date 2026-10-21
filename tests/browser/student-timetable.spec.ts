import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

test("personal class editor adds, reviews overlap, edits and deletes with clear preview boundaries", async ({ page }, info) => {
  await page.goto("/my-timetable");
  await expect(page.getByRole("heading", { name: "My Timetable", exact: true })).toBeVisible();
  await expect(page.getByText(/Fictional sample schedule/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh timetable" })).toHaveCount(0);
  const add = async (name: string, start: string, end: string) => {
    await page.getByRole("button", { name: "Add class", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Course name", { exact: true }).fill(name);
    await dialog.getByLabel("Weekday").selectOption("0");
    await dialog.getByLabel("Start time").fill(start);
    await dialog.getByLabel("End time").fill(end);
    return dialog;
  };
  let dialog = await add("Studio seminar", "07:15", "08:45");
  await dialog.getByRole("button", { name: "Add class", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Class added" })).toContainText("reset on reload");
  const mobile = info.project.name === "mobile";
  if (mobile) await page.getByRole("button", { name: "Sun", exact: true }).click();
  const event = () => page.locator(mobile ? ".agenda-event" : ".timetable-event").filter({ hasText: "Studio seminar" });
  await event().click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit class" })).toBeVisible();
  await dialog.getByLabel("Classroom / location").fill("E-204");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(event()).toContainText("E-204");
  dialog = await add("Project discussion", "08:00", "09:00");
  await expect(dialog.getByText(/Overlaps Studio seminar/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add class", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("allow the overlap");
  await dialog.getByRole("checkbox", { name: "Keep this overlap in my timetable" }).check();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await mkdir("output/database-first", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(t => { document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(t); document.documentElement.style.colorScheme = t; }, theme);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter(v => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `output/database-first/${info.project.name}-editor-${theme}.png` });
  }
  await dialog.getByRole("button", { name: "Add class", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await mkdir("output/database-first", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(t => { document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(t); }, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/database-first/${info.project.name}-${theme}.png`, fullPage: true });
  }
  await event().click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delete this class?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep class" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete class", exact: true }).click();
  await expect(event()).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Project discussion", { exact: true })).toHaveCount(0);
  await page.goto("/account");
  await expect(page.getByRole("link", { name: "Manage my timetable" })).toBeVisible();
  await expect(page.getByText(/API permission/)).toHaveCount(0);
});

test("semester dates validate and retired PDF URLs remain absent", async ({ page }) => {
  await page.goto("/my-timetable");
  await page.getByRole("button", { name: "Edit semester" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Semester name").fill("Semester 2 / 2569");
  await dialog.getByLabel("Start date").fill("2027-01-01");
  await dialog.getByLabel("End date").fill("2027-04-30");
  await dialog.getByRole("button", { name: "Save semester" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(/Semester 2 \/ 2569 · 2027-01-01/)).toBeVisible();
  for (const path of ["/my-timetable/import", "/admin/import"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  }
});
