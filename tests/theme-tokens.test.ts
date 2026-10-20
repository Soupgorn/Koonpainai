import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(
  new URL("../src/app/redesign.css", import.meta.url),
  "utf8",
);
function tokens(selector: string) {
  const block =
    css.match(
      new RegExp(`${selector.replace(".", "\\.")} \\{([^}]+)\\}`),
    )?.[1] || "";
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}
function luminance(hex: string) {
  const c = hex
    .slice(1)
    .match(/../g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
for (const selector of [":root", ".dark"])
  test(`${selector} text and all six course identities meet AA contrast`, () => {
    const t = tokens(selector);
    const pairs = [
      ["foreground", "background"],
      ["foreground", "card"],
      ["muted", "background"],
      ["muted", "card"],
      ["muted", "surface"],
      ["primary", "card"],
      ["primary-foreground", "primary"],
      ["free", "free-bg"],
      ["class", "class-bg"],
      ["danger", "danger-bg"],
      ["danger-hover", "danger-bg"],
      ...Array.from({ length: 6 }, (_, i) => [
        `course-${i}-text`,
        `course-${i}-bg`,
      ]),
    ];
    for (const [fg, bg] of pairs)
      assert.ok(
        contrast(t[fg], t[bg]) >= 4.5,
        `${fg}/${bg}: ${contrast(t[fg], t[bg]).toFixed(2)}`,
      );
    assert.ok(
      contrast(t["input-border"], t.card) >= 3,
      "Input outlines remain discernible",
    );
    assert.ok(
      contrast(t.focus, t.card) >= 3,
      "Keyboard focus remains discernible",
    );
  });
