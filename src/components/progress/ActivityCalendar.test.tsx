import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

// Link as a plain anchor that shows the scroll prop, so the test can see whether a click
// is allowed to move the page.
vi.mock("next/link", () => ({
  default: ({
    scroll,
    ...props
  }: ComponentProps<"a"> & { scroll?: boolean }) => (
    <a data-scroll={String(scroll ?? true)} {...props} />
  ),
}));

import ActivityCalendar from "./ActivityCalendar";

const weeks = [
  [
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08",
  ],
];

describe("ActivityCalendar", () => {
  it("renders readable weekday labels and larger day targets", () => {
    const html = renderToStaticMarkup(
      <ActivityCalendar
        month="2026-11"
        weeks={weeks}
        activity={{}}
        today="2026-11-23"
        hrefFor={() => "/progress"}
        previousMonth="2026-10"
        nextMonth="2026-12"
      />,
    );

    expect(html).toContain(">Mon</abbr>");
    expect(html).toContain(">Wed</abbr>");
    expect(html).toContain("min-h-12");
    expect(html).toContain("text-base font-medium");
  });

  // Live bug L3, 25 Nov 2026: picking a date scrolled the whole page to the calendar and the
  // workout panel. The day link carried "#day-title" and Link's default scroll moved the page.
  describe("picking a day (live bug L3)", () => {
    const html = renderToStaticMarkup(
      <ActivityCalendar
        month="2026-11"
        weeks={weeks}
        activity={{ "2026-11-03": { workouts: 1, hasRun: false } }}
        today="2026-11-23"
        selectedDay="2026-11-03"
        hrefFor={({ month, day }) => `/progress?month=${month}&day=${day}`}
        previousMonth="2026-10"
        nextMonth="2026-12"
      />,
    );
    const dayLinks = [
      ...html.matchAll(/<a [^>]*aria-label="[A-Z][a-z]+day,[^>]*>/g),
    ];

    it("renders a link for every day", () => {
      expect(dayLinks).toHaveLength(7);
    });

    it("links to the day with no fragment, so the browser has nothing to jump to", () => {
      dayLinks.forEach(([tag]) => expect(tag).not.toContain("#"));
      expect(dayLinks[1][0]).toContain(
        'href="/progress?month=2026-11&amp;day=2026-11-03"',
      );
    });

    it("tells the router not to scroll, so the panel updates in place", () => {
      dayLinks.forEach(([tag]) => expect(tag).toContain('data-scroll="false"'));
    });

    it("still marks the selected day for keyboard and screen reader users", () => {
      expect(dayLinks[1][0]).toContain('aria-current="date"');
    });
  });
});
