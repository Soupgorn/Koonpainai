import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { readAuthSettings } from "../../src/lib/auth/settings";
import { createMemberRepository } from "../../src/db/member-repository";
import { members } from "../../src/db/schema";
import {
  KMITL_ISSUER,
  POLICY_VERSION,
  SESSION_SECONDS,
} from "../../src/lib/auth/domain";
loadEnvConfig(process.cwd());
const settings = readAuthSettings();
test.skip(
  !settings,
  "Configure the ignored local approved client and database first",
);

test("anonymous access fails closed; login preserves both themes and keyboard accessibility", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/friends/bean",
    "/my-timetable",
    "/my-timetable/import",
    "/admin",
    "/admin/import",
    "/admin/access",
    "/account",
    "/onboarding",
    "/onboarding/policy",
    "/pending-approval",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator(".friend-card")).toHaveCount(0);
  }
  for (const mode of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: mode });
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(mode));
    const sso = page.getByRole("button", { name: "Continue with KMITL SSO" });
    await expect(sso).toBeEnabled();
    await sso.focus();
    expect(await sso.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
      "solid",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  const bad = await page.request.get("/api/auth/providers", {
    headers: { "x-forwarded-host": "untrusted.example" },
  });
  expect(bad.status()).toBe(400);
});

test("synthesized session + real PostgreSQL: onboarding, approval, policy, profile and local logout", async ({
  page,
  context,
}, info) => {
  // This verifies our application after authentication, not live KMITL login.
  // The test harness alone can issue this cookie using the ignored local secret.
  const pool = new Pool({
    connectionString: settings!.databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool),
    repository = createMemberRepository(db);
  const subject = "browser-fixture-" + randomUUID(),
    sid = randomUUID();
  let id: string | undefined;
  let guestId: string | undefined;
  const guestSubject = "browser-fixture-" + randomUUID();
  try {
    const deadline = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const member = await repository.login(
      {
        issuer: KMITL_ISSUER,
        subject,
        displayName: "Fictional Browser Student",
        email: null,
      },
      sid,
      new Date(deadline * 1000),
    );
    id = member.id;
    const name = "authjs.session-token";
    const cookie = await encode({
      secret: settings!.secret,
      salt: name,
      maxAge: SESSION_SECONDS,
      token: {
        sub: id,
        userId: id,
        sid,
        deadline,
        oidcIssuer: KMITL_ISSUER,
        oidcSubject: subject,
        name: "Fictional Browser Student",
      },
    });
    const saved = {
      name,
      value: cookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    };
    await context.addCookies([saved]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("Nickname", { exact: true }).fill("Fictional Mali");
    await page.getByLabel("Thai name", { exact: false }).fill("มะลิ");
    await page
      .getByLabel("Programme", { exact: true })
      .fill("Computer Engineering");
    await page
      .getByRole("button", { name: "Continue to sharing policy" })
      .click();
    await expect(page).toHaveURL(/\/onboarding\/policy$/);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Acknowledge and continue" })
      .click();
    await expect(page).toHaveURL(/\/pending-approval$/);
    const stored = await repository.find(id);
    expect(stored?.nickname).toBe("Fictional Mali");
    expect(stored?.policyVersion).toBe(POLICY_VERSION);
    expect(stored?.status).toBe("pending");
    await page.goto("/friends/bean");
    await expect(page).toHaveURL(/\/pending-approval$/);
    await page.goto("/account");
    for (const mode of ["Light", "Dark"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await mkdir(".impeccable/review/oidc", { recursive: true });
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `.impeccable/review/oidc/account-${info.project.name}-${mode.toLowerCase()}.png`,
        fullPage: true,
      });
    }
    await page.getByLabel("Nickname", { exact: true }).fill("Fictional May");
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("has been saved");
    await page.reload();
    await expect(page.getByLabel("Nickname", { exact: true })).toHaveValue(
      "Fictional May",
    );
    // Alter only this disposable test member. Authorization is re-read on navigation.
    await db
      .update(members)
      .set({ status: "approved" })
      .where(eq(members.id, id));
    await page.goto("/my-timetable");
    await expect(
      page.getByText("No import has been added yet.", { exact: false }),
    ).toBeVisible();
    await expect(page.locator(".timetable-event, .agenda-event")).toHaveCount(
      0,
    );
    await page.goto("/friends/bean");
    await expect(
      page.locator(".desktop-timetable:visible, .mobile-timetable:visible"),
    ).toBeVisible();
    await page.goto("/admin/access");
    await expect(
      page.getByRole("heading", { name: "A little off the timetable." }),
    ).toBeVisible();
    // Only disposable harness accounts receive a temporary test admin role.
    await db.update(members).set({ role: "admin" }).where(eq(members.id, id));
    const guest = await repository.login(
      {
        issuer: KMITL_ISSUER,
        subject: guestSubject,
        displayName: "Fictional Access Guest",
        email: null,
      },
      randomUUID(),
      new Date(Date.now() + 60000),
    );
    guestId = guest.id;
    await page.goto("/admin/access");
    const row = page.getByRole("form", {
      name: "Manage access for Fictional Access Guest",
      exact: true,
    });
    for (const label of ["Light", "Dark"]) {
      await page.getByRole("button", { name: "Theme preferences" }).click();
      await page.getByRole("radio", { name: label, exact: true }).check();
      await page.keyboard.press("Escape");
      expect(
        (
          await new AxeBuilder({ page })
            .include(".member-access-row")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await row.screenshot({
        path: `.impeccable/review/oidc/access-row-${info.project.name}-${label.toLowerCase()}.png`,
      });
    }
    await expect(
      page
        .getByRole("form", {
          name: "Manage access for Fictional May",
          exact: true,
        })
        .getByRole("button", { name: "Update access" }),
    ).toBeDisabled();
    for (const status of ["approved", "suspended"]) {
      await row.getByRole("combobox").selectOption(status);
      await row.getByRole("button", { name: "Update access" }).click();
      await expect(
        row.getByText(`member · ${status}`, { exact: true }),
      ).toBeVisible();
      expect((await repository.find(guestId))?.status).toBe(status);
    }
    await db
      .update(members)
      .set({ policyVersion: "obsolete" })
      .where(eq(members.id, id));
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding\/policy$/);
    await db
      .update(members)
      .set({ status: "suspended", policyVersion: POLICY_VERSION })
      .where(eq(members.id, id));
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Your access is paused." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out of Koonpinai" }).click();
    await expect(page).toHaveURL(/\/login\?signedOut=local$/);
    expect(await repository.activeSession(sid)).toBeNull();
    await context.addCookies([saved]);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    if (guestId)
      await db
        .delete(members)
        .where(and(eq(members.id, guestId), eq(members.subject, guestSubject)));
    if (id)
      await db
        .delete(members)
        .where(and(eq(members.id, id), eq(members.subject, subject)));
    await pool.end();
  }
});
