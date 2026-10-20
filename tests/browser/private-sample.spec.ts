import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ trace: "off", screenshot: "off", video: "off" });
test("optional local KMITL sample exercises OCR without storing personal fixtures", async ({
  page,
}) => {
  test.skip(
    !process.env.KOONPINAI_TEST_PDF,
    "Set KOONPINAI_TEST_PDF to a local private document; never commit it.",
  );
  await page.goto("/admin/import");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "local-timetable.pdf",
      mimeType: "application/pdf",
      buffer: await readFile(process.env.KOONPINAI_TEST_PDF!),
    });
  await page
    .getByRole("button", { name: "Read timetable", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your week deserves a second look." }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".extraction-summary")).toContainText(
    "Page 1: Thai + English OCR",
  );
  await expect(page.locator(".extraction-summary")).toContainText(
    "Page 2: Thai + English OCR",
  );
  await expect(page.locator(".class-editor")).toHaveCount(9);
  await expect(
    page.locator(".class-editor").filter({ hasText: "08:45–10:15" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".class-editor").filter({ hasText: "10:30–12:00" }),
  ).toHaveCount(1);
  // No screenshots, traces, exported JSON or copies of the source document.
});
