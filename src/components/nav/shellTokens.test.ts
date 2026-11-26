import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// D41: the shell's accent and text tokens must reach WCAG 2.2 1.4.3 (4.5:1) on
// the colours they sit on, in the light and the dark theme.
const css = readFileSync(
  join(__dirname, "..", "auth", "account.module.css"),
  "utf8",
);

// The declarations inside the first rule that starts with `selector {`.
function tokens(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} rule`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [
      m[1],
      m[2],
    ]),
  );
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  [".themeRoot", "light"],
  ['.themeRoot[data-theme="dark"]', "dark"],
])("%s (%s) shell colours", (selector) => {
  const t = tokens(selector);

  it("defines the one accent and its soft tint", () => {
    expect(t.brand).toBeDefined();
    expect(t["brand-soft"]).toBeDefined();
    expect(t["on-brand"]).toBeDefined();
  });

  it.each([
    ["brand", "page"],
    ["brand", "surface"],
    ["brand", "subtle"],
    ["brand", "brand-soft"],
    ["text", "page"],
    ["text", "subtle"],
    ["shell-muted", "page"],
    ["shell-muted", "subtle"],
    ["shell-muted", "inset"],
    ["on-brand", "brand"],
  ])("%s text on %s is at least 4.5:1", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

it("repeats the dark tokens for the system theme", () => {
  const dark = tokens('.themeRoot[data-theme="dark"]');
  const start = css.indexOf('.themeRoot[data-theme="system"] {');
  const body = css.slice(start, css.indexOf("}", start));
  for (const key of ["brand", "brand-soft", "on-brand", "shell-muted"]) {
    expect(body).toContain(`--${key}: ${dark[key]}`);
  }
});

describe("shell type sizes (D41)", () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter(
    (f) => /\.tsx?$/.test(f) && !f.includes(".test."),
  );

  it("finds the shell files", () => {
    expect(files).toContain("AppNav.tsx");
  });

  it.each(files)("%s uses nothing smaller than 14px", (file) => {
    const source = readFileSync(join(dir, file), "utf8");
    expect(source).not.toMatch(/\btext-xs\b/);
    expect(source).not.toMatch(/text-\[(1[0-3])px\]/);
  });

  // app-theme.module.css redefines --muted, --primary and --accent as backgrounds
  // on every page, so text in the shell must use the shell's own tokens.
  it.each(files)("%s does not use the page-theme colour names", (file) => {
    const source = readFileSync(join(dir, file), "utf8");
    expect(source).not.toMatch(/var\(--(muted|primary|accent)\b/);
  });
});
