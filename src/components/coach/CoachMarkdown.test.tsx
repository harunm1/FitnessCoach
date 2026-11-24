// Tests for rendering the coach's Markdown reply safely (live bug 23 Nov: raw asterisks and table pipes).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CoachMarkdown from "./CoachMarkdown";

const html = (text: string) =>
  renderToStaticMarkup(<CoachMarkdown text={text} />);

describe("CoachMarkdown", () => {
  it("turns bold and list markers into elements, with no asterisks left", () => {
    const out = html(
      "**Form first**\n\n* Brace your core\n* Hinge at the hips",
    );
    expect(out).toContain("<strong>Form first</strong>");
    expect(out).toContain("<li>Brace your core</li>");
    expect(out).not.toContain("*");
  });

  it("renders a table as a table, not as pipes", () => {
    const out = html("| Exercise | Sets |\n| --- | --- |\n| RDL | 3 x 8 |");
    expect(out).toContain("<table");
    expect(out).toContain("<th>Exercise</th>");
    expect(out).toContain("<td>3 x 8</td>");
    expect(out).not.toContain("|");
  });

  it("does not pass raw HTML through", () => {
    const out = html(
      '<script>alert(1)</script><img src=x onerror="alert(1)">hi',
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    // Shown as inert text, not run: the angle brackets are escaped.
    expect(out).toContain("&lt;script&gt;");
  });

  it("does not make javascript: links clickable", () => {
    const out = html("[tap](javascript:alert(1))");
    expect(out).not.toContain("javascript:");
  });

  it("keeps a single line break inside a paragraph visible", () => {
    const out = html(
      ["Warm up first.", "Set 1: 8 reps"].join(String.fromCharCode(10)),
    );
    expect(out).toContain("whitespace-pre-line");
    expect(out).toContain(
      "Warm up first." + String.fromCharCode(10) + "Set 1: 8 reps",
    );
  });

  it("does not load images from a reply", () => {
    const out = html("![x](https://evil.example/p.png)");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("evil.example/p.png");
  });

  it("opens links in a new tab without handing over the opener", () => {
    const out = html("[docs](https://example.com/a)");
    expect(out).toContain('target="_blank"');
    expect(out).toContain("noopener");
    expect(out).not.toContain("node=");
  });
});
