// Tests for the import preview and result panels (#131).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
      />,
    );
    expect(html).toContain("Imported 2 workouts");
    expect(html).toContain("30 sets");
    expect(html).toContain("1 workout was already imported");
    expect(html).toContain('href="/progress"');
  });
});
