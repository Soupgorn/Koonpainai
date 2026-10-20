import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import { scanPdfFixture, textPdfFixture } from "../fixtures/pdf-fixtures";
import { scheduleExportSchema } from "../../src/lib/pdf/schema";

async function upload(page: Page, bytes: Uint8Array, drop = false) {
  if (drop) {
    const dataTransfer = await page.evaluateHandle(
      (data) => {
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([new Uint8Array(data)], "fictional-timetable.pdf", {
            type: "application/pdf",
          }),
        );
        return transfer;
      },
      [...bytes],
    );
    await page.locator(".dropzone").dispatchEvent("drop", { dataTransfer });
  } else
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: "fictional-timetable.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(bytes),
      });
}
async function capture(page: Page, name: string) {
  await mkdir(".impeccable/review", { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `.impeccable/review/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
async function completeMetadata(page: Page) {
  await page.getByLabel("Nickname", { exact: true }).fill("Fictional friend");
  await page.getByLabel("Semester starts", { exact: true }).fill("2026-08-03");
  await page.getByLabel("Semester ends", { exact: true }).fill("2026-12-13");
}

test("real embedded text extraction, editable review, private profile and canonical JSON export", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/import");
  await capture(page, `${info.project.name}-upload`);
  await upload(page, await textPdfFixture(), true);
  await page
    .getByRole("button", { name: "Read timetable", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your week deserves a second look." }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".extraction-summary")).toContainText(
    "Embedded PDF text",
  );
  await expect(page.locator(".class-editor")).toHaveCount(9);
  await expect(page.getByLabel("Nickname", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Semester starts", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("button", { name: "Preview schedule" }),
  ).toBeDisabled();
  await completeMetadata(page);
  await page
    .locator(".class-editor")
    .first()
    .getByLabel("Classroom", { exact: true })
    .fill("EDITED-305");
  await expect(
    page
      .locator(".class-editor")
      .first()
      .getByLabel("Classroom", { exact: true }),
  ).toHaveValue("EDITED-305");
  await expect(page.locator("details.class-editor").first()).toHaveAttribute(
    "open",
    "",
  );
  await page.getByRole("checkbox", { name: /I checked every session/ }).check();
  await expect(
    page.getByRole("button", { name: "Preview schedule" }),
  ).toBeEnabled();
  await expect(page.locator(".pdf-canvas-scroll canvas")).toBeVisible();
  await capture(page, `${info.project.name}-review`);
  const reviewA11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    reviewA11y.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Preview schedule" }).click();
  await capture(page, `${info.project.name}-publish`);
  await page
    .getByRole("button", { name: "Friend profile", exact: true })
    .click();
  await expect(page.locator(".imported-profile")).toContainText(
    "Fictional friend",
  );
  await expect(page.locator(".imported-profile")).not.toContainText(
    "Fictional friends",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download schedule JSON" }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(scheduleExportSchema.safeParse(exported).success).toBe(true);
  expect(exported.sessions).toHaveLength(9);
  expect(exported.sessions[0].room).toBe("EDITED-305");
  expect(
    exported.sessions
      .filter((session: { day: number }) => session.day === 5)
      .map((session: { start: string; end: string }) => [
        session.start,
        session.end,
      ]),
  ).toEqual([
    ["08:45", "10:15"],
    ["10:30", "12:00"],
  ]);
  expect(JSON.stringify(exported)).not.toContain("source");
  expect(JSON.stringify(exported)).not.toContain("lecturer");
  await expect(
    page.getByRole("status").filter({ hasText: "JSON download started" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("image-only Thai/English PDF actually runs local OCR with no external requests", async ({
  page,
}) => {
  const paths: string[] = [],
    external: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    paths.push(url.pathname);
    if (/^https?:/.test(url.protocol) && url.origin !== "http://localhost:3000")
      external.push(url.origin);
  });
  await page.goto("/admin/import");
  await upload(page, await scanPdfFixture({ thai: true }));
  await page
    .getByRole("button", { name: "Read timetable", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your week deserves a second look." }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".extraction-summary")).toContainText(
    "Thai + English OCR",
  );
  await expect(page.locator(".class-editor")).toHaveCount(9);
  await expect(
    page.locator(".class-editor").filter({ hasText: "08:45–10:15" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".class-editor").filter({ hasText: "10:30–12:00" }),
  ).toHaveCount(1);
  expect(paths.some((path) => path.endsWith("tha.traineddata.gz"))).toBe(true);
  expect(paths.some((path) => path.endsWith("eng.traineddata.gz"))).toBe(true);
  expect(external).toEqual([]);
});

test("mixed text and scanned pages are handled independently", async ({
  page,
}) => {
  await page.goto("/admin/import");
  await upload(page, await scanPdfFixture({ mixed: true }));
  await page
    .getByRole("button", { name: "Read timetable", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your week deserves a second look." }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".extraction-summary")).toContainText(
    "Page 1: Embedded PDF text",
  );
  await expect(page.locator(".extraction-summary")).toContainText(
    "Page 2: Thai + English OCR",
  );
  await expect(page.locator(".class-editor")).toHaveCount(9);
});

test("bad file validation, damaged PDF failure, replacement and cancellation", async ({
  page,
}) => {
  await page.goto("/admin/import");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "invalid.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("Not a PDF"),
    });
  await expect(page.locator(".form-error")).toContainText("valid PDF header");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "oversize.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(11 * 1024 * 1024),
    });
  await expect(page.locator(".form-error")).toContainText("10 MB limit");
  await upload(page, Buffer.from("%PDF-1.7\nThis is a damaged document"));
  await page
    .getByRole("button", { name: "Read timetable", exact: true })
    .click();
  await expect(page.locator(".form-error")).toContainText("could not be read", {
    timeout: 20_000,
  });
  await expect(
    page.getByRole("button", { name: "Try extraction again" }),
  ).toBeEnabled();
  await expect(page.locator(".review-editor")).toHaveCount(0);
  await page.getByRole("button", { name: "Replace PDF", exact: true }).click();
  await upload(page, await scanPdfFixture());
  await page
    .getByRole("button", { name: "Read timetable", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel processing" }).click();
  await expect(page.locator(".form-error")).toContainText("cancelled");
  await expect(page.locator(".review-editor")).toHaveCount(0);
  await page.getByRole("button", { name: "Replace PDF", exact: true }).click();
  await page.getByRole("button", { name: "Remove selected PDF" }).click();
  await expect(
    page.getByRole("button", { name: "Read timetable", exact: true }),
  ).toBeDisabled();
});
