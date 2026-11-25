import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/progress/weight/actions", () => ({ logBodyWeight: vi.fn() }));
import BodyWeightSection from "./BodyWeightSection";

const TODAY = "2026-11-24";
const entries = [
  { date: "2026-10-01", weightKg: 82, note: null },
  { date: "2026-11-01", weightKg: 81.2, note: "After the trip" },
  { date: "2026-11-24", weightKg: 80.4, note: null },
];

const render = (list = entries) =>
  renderToStaticMarkup(<BodyWeightSection entries={list} today={TODAY} />);

describe("BodyWeightSection", () => {
  it("offers the form with today's date, a kg field and a note", () => {
    const html = render([]);
    expect(html).toContain("Body weight");
    expect(html).toContain('type="date"');
    expect(html).toContain(`value="${TODAY}"`);
    expect(html).toContain(`max="${TODAY}"`);
    expect(html).toContain('name="weightKg"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('name="note"');
    expect(html).toContain('maxLength="300"');
    expect(html).toContain("Save weight");
  });

  it("invites a first weigh-in when there are none, with no chart", () => {
    const html = render([]);
    expect(html).toContain("No weigh-ins yet.");
    expect(html).not.toContain("<svg");
  });

  it("summarises the latest weight and the change in words", () => {
    const html = render();
    expect(html).toContain("80.4 kg");
    expect(html).toMatch(/1\.6 kg less than on Oct 1, 2026/);
  });

  it("says more, not less, when the weight went up", () => {
    const html = render([
      { date: "2026-11-01", weightKg: 80, note: null },
      { date: "2026-11-24", weightKg: 80.5, note: null },
    ]);
    expect(html).toMatch(/0\.5 kg more than on Nov 1, 2026/);
  });

  it("draws one dot per weigh-in and labels the chart for screen readers", () => {
    const html = render();
    expect(html.match(/<circle/g)).toHaveLength(3);
    expect(html).toContain('role="img"');
    expect(html).toMatch(
      /aria-label="Body weight from Oct 1, 2026 to Nov 24, 2026: 82 kg to 80\.4 kg"/,
    );
  });

  it("captions the chart with the user's own lightest and heaviest weights", () => {
    const html = render();
    expect(html).toContain("Lightest 80.4 kg, heaviest 82 kg");
  });

  it("keeps a live region for success and one for errors in the page from the start", () => {
    const html = render([]);
    expect(html).toContain('role="status"');
    expect(html).toContain('role="alert"');
  });

  it("lists the latest weigh-ins with their notes, newest first", () => {
    const html = render();
    const list = html.slice(html.indexOf("<ol"));
    expect(list.indexOf("80.4 kg")).toBeLessThan(list.indexOf("81.2 kg"));
    expect(list).toContain("After the trip");
  });
});
