import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Live bug L7, 25 Nov 2026: the light background (#f5f6f2, a green-grey) was disliked. The app
// pages now sit on the neutral near-white the design tokens already define (--secondary,
// oklch(0.97 0 0)) with clearer card borders drawn from the text colour, and the dark theme is
// left as it was. No new colour is introduced: every value below is a token or a mix of tokens.
const css = readFileSync(join(__dirname, "app-theme.module.css"), "utf8");

// The declarations of the first rule whose selector is exactly `selector`, on one line.
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return "";
  return css
    .slice(start, css.indexOf("}", start))
    .replaceAll("\n", " ")
    .replaceAll("  ", " ");
}

const MIX = "color-mix(in oklab, var(--foreground)";

describe("the light theme of the signed-in pages", () => {
  const light = rule(".appTheme.appTheme");

  it("finds the rule", () => {
    expect(light).not.toBe("");
  });

  it("sits on the neutral near-white token, not the green-grey page colour", () => {
    expect(light).toContain("--background: var(--secondary);");
    expect(css).not.toMatch(/--background:\s*#f5f6f2/i);
  });

  it("draws card borders from the text colour, clearer than the old 15%", () => {
    expect(light).toContain(`--card-line: ${MIX} 24%, transparent);`);
    const override = css.slice(
      css.indexOf(".appTheme :global(.border-foreground"),
    );
    expect(override).toContain("border-color: var(--card-line);");
  });

  it("keeps the dark theme's own background and its old border strength", () => {
    const dark = rule('.appTheme.appTheme[data-theme="dark"]');
    expect(dark).toContain("--background: #0a0a0a;");
    expect(dark).toContain(`--card-line: ${MIX} 15%, transparent);`);
  });

  it("keeps the old border strength when the system is dark and the user did not choose", () => {
    const system = css.slice(
      css.indexOf("@media (prefers-color-scheme: dark)"),
    );
    expect(system.slice(0, system.indexOf("\n}"))).toContain(
      `--card-line: ${MIX} 15%, transparent);`,
    );
  });
});
