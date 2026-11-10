// Markup test for the "Why this plan" panel (#66): heading, list semantics, and that the
// meaning is in the words, not in colour.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WhyRow } from "@/lib/coach/whyThisPlan";
import WhyThisPlan from "./WhyThisPlan";

const DETAIL_COUNT = 2;

const rows: WhyRow[] = [
  {
    id: "source",
    title: "Source",
    summary: "Written by the coach (groq).",
    details: [],
  },
  {
    id: "checks",
    title: "Checks passed",
    summary: "This plan was checked before you saw it.",
    details: [
      "Equipment matches what you have.",
      "No exercise repeats on the same day.",
    ],
  },
];

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("WhyThisPlan", () => {
  it("renders a named section with one subheading per row", () => {
    const html = renderToStaticMarkup(<WhyThisPlan rows={rows} />);

    expect(html).toContain("<section");
    expect(html).toContain("Why this plan</h2>");
    expect(html).toContain("Source</h3>");
    expect(html).toContain("Checks passed</h3>");
  });

  it("renders each detail as a list item and omits the list for a row with none", () => {
    const html = renderToStaticMarkup(<WhyThisPlan rows={rows} />);

    expect(count(html, "<li")).toBe(DETAIL_COUNT);
    expect(count(html, "<ul")).toBe(1);
    expect(html).toContain("Equipment matches what you have.");
  });

  it("labels the section by the id of its heading", () => {
    const html = renderToStaticMarkup(<WhyThisPlan rows={rows} />);

    const marker = 'aria-labelledby="';
    const start = html.indexOf(marker) + marker.length;
    const id = html.slice(start, html.indexOf('"', start));
    expect(id).not.toBe("");
    expect(html).toContain(`id="${id}"`);
  });

  it("renders nothing when there are no rows", () => {
    expect(renderToStaticMarkup(<WhyThisPlan rows={[]} />)).toBe("");
  });
});
