import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Audit B5, 25 Nov 2026: Sign out was invisible in light mode on every page except
// Account. The rule used var(--muted); the global shadcn theme defines --muted as a
// near-white background, and the account tokens (--text, --line) exist only inside the
// account theme. Outside it, each token must fall back to the app's own foreground.
const css = readFileSync(join(__dirname, "account.module.css"), "utf8");
const start = css.indexOf(".signOutButton {");
// Prettier may wrap a long declaration, so the rule is compared on one line.
const button = css
  .slice(start, css.indexOf("}", start))
  .replaceAll("\n", " ")
  .replaceAll("    ", "");

describe("the Sign out button styles outside the account theme", () => {
  it("finds the rule", () => {
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it("does not take its text colour from the global --muted background token", () => {
    expect(button).not.toContain("color: var(--muted");
  });

  it("colours its text from an account token with the global foreground as fallback", () => {
    expect(button).toContain("color: var(--text, var(--foreground));");
  });

  it("draws its border with a fallback that is visible without the account theme", () => {
    expect(button).toContain("border: 1px solid var(--line, color-mix(");
  });
});
