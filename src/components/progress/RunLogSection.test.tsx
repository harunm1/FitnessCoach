import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/progress/run/actions", () => ({ logRun: vi.fn() }));
import RunLogSection from "./RunLogSection";
import type { RecentRun } from "@/lib/progress/loadRuns";

const TODAY = "2026-11-24";
const runs: RecentRun[] = [
  {
    id: 2,
    day: "2026-11-23",
    distanceKm: 5.2,
    time: "31:12",
    pace: "6:00 /km",
    effort: 6,
    note: "Easy loop",
    planDayName: "Easy run",
  },
  {
    id: 1,
    day: "2026-11-20",
    distanceKm: 3,
    time: "20:00",
    pace: "6:40 /km",
    effort: null,
    note: null,
    planDayName: null,
  },
];

const render = (list = runs) =>
  renderToStaticMarkup(<RunLogSection runs={list} today={TODAY} />);

describe("RunLogSection", () => {
  it("offers the form: day, distance, h:mm:ss time, effort 1 to 10 and a note", () => {
    const html = render([]);
    expect(html).toContain("Log a run");
    expect(html).toContain('type="date"');
    expect(html).toContain(`value="${TODAY}"`);
    expect(html).toContain(`max="${TODAY}"`);
    expect(html).toContain('name="distanceKm"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('name="duration"');
    expect(html).toContain('placeholder="0:32:15"');
    expect(html).toContain('name="effort"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="10"');
    expect(html).toContain('name="note"');
    expect(html).toContain('maxLength="300"');
    expect(html).toContain("Save run");
    expect(html).toContain("No runs logged yet.");
  });

  it("lists the latest runs with distance, time, pace, effort and plan day", () => {
    const html = render();
    expect(html).toContain("5.2 km");
    expect(html).toContain("31:12");
    expect(html).toContain("6:00 /km");
    expect(html).toContain("effort 6/10");
    expect(html).toContain("Nov 23, 2026");
    expect(html).toContain("Easy run");
    expect(html).toContain("Easy loop");
    expect(html).toContain("3 km");
    expect(html).not.toContain("No runs logged yet.");
    expect(html.indexOf("5.2 km")).toBeLessThan(html.indexOf("3 km"));
  });
});
