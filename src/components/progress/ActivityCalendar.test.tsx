import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
});
