import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

function withFlags(
  values: Record<string, string | undefined>,
  check: () => void,
) {
  const before = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    check();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
const response = (path: string) =>
  proxy(new NextRequest(`http://localhost${path}`));
test("production preview routes return 404 before rendering when no switches are enabled", () => {
  withFlags(
    {
      NODE_ENV: "production",
      ENABLE_ADMIN_DEMO: undefined,
      ENABLE_UI_PREVIEW: undefined,
    },
    () => {
      for (const path of [
        "/admin",
        "/admin/import",
        "/admin/access",
        "/onboarding",
        "/onboarding/policy",
        "/pending-approval",
        "/my-timetable",
        "/my-timetable/import",
        "/account",
      ]) {
        assert.equal(response(path).status, 404, path);
        assert.ok(
          response(path)
            .headers.get("x-middleware-rewrite")
            ?.endsWith("/_not-found"),
        );
      }
    },
  );
});
test("UI and administrator preview switches remain independent", () => {
  withFlags(
    {
      NODE_ENV: "production",
      ENABLE_ADMIN_DEMO: "false",
      ENABLE_UI_PREVIEW: "true",
    },
    () => {
      assert.equal(response("/my-timetable").status, 200);
      assert.equal(response("/admin").status, 404);
    },
  );
  withFlags(
    {
      NODE_ENV: "production",
      ENABLE_ADMIN_DEMO: "true",
      ENABLE_UI_PREVIEW: "false",
    },
    () => {
      assert.equal(response("/admin/import").status, 200);
      assert.equal(response("/account").status, 404);
    },
  );
});
test("development exposes clearly labeled preview interfaces without granting real access", () => {
  withFlags(
    {
      NODE_ENV: "development",
      ENABLE_ADMIN_DEMO: undefined,
      ENABLE_UI_PREVIEW: undefined,
    },
    () => {
      assert.equal(response("/admin").status, 200);
      assert.equal(response("/onboarding").status, 200);
    },
  );
});
