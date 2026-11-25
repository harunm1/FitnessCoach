// @vitest-environment jsdom
// Tests for the import preview and result panels (#131, live feedback 24 Nov item 8).
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ImportPreview, ImportResultPanel } from "./ImportPreview";

const summary = {
  workouts: 3,
  newWorkouts: 2,
  sets: 40,
  firstDay: "2024-06-20",
  lastDay: "2024-07-01",
  skippedWarmups: 4,
  skippedRows: 1,
};
const library = [
  { id: "carry", name: "Farmers Walk" },
  { id: "bench", name: "Barbell Bench Press - Medium Grip" },
];

describe("ImportPreview", () => {
  it("shows the counts, the dates and the new workouts", () => {
    const html = renderToStaticMarkup(
      <ImportPreview summary={summary} unmatched={[]} library={library} />,
    );
    expect(html).toContain("3 workouts");
    expect(html).toContain("40 sets");
    expect(html).toContain("2024-06-20");
    expect(html).toContain("2 are new");
    expect(html).toContain("4 warm-up sets");
    expect(html).toContain('value="save"');
  });

  it("offers a select with a skip option for each unmatched name", () => {
    const html = renderToStaticMarkup(
      <ImportPreview
        summary={summary}
        unmatched={["Zercher Carry"]}
        library={library}
      />,
    );
    expect(html).toContain('name="title_0"');
    expect(html).toContain('value="Zercher Carry"');
    expect(html).toContain('name="map_0"');
    expect(html).toContain("Skip these sets");
    expect(html).toContain("Farmers Walk");
  });

  it("says how many unmatched names are not shown", () => {
    const html = renderToStaticMarkup(
      <ImportPreview
        summary={summary}
        unmatched={["A"]}
        moreUnmatched={5}
        library={library}
      />,
    );
    expect(html).toContain("5 more names are not shown");
  });

  it("disables the save button when nothing is new and nothing can be mapped", () => {
    const html = renderToStaticMarkup(
      <ImportPreview
        summary={{ ...summary, newWorkouts: 0 }}
        unmatched={[]}
        library={library}
      />,
    );
    expect(html).toContain("already imported");
    expect(html).toMatch(/<button[^>]*disabled/);
  });
});

describe("ImportResultPanel", () => {
  it("says what was saved and links to Progress", () => {
    const html = renderToStaticMarkup(
      <ImportResultPanel
        result={{ imported: 2, alreadyImported: 1, sets: 30, skippedSets: 3 }}
        report={{
          skippedWarmups: 0,
          skippedTimedSets: 0,
          skippedNames: [],
          moreSkippedNames: 0,
        }}
      />,
    );
    expect(html).toContain("Imported 2 workouts");
    expect(html).toContain("30 sets");
    expect(html).toContain("1 workout was already imported");
    expect(html).toContain('href="/progress"');
  });
});

const report = {
  skippedWarmups: 4,
  skippedTimedSets: 868,
  skippedNames: ["Zercher Carry", "Odd Lift"],
  moreSkippedNames: 0,
};
const result = {
  imported: 168,
  alreadyImported: 0,
  sets: 3200,
  skippedSets: 21,
};

afterEach(cleanup);

describe("ImportResultPanel report", () => {
  it("opens with a success line and the counts", () => {
    render(<ImportResultPanel result={result} report={report} />);
    expect(screen.getByRole("status").textContent).toContain(
      "Imported 168 workouts with 3,200 sets",
    );
  });

  it("says how many sets were left out and why, per reason", () => {
    render(<ImportResultPanel result={result} report={report} />);
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toContain("868 timed sets");
    expect(text).toMatch(/no reps/i);
    expect(text).toContain("4 warm-up sets");
    expect(text).toContain("21 sets");
    expect(text).toContain("Zercher Carry");
    expect(text).toContain("Odd Lift");
  });

  it("says how many more names there were than the ones listed", () => {
    render(
      <ImportResultPanel
        result={result}
        report={{ ...report, moreSkippedNames: 7 }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("7 more");
  });

  it("leaves out the 'left out' list when nothing was left out", () => {
    render(
      <ImportResultPanel
        result={{ ...result, skippedSets: 0 }}
        report={{
          skippedWarmups: 0,
          skippedTimedSets: 0,
          skippedNames: [],
          moreSkippedNames: 0,
        }}
      />,
    );
    expect(screen.queryByText(/left out/i)).toBeNull();
  });

  it("takes focus when it appears, so the page cannot look as if it silently reset", () => {
    render(<ImportResultPanel result={result} report={report} />);
    expect(document.activeElement).toBe(screen.getByRole("status"));
  });
});
