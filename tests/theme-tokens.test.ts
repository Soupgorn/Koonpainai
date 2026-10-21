import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const styles = ["globals.css", "redesign.css"].map((file) => readFileSync(new URL(`../src/app/${file}`, import.meta.url), "utf8")).join("\n");
function tokens(selector: string) {
  const result: Record<string, string> = {};
  for (const block of styles.matchAll(new RegExp(`${selector.replace(".", "\\.")} \\{([^}]+)\\}`, "g")))
    for (const match of block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) result[match[1]] = match[2].trim();
  for (const key of Object.keys(result)) {
    const alias = result[key].match(/^var\(--([\w-]+)\)$/)?.[1];
    if (alias) result[key] = result[alias];
  }
  return result;
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
  test(`${selector} product status text and all six course identities meet AA contrast`, () => {
    const t = tokens(selector);
    const pairs = [
      ["link", "app-canvas"],
      ["muted-foreground", "app-canvas"],
      ["muted-foreground", "surface"],
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
      contrast(t["input-border"], t["app-canvas"]) >= 3,
      "Input outlines remain discernible",
    );
    assert.ok(
      contrast(t.focus, t["app-canvas"]) >= 3,
      "Keyboard focus remains discernible",
    );
  });
