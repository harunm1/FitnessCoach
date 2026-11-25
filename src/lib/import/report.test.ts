// Tests for the import report (live feedback 24 Nov, item 8): what was left out of an import
// and why, so the page can say it instead of silently resetting.
import { describe, expect, it } from "vitest";
import { buildImportReport, MAX_NAMES_LISTED } from "./report";

describe("buildImportReport", () => {
  it("carries the warm-up and timed set counts", () => {
    const report = buildImportReport({
      skippedWarmups: 4,
      skippedRows: 868,
      unmatched: [],
      mapping: {},
    });
    expect(report).toEqual({
      skippedWarmups: 4,
      skippedTimedSets: 868,
      skippedNames: [],
      moreSkippedNames: 0,
    });
  });

  it("lists the unmatched names the user did not map, and not the ones they did", () => {
    const report = buildImportReport({
      skippedWarmups: 0,
      skippedRows: 0,
      unmatched: ["Zercher Carry", "Sled Push", "Odd Lift"],
      mapping: { "Sled Push": "sled" },
    });
    expect(report.skippedNames).toEqual(["Zercher Carry", "Odd Lift"]);
    expect(report.moreSkippedNames).toBe(0);
  });

  it("caps the list and says how many more there are", () => {
    const unmatched = Array.from(
      { length: MAX_NAMES_LISTED + 3 },
      (_, index) => `Lift ${index}`,
    );
    const report = buildImportReport({
      skippedWarmups: 0,
      skippedRows: 0,
      unmatched,
      mapping: {},
    });
    expect(report.skippedNames).toHaveLength(MAX_NAMES_LISTED);
    expect(report.moreSkippedNames).toBe(3);
  });

  it("treats a title like __proto__ as an ordinary name", () => {
    const report = buildImportReport({
      skippedWarmups: 0,
      skippedRows: 0,
      unmatched: ["__proto__", "constructor"],
      mapping: {},
    });
    expect(report.skippedNames).toEqual(["__proto__", "constructor"]);
  });
});
